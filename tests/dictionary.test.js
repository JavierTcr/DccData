const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../assets/dictionary_core.js');
const manifest = JSON.parse(fs.readFileSync('data/manifest.json', 'utf8'));

function viewer(filename) {
    const context = {DictionaryCore: core, document: {addEventListener() {}}, window: {}, console};
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(filename, 'utf8') + '\nthis.Viewer = DiccionarioDatos;', context);
    return Object.create(context.Viewer.prototype);
}

async function main() {
    assert.deepEqual(core.parseCSV('\uFEFFA,B\r\n1,"line 1\r\nline 2"\r\n2,"a ""quote"""'),
        [{A: '1', B: 'line 1\r\nline 2'}, {A: '2', B: 'a "quote"'}]);
    assert.throws(() => core.parseCSV('A,B\n1'), /incompleto/);
    assert.throws(() => core.parseCSV('A,B\n1,"open'), /sin cerrar/);
    assert.throws(() => core.parseCSV('A,A\n1,2'), /duplicadas/);
    assert.equal(core.csvCell(0, ','), '0');
    assert.equal(core.parseCSV(core.serializeCSV([{A: 'multi\nline', B: 0}]))[0].B, '0');
    assert.equal(core.csvCell('=1+1', ','), "'=1+1");
    assert.equal(core.csvCell(' @SUM(A1)', ';'), "' @SUM(A1)");
    assert.equal(core.html`<td>${'<img src=x onerror=alert(1)>'}</td>`, '<td>&lt;img src=x onerror=alert(1)&gt;</td>');

    const data = {};
    for (const [section, filename] of Object.entries(manifest.files)) {
        const text = fs.readFileSync(`data/${filename}`, 'utf8');
        data[section] = core.parseCSV(text);
        for (const filename of ['diccionario_viewer.js', 'assets/script_fixed.js'])
            assert.equal(viewer(filename).parseCSV(text).length, manifest.counts[section]);
    }
    // A historical snapshot contains a real multiline identifier.
    const historical = core.parseCSV(fs.readFileSync('data/columnas_spe_20250827_171054.csv', 'utf8'));
    assert.equal(historical.length, 4979);
    assert(historical.some(row => row.COLUMNA.includes('\n')));

    const mass = viewer('diccionario_viewer.js');
    mass.data = {
        tablas: [{TABLA: 'T'}, {TABLA: 'OTHER'}],
        columnas: ['ID', 'OTHER_ID', 'PARENT_ID'].map(COLUMNA => ({TABLA:'T', COLUMNA, TIPO_COMPLETO:'NUMBER(10,0)', PERMITE_NULOS:'N'})),
        restricciones: [{TABLA:'T', TIPO:'P', COLUMNAS:'OTHER_ID'}, {TABLA:'T', TIPO:'R', COLUMNAS:'PARENT_ID'}, {TABLA:'T', TIPO:'U', COLUMNAS:'ID,PARENT_ID'}]
    };
    mass.filteredData = {tablas:[], columnas:[], restricciones:[]};
    const structures = mass.getSelectedTablesStructure(['T']);
    assert.equal(structures.length, 3, 'Filters must not truncate selected-table structures');
    assert.equal(structures[0]['Llave primaria'], 'NO', 'ID is not OTHER_ID');
    assert.equal(structures[1]['Llave primaria'], 'SÍ');
    assert.equal(structures[2]['Llave foránea'], 'SÍ');
    assert(structures[0].Observaciones.includes('compuesta'));
    mass.selectedTables = new Set(['T', 'OTHER']);
    mass.currentSection = 'resumen'; mass.currentPage = {tablas:2};
    let rendered;
    mass.loadSectionData = section => {rendered = section;};
    mass.filterData('tablas', 'OTHER', 'TABLA');
    assert.equal(mass.filteredData.tablas.length, 1);
    assert.equal(mass.currentPage.tablas, 1);
    assert.equal(rendered, 'tablas');
    assert.deepEqual(Array.from(mass.selectedTables), ['T', 'OTHER']);
    mass.changePage('tablas', 2);
    assert.equal(mass.currentPage.tablas, 2);
    assert.deepEqual(Array.from(mass.selectedTables), ['T', 'OTHER']);

    const boxes = ['T', 'OTHER'].map(name => ({checked:true,
        getAttribute: () => name, closest: () => ({classList:{add(){}, remove(){}}})}));
    const controls = Object.fromEntries(['selected-count', 'selected-count-list', 'export-selected-btn', 'export-selected-list-btn', 'select-all-tables', 'select-all-header'].map(id => [id, {}]));
    const context = {DictionaryCore:core, window:{}, console,
        document:{addEventListener(){}, querySelectorAll:() => boxes, getElementById:id => controls[id]}};
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('diccionario_viewer.js','utf8') + '\ndiccionario = Object.create(DiccionarioDatos.prototype); diccionario.selectedTables = new Set(["T", "OTHER"]);', context);
    vm.runInContext('clearAllSelections()', context);
    assert(boxes.every(box => !box.checked));
    assert.equal(controls['selected-count'].textContent, 0);
    assert.equal(controls['select-all-header'].checked, false);
    assert.equal(controls['export-selected-btn'].disabled, true);

    const details = viewer('assets/script_fixed.js');
    assert.equal(details.getColumnDescription({COMENTARIO: 'Comentario oficial'}), 'Comentario oficial');
    assert(details.getColumnDescription({COLUMNA:'ID'}).startsWith('Descripción sugerida:'));
    assert.equal(details.getDataLength('VARCHAR2(100 CHAR)'), '100');
    assert.equal(details.getDataLength('NUMBER(10,-2)'), '10');
    const html = details.generateTableDetailsRows([{'Nombre de la variable':'<svg onload=alert(1)>', 'Descripción':'<script>alert(1)</script>'}]);
    assert(!html.includes('<svg')); assert(!html.includes('<script>'));

    const originalFetch = global.fetch;
    const fakeResponse = (value, ok = true) => ({ok, status: ok ? 200 : 404,
        json: async () => value,
        arrayBuffer: async () => { const bytes = fs.readFileSync(value); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }});
    try {
        global.fetch = async path => path.endsWith('manifest.json') ? fakeResponse(manifest) : fakeResponse(path);
        const snapshot = await core.loadSnapshot();
        assert.equal(snapshot.data.columnas.length, manifest.counts.columnas);
        global.fetch = async path => path.includes('restricciones_') ? fakeResponse(null, false) : path.endsWith('manifest.json') ? fakeResponse(manifest) : fakeResponse(path);
        await assert.rejects(core.loadSnapshot(), /HTTP 404/);
        const broken = {...manifest, counts: {...manifest.counts, columnas:1}};
        global.fetch = async path => path.endsWith('manifest.json') ? fakeResponse(broken) : fakeResponse(path);
        await assert.rejects(core.loadSnapshot(), /Conteo inconsistente/);
    } finally { global.fetch = originalFetch; }
    console.log('OK: CSV, snapshots, exports, keys, filters, selection and safe HTML');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
