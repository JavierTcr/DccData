// Exercise real HTML, rendering and click handlers without a network dependency.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const core = require('../assets/dictionary_core.js');
const manifest = JSON.parse(fs.readFileSync('data/manifest.json', 'utf8'));
const data = Object.fromEntries(Object.entries(manifest.files).map(([section, filename]) =>
    [section, core.parseCSV(fs.readFileSync(`data/${filename}`, 'utf8'))]));

for (const [htmlFile, scriptFile, mass] of [
    ['diccionario_viewer.html', 'diccionario_viewer.js', true],
    ['index.html', 'assets/script_fixed.js', false]
]) {
    const dom = new JSDOM(fs.readFileSync(htmlFile, 'utf8'), {runScripts: 'dangerously', url:'http://localhost/'});
    const win = dom.window;
    // jsdom does not implement native dialog presentation; use the standard open/close contract.
    win.HTMLDialogElement.prototype.showModal = function () {this.setAttribute('open', '');};
    win.HTMLDialogElement.prototype.close = function () {
        this.removeAttribute('open'); this.dispatchEvent(new win.Event('close'));
    };
    win.console = {log(){}, error(){}, warn(){}};
    win.eval(fs.readFileSync('assets/dictionary_core.js', 'utf8'));
    win.eval(fs.readFileSync(scriptFile, 'utf8') + '\nDiccionarioDatos.prototype.init = function () {}; window.app = new DiccionarioDatos();' +
        (mass ? '\ndiccionario = window.app;' : '\nwindow.diccionario = window.app;'));
    const app = win.app;
    app.data = data;
    app.filteredData = {...data};
    if (!mass) app.createOptimizedIndexes();
    // The summary stays centered; long sections must start beside the navigation.
    const brandStyle = win.document.createElement('style');
    brandStyle.textContent = fs.readFileSync('assets/ape_brand.css', 'utf8');
    win.document.head.appendChild(brandStyle);
    const loadSectionData = app.loadSectionData;
    app.loadSectionData = () => {};
    for (const section of ['resumen', 'tablas', 'columnas', 'restricciones', 'indices', 'resumen']) {
        app.showSection(section);
        const alignment = section === 'resumen' ? 'center' : 'flex-start';
        for (const selector of ['.dictionary-shell', '.dictionary-shell > .row']) {
            assert.equal(win.getComputedStyle(win.document.querySelector(selector)).alignItems, alignment,
                `${htmlFile}: ${section} must place navigation at the correct height`);
        }
        assert.equal(win.document.getElementById(`${section}-section`).style.display, 'block');
    }
    app.loadSectionData = loadSectionData;
    const table = data.tablas.find(row => row.TABLA === 'DEMANDA') || data.tablas[0];
    const expected = data.columnas.filter(row => row.TABLA === table.TABLA).length;
    app.renderTablasTable([table]);
    const nameButton = win.document.querySelector('#tablas-tbody [data-action="details"]');
    assert(nameButton, `${htmlFile}: table name must be actionable`);
    nameButton.click();
    let dialog = win.document.getElementById('tableDetailsModal');
    assert(dialog?.open, `${htmlFile}: clicking a name must open the structure`);
    assert.equal(dialog.querySelectorAll('[data-column-row]').length, expected);
    assert.equal(dialog.querySelectorAll('[data-column-row]:not([hidden])').length, Math.min(12, expected));
    assert.equal(dialog.querySelectorAll('thead th').length, 6, 'Keep the default view compact');
    const detailButton = dialog.querySelector('[data-detail]');
    detailButton.click();
    assert.equal(detailButton.getAttribute('aria-expanded'), 'true');
    assert.equal(dialog.querySelector('.structure-extra').hidden, false);
    assert(dialog.querySelector('.structure-extra').textContent.includes('Regla de validación'));
    detailButton.click();
    assert.equal(dialog.querySelector('.structure-extra').hidden, true);
    const search = dialog.querySelector('[data-action="search"]');
    search.value = '__NO_SUCH_FIELD__';
    search.dispatchEvent(new win.Event('input', {bubbles:true}));
    assert.equal(dialog.querySelectorAll('[data-column-row]:not([hidden])').length, 0);
    assert.equal(dialog.querySelector('[data-empty]').hidden, false);
    search.value = '';
    search.dispatchEvent(new win.Event('input', {bubbles:true}));
    assert.equal(dialog.querySelectorAll('[data-column-row]:not([hidden])').length, Math.min(12, expected));
    if (expected > 12) {
        dialog.querySelector('[data-action="next"]').click();
        assert.equal(dialog.querySelector('[data-column-row="0"]').hidden, true);
        assert.equal(dialog.querySelector('[data-column-row="12"]').hidden, false);
        assert.equal(dialog.querySelector('[data-action="previous"]').disabled, false);
        dialog.querySelector('[data-action="previous"]').click();
        assert.equal(dialog.querySelector('[data-column-row="0"]').hidden, false);
        // Search must reach fields beyond the current page.
        const last = dialog.querySelector(`[data-column-row="${expected - 1}"]`);
        search.value = last.querySelector('.structure-field-name').textContent;
        search.dispatchEvent(new win.Event('input', {bubbles:true}));
        assert.equal(last.hidden, false);
    }
    assert(dialog.querySelector('h5').textContent.includes(table.TABLA));
    let exported;
    app.exportToCSV = rows => {exported = rows;};
    dialog.querySelector('[data-action="download"]').click();
    assert.equal(exported.length, expected, 'CSV must include every field despite search and pagination');
    dialog.querySelector('[data-action="close"]').click();
    assert.equal(win.document.getElementById('tableDetailsModal'), null);

    if (mass) {
        const checkbox = win.document.querySelector('.table-checkbox');
        checkbox.click();
        assert(app.selectedTables.has(table.TABLA));
        assert.equal(win.document.getElementById('tableDetailsModal'), null, 'Checkbox must only select');
        // Active column filters cannot truncate the table viewed in the dialog.
        app.filteredData.columnas = [];
        app.filteredData.restricciones = [];
        win.document.querySelector('#tablas-tbody tr td:last-child').click();
        dialog = win.document.getElementById('tableDetailsModal');
        assert.equal(dialog.querySelectorAll('[data-column-row]').length, expected);
        assert(app.selectedTables.has(table.TABLA));
        dialog.close();
    } else {
        // Retain the Bootstrap path when that library is available.
        let shown = false;
        win.bootstrap = {Modal: class {show() {shown = true;}}};
        nameButton.click();
        assert(shown);
        assert.equal(win.document.querySelectorAll('#tableDetailsModal [data-column-row]').length, expected);
    }
    dom.window.close();
}
console.log('OK: table-name clicks, structures, row clicks, checkbox selection, close and CSV in both viewers');
