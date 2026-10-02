/* Shared CSV, snapshot validation and safe rendering for both viewers. */
(function (root) {
    'use strict';
    const sections = ['tablas', 'columnas', 'restricciones', 'indices'];
    const required = {
        tablas: ['TABLA', 'NUM_FILAS'], columnas: ['TABLA', 'COLUMNA', 'TIPO_DATO'],
        restricciones: ['TABLA', 'TIPO', 'COLUMNAS'], indices: ['TABLA', 'NOMBRE_INDICE']
    };
    function parseCSV(text) {
        text = text.replace(/^\uFEFF/, '');
        const records = [];
        let record = [], value = '', quoted = false;
        function field() { record.push(value); value = ''; }
        function row() {
            field();
            if (record.some(v => v !== '')) records.push(record);
            record = [];
        }
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '"') {
                if (quoted && text[i + 1] === '"') { value += '"'; i++; }
                else if (quoted || value === '') quoted = !quoted;
                else throw new Error('CSV: comilla inesperada');
            } else if (ch === ',' && !quoted) field();
            else if ((ch === '\n' || ch === '\r') && !quoted) {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                row();
            } else value += ch;
        }
        if (quoted) throw new Error('CSV: campo entre comillas sin cerrar');
        if (value !== '' || record.length) row();
        if (!records.length) return [];
        const headers = records.shift().map(h => h.trim());
        if (headers.some(h => !h) || new Set(headers).size !== headers.length)
            throw new Error('CSV: cabeceras vacías o duplicadas');
        const rows = records.map((values, index) => {
            if (values.length !== headers.length) throw new Error(`CSV: registro ${index + 2} incompleto`);
            return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
        });
        Object.defineProperty(rows, 'headers', {value: headers});
        return rows;
    }
    async function loadCSV(filename) {
        const response = await fetch(filename, {cache: 'no-store'});
        if (!response.ok) throw new Error(`No se pudo cargar ${filename} (HTTP ${response.status})`);
        const bytes = await response.arrayBuffer();
        let text;
        try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
        catch { text = new TextDecoder('windows-1252', {fatal: true}).decode(bytes); }
        return parseCSV(text);
    }
    async function loadSnapshot() {
        const response = await fetch('data/manifest.json', {cache: 'no-store'});
        if (!response.ok) throw new Error('No se pudo cargar el manifiesto del diccionario');
        const manifest = await response.json();
        if (manifest.version !== 1 || !/^[A-Z][A-Z0-9_]*$/.test(manifest.schema) ||
            !/^\d{8}_\d{6}$/.test(manifest.timestamp) || !manifest.files || !manifest.counts)
            throw new Error('Manifiesto inválido');
        const data = Object.fromEntries(await Promise.all(sections.map(async section => {
            const expected = `${section}_${manifest.schema.toLowerCase()}_${manifest.timestamp}.csv`;
            if (manifest.files[section] !== expected) throw new Error('Archivo no autorizado en el manifiesto');
            const rows = await loadCSV(`data/${expected}`);
            if (!Number.isInteger(manifest.counts[section]) || rows.length !== manifest.counts[section])
                throw new Error(`Conteo inconsistente en ${section}`);
            if (required[section].some(key => !rows.headers?.includes(key)) ||
                rows.some(row => required[section].some(key => !(key in row)) || !row.TABLA))
                throw new Error(`Columnas requeridas ausentes en ${section}`);
            return [section, rows];
        })));
        if (!data.tablas.length || !data.columnas.length) throw new Error('El diccionario está vacío');
        const tables = new Set(data.tablas.map(row => row.TABLA));
        if (tables.size !== data.tablas.length || sections.slice(1).some(s => data[s].some(row => !tables.has(row.TABLA))))
            throw new Error('Tablas duplicadas o referencias inconsistentes');
        return {data, manifest};
    }
    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
    }
    function html(strings, ...values) {
        return strings.reduce((result, text, i) => result + text + (i < values.length ? escapeHTML(values[i]) : ''), '');
    }
    function csvCell(value, separator) {
        let text = String(value ?? '');
        // Spreadsheet formulas are not part of the dictionary's executable content.
        if (/^[\s\uFEFF]*[=+\-@]/.test(text)) text = "'" + text;
        return text.includes(separator) || /["\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    }
    function serializeCSV(rows, separator = ',') {
        if (!rows.length) return '';
        const headers = Object.keys(rows[0]);
        return '\uFEFF' + [headers.map(h => csvCell(h, separator)).join(separator),
            ...rows.map(row => headers.map(h => csvCell(row[h], separator)).join(separator))].join('\r\n');
    }
    function constraintType(row) {
        const types = {'PRIMARY KEY':'P', 'FOREIGN KEY':'R', 'UNIQUE':'U', 'CHECK':'C'};
        return types[row.TIPO] || row.TIPO || types[row.TIPO_DESCRIPCION];
    }
    function hasColumn(row, name) { return (row.COLUMNAS || '').split(',').map(c => c.trim()).includes(name); }
    function updateSummary(data, manifest) {
        for (const section of sections) {
            const el = document.getElementById(`total-${section}`);
            if (el) el.textContent = data[section].length.toLocaleString('es-CO');
        }
        const stamp = manifest.timestamp;
        const date = `${stamp.slice(6,8)}/${stamp.slice(4,6)}/${stamp.slice(0,4)} ${stamp.slice(9,11)}:${stamp.slice(11,13)}:${stamp.slice(13,15)}`;
        for (const id of ['generation-date', 'extraction-date']) {
            const el = document.getElementById(id); if (el) el.textContent = date;
        }
        const seconds = document.getElementById('extraction-seconds');
        if (seconds) seconds.textContent = manifest.duration_seconds === undefined ? 'No disponible' : `${manifest.duration_seconds} segundos`;
        const excluded = document.getElementById('excluded-tables');
        if (excluded) excluded.textContent = manifest.excluded_tables ?? 'No disponible';
        const summary = document.getElementById('snapshot-description');
        if (summary) summary.textContent = `Diccionario SPE–APE · Esquema ${manifest.schema}: ${data.tablas.length} tablas incluidas en la extracción.`;
    }
    function structureMarkup(tableName, rows) {
        return html`
            <header class="structure-header">
                <div><span class="structure-eyebrow">DICCIONARIO DE DATOS</span>
                    <h5 id="tableDetailsModalLabel">${tableName}</h5>
                    <p>${rows.length} campos · Estructura de la tabla</p>
                </div>
                <button type="button" class="structure-close" data-action="close" aria-label="Cerrar estructura">×</button>
            </header>
            <div class="structure-toolbar">
                <label class="structure-search"><span>Buscar campo</span>
                    <input type="search" data-action="search" placeholder="Nombre, tipo o descripción…" autocomplete="off">
                </label>
                <button type="button" class="structure-download" data-action="download">Descargar CSV</button>
            </div>
            <div class="structure-legend">
                <span><span class="structure-key structure-key-pk">PK</span> Llave primaria</span>
                <span><span class="structure-key structure-key-fk">FK</span> Llave foránea</span>
                <span class="structure-count" data-column-count aria-live="polite">${rows.length} campos</span>
            </div>
            <div class="structure-scroll" tabindex="0" aria-label="Campos de la tabla">
                <table class="structure-table">
                    <colgroup><col class="structure-col-name"><col class="structure-col-type"><col class="structure-col-keys"><col class="structure-col-required"><col><col class="structure-col-action"></colgroup>
                    <thead><tr><th scope="col">Campo</th><th scope="col">Tipo / longitud</th><th scope="col">Llaves</th><th scope="col">Obligatorio</th><th scope="col">Descripción</th><th scope="col"><span class="structure-sr-only">Detalles del campo</span></th></tr></thead>
                    <tbody data-columns-body></tbody>
                </table>
                <p class="structure-empty" data-empty hidden>No se encontraron campos para esta búsqueda.</p>
            </div>
            <footer class="structure-pagination">
                <span data-page-label aria-live="polite"></span>
                <div><button type="button" data-action="previous" aria-label="Página anterior">‹ Anterior</button>
                    <button type="button" data-action="next" aria-label="Página siguiente">Siguiente ›</button></div>
            </footer>`;
    }
    function bindStructure(container, rows, download, close) {
        const affirmative = value => String(value || '').toUpperCase().startsWith('S');
        const detailFields = ['Nombre abreviado', 'Dominio', 'Regla de validación', 'Descripción', 'Observaciones'];
        const tbody = container.querySelector('[data-columns-body]');
        const typeStyle = value => {
            const type = String(value || '').toUpperCase();
            if (/NUMBER|NUMÉR|INT|FLOAT|DECIMAL/.test(type)) return 'number';
            if (/DATE|TIME|FECHA/.test(type)) return 'date';
            if (/CHAR|TEXTO|STRING/.test(type)) return 'text';
            return 'other';
        };
        tbody.innerHTML = rows.map((row, index) => {
            const keys = (affirmative(row['Llave primaria']) ? '<span class="structure-key structure-key-pk">PK</span>' : '') +
                (affirmative(row['Llave foránea']) ? '<span class="structure-key structure-key-fk">FK</span>' : '');
            const rowStyle = affirmative(row['Llave primaria']) ? 'has-primary-key' : affirmative(row['Llave foránea']) ? 'has-foreign-key' : '';
            const cells = html`<tr data-column-row="${index}" class="${rowStyle}">
                <th scope="row"><span class="structure-field-name">${row['Nombre de la variable']}</span></th>
                <td><code class="structure-type type-${typeStyle(row['Tipo de datos'])}">${row['Tipo de datos'] || '—'}</code><span class="structure-length">${row.Longitud || ''}</span></td>
                <td data-key-cell></td>
                <td><span class="structure-required ${affirmative(row['Campo Obligatorio']) ? 'is-required' : ''}">${affirmative(row['Campo Obligatorio']) ? 'Sí' : 'Opcional'}</span></td>
                <td><span class="structure-description">${row['Descripción'] || 'Sin descripción'}</span></td>
                <td><button type="button" class="structure-detail-toggle" data-detail="${index}" aria-expanded="false" aria-controls="structure-extra-${index}">Detalles</button></td>
            </tr>`;
            const details = detailFields.map(field => html`<div><dt>${field}</dt><dd>${row[field] || 'No especificado'}</dd></div>`).join('');
            return cells.replace('<td data-key-cell></td>', '<td data-key-cell><span class="structure-keys">' + (keys || '<span class="structure-muted">—</span>') + '</span></td>') +
                html`<tr class="structure-extra" id="structure-extra-${index}" hidden><td colspan="6"><dl></dl></td></tr>`.replace('<dl></dl>', '<dl>' + details + '</dl>');
        }).join('');
        container.querySelectorAll('[data-detail]').forEach(button => {
            button.addEventListener('click', () => {
                const extra = container.querySelector(`#structure-extra-${button.dataset.detail}`);
                extra.hidden = !extra.hidden;
                button.setAttribute('aria-expanded', String(!extra.hidden));
                button.textContent = extra.hidden ? 'Detalles' : 'Ocultar';
            });
        });
        const pageSize = 12;
        let page = 1;
        let matching = rows.map((_, index) => index);
        const fieldRows = Array.from(container.querySelectorAll('[data-column-row]'));
        const previous = container.querySelector('[data-action="previous"]');
        const next = container.querySelector('[data-action="next"]');
        function renderPage() {
            const start = (page - 1) * pageSize;
            const visible = new Set(matching.slice(start, start + pageSize));
            fieldRows.forEach(tr => {
                const index = Number(tr.dataset.columnRow);
                tr.hidden = !visible.has(index);
                const extra = container.querySelector(`#structure-extra-${index}`);
                const expanded = tr.querySelector('[data-detail]').getAttribute('aria-expanded') === 'true';
                extra.hidden = tr.hidden || !expanded;
            });
            container.querySelector('[data-column-count]').textContent = `${matching.length} campos`;
            container.querySelector('[data-empty]').hidden = matching.length !== 0;
            container.querySelector('[data-page-label]').textContent = matching.length ? `${start + 1}–${Math.min(start + pageSize, matching.length)} de ${matching.length} campos` : '0 campos';
            previous.disabled = page === 1;
            next.disabled = start + pageSize >= matching.length;
            container.querySelector('.structure-scroll').scrollTop = 0;
        }
        previous.addEventListener('click', () => { if (page > 1) { page--; renderPage(); } });
        next.addEventListener('click', () => { if (page * pageSize < matching.length) { page++; renderPage(); } });
        container.querySelector('[data-action="search"]').addEventListener('input', event => {
            const term = event.target.value.trim().toLocaleLowerCase('es');
            matching = rows.map((row, index) => Object.values(row).some(value => String(value ?? '').toLocaleLowerCase('es').includes(term)) ? index : -1).filter(index => index >= 0);
            page = 1;
            renderPage();
        });
        renderPage();
        container.querySelector('[data-action="close"]').addEventListener('click', close);
        container.querySelector('[data-action="download"]').addEventListener('click', download);
    }
    function showStructure(tableName, rows, download) {
        document.getElementById('tableDetailsModal')?.remove();
        const dialog = document.createElement('dialog');
        dialog.id = 'tableDetailsModal';
        dialog.className = 'dictionary-structure-dialog';
        dialog.setAttribute('aria-labelledby', 'tableDetailsModalLabel');
        dialog.innerHTML = structureMarkup(tableName, rows);
        bindStructure(dialog, rows, download, () => dialog.close());
        dialog.addEventListener('close', () => dialog.remove());
        document.body.appendChild(dialog);
        dialog.showModal();
        return dialog;
    }
    const api = {parseCSV, loadCSV, loadSnapshot, escapeHTML, html, csvCell, serializeCSV, constraintType, hasColumn, updateSummary, structureMarkup, bindStructure, showStructure};
    root.DictionaryCore = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
