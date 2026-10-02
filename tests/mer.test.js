const assert = require('node:assert/strict');
const fs = require('node:fs');
const cytoscape = require('cytoscape');
const ELK = require('elkjs');
const {JSDOM} = require('jsdom');
const core = require('../assets/dictionary_core');
const MerModel = require('../assets/mer_model');
const manifest = JSON.parse(fs.readFileSync('data/manifest.json','utf8'));
const data = Object.fromEntries(Object.entries(manifest.files).map(([key,file]) => [key,core.parseCSV(fs.readFileSync(`data/${file}`,'utf8'))]));

async function waitFor(predicate) {
    for (let i=0;i<250;i++) {if (predicate()) return; await new Promise(resolve => setTimeout(resolve,20));}
    throw new Error('MER UI did not finish updating');
}
async function main() {
    const model = new MerModel(data,manifest);
    assert.equal(model.edges.length,790); assert.equal(model.warnings.length,0);
    assert.equal(model.relations().length,780); assert.equal(model.relations(true).length,790);
    const graph = model.neighborhood([model.key('DEMANDA')]);
    assert.equal(graph.nodes.length,25); assert(graph.omitted.length > 0);
    assert(graph.edges.every(edge => graph.nodes.includes(edge.source) && graph.nodes.includes(edge.target)));
    const related = new Set(model.edges.flatMap(edge => [edge.source,edge.target]));
    const isolated = [...model.tables.keys()].find(key => !related.has(key));
    const lone = model.neighborhood([isolated]); assert.equal(lone.nodes.length,1); assert.equal(lone.edges.length,0);
    const pairs = new Map();
    for (const edge of model.edges) {const pair = edge.source+'|'+edge.target; if (!pairs.has(pair)) pairs.set(pair,[]); pairs.get(pair).push(edge);}
    const multiple = [...pairs.values()].find(edges => edges.length > 1);
    const small = model.neighborhood([multiple[0].source,multiple[0].target],{depth:0,includeDisabled:true});
    assert(multiple.every(edge => small.edges.some(e => e.id === edge.id)));
    assert.equal(new Set(model.edges.map(edge => edge.id)).size,790);
    const layout = await new ELK().layout({id:'root',layoutOptions:{'elk.algorithm':'layered'},children:graph.nodes.map(id => ({id,width:220,height:145})),edges:graph.edges.map(e => ({id:e.id,sources:[e.source],targets:[e.target]}))});
    assert.equal(layout.children.length,25); assert(layout.children.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)));

    const fixture = {tablas:[{TABLA:'A'},{TABLA:'B'}],columnas:[{TABLA:'A',COLUMNA:'ID',PERMITE_NULOS:'N'},{TABLA:'A',COLUMNA:'B_ID',PERMITE_NULOS:'Y'},{TABLA:'B',COLUMNA:'ID',PERMITE_NULOS:'N'}],indices:[],restricciones:[
        {TABLA:'A',TIPO:'U',COLUMNAS:'B_ID',ESTADO:'ENABLED',VALIDADA:'VALIDATED'},
        {TABLA:'A',TIPO:'R',COLUMNAS:'B_ID',NOMBRE_RESTRICCION:'FK_A_B',ESQUEMA_REFERENCIA:'SPE',TABLA_REFERENCIA:'B',COLUMNAS_REFERENCIA:'ID',ESTADO:'ENABLED',VALIDADA:'VALIDATED'}]};
    let synthetic = new MerModel(fixture,manifest);
    assert.equal(synthetic.edges[0].parentCardinality,'0..1'); assert.equal(synthetic.edges[0].childCardinality,'0..1');
    fixture.restricciones[1].ESQUEMA_REFERENCIA = 'OTHER';
    synthetic = new MerModel(fixture,manifest); assert(synthetic.tables.get(synthetic.edges[0].target).external); assert.notEqual(synthetic.edges[0].target,synthetic.key('B'));
    fixture.restricciones[1].COLUMNAS_REFERENCIA = ''; assert.equal(new MerModel(fixture,manifest).warnings.length,1);

    const dom = new JSDOM(fs.readFileSync('mer.html','utf8'),{runScripts:'dangerously',url:'http://localhost/mer.html'});
    const win = dom.window;
    win.HTMLDialogElement.prototype.showModal = function(){this.setAttribute('open','');};
    win.HTMLDialogElement.prototype.close = function(){this.removeAttribute('open');this.dispatchEvent(new win.Event('close'));};
    win.eval(fs.readFileSync('assets/dictionary_core.js','utf8'));
    win.DictionaryCore.loadSnapshot = async () => ({data,manifest});
    win.ELK = ELK;
    let cy;
    win.cytoscape = options => {
        const {container, ...settings} = options;
        // Cytoscape's plain-object checks require data in the same JS realm as the library.
        cy = cytoscape({...JSON.parse(JSON.stringify(settings)),headless:true,styleEnabled:true});
        const add = cy.add.bind(cy);
        cy.add = elements => add(JSON.parse(JSON.stringify(elements)));
        return cy;
    };
    win.sessionStorage.setItem('ape-mer-selection',JSON.stringify(['DEMANDA']));
    win.eval(fs.readFileSync('assets/mer_model.js','utf8'));win.eval(fs.readFileSync('assets/mer.js','utf8'));
    await waitFor(() => win.document.getElementById('graph-status').textContent.includes('FK visibles'));
    assert.equal(cy.nodes().length,25);
    assert(win.document.getElementById('graph-status').textContent.includes('Vista parcial'));
    assert.equal(win.document.getElementById('mer-error').hidden,true);
    const key = model.key('DEMANDA'); cy.getElementById(key).emit('tap');
    assert(win.document.getElementById('inspector').textContent.includes('DEMANDA'));
    assert.equal(cy.getElementById(key).width(),220,'Highlight must not shrink the table');
    [...win.document.querySelectorAll('#inspector button')].find(button => button.textContent === 'Ver estructura').click();
    assert(win.document.getElementById('tableDetailsModal').open);
    assert.equal(win.document.querySelectorAll('[data-column-row]').length,data.columnas.filter(c => c.TABLA === 'DEMANDA').length);
    win.document.getElementById('tableDetailsModal').close();
    win.document.querySelector('#relation-list button').click();assert(win.document.getElementById('inspector').textContent.includes('Columnas FK'));
    const depth = win.document.getElementById('relation-depth');depth.value='0';depth.dispatchEvent(new win.Event('change'));
    await waitFor(() => win.document.getElementById('graph-status').textContent.includes('FK visibles') && cy.nodes().length === 1);
    assert.equal(cy.edges().length,0);
    win.document.getElementById('clear-model').click(); await waitFor(() => cy.nodes().length === 0);
    assert.equal(win.document.getElementById('graph-empty').hidden,false);
    assert.equal(win.document.getElementById('export-model').disabled,true);
    const search = win.document.getElementById('table-search');search.value=model.tables.get(isolated).TABLA;search.dispatchEvent(new win.Event('input'));
    [...win.document.querySelectorAll('#table-results button')].find(button => button.textContent === model.tables.get(isolated).TABLA).click();
    await waitFor(() => win.document.getElementById('graph-status').textContent.includes('FK visibles') && cy.nodes().length === 1);
    assert.equal(cy.edges().length,0);
    cy.destroy();dom.window.close();
    console.log('OK: real FK graph, cardinalities, parallel edges, coverage limits, ELK layout and MER navigation');
}
main().catch(error => {console.error(error);process.exitCode=1;});
