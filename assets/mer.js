(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const state = {model: null, cy: null, seeds: new Set(), revision: 0, graph: null, highlighted: null};
    function button(text, action) {
        const element = document.createElement('button'); element.type = 'button'; element.textContent = text;
        element.addEventListener('click', action); return element;
    }
    function download(content, type, name) {
        const url = URL.createObjectURL(new Blob([content], {type}));
        const link = document.createElement('a'); link.href = url; link.download = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
        document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    }
    function details(title, values) {
        $('inspector').replaceChildren(); $('inspector-hint').hidden = true;
        const heading = document.createElement('h3'); heading.className = 'inspector-title'; heading.textContent = title; $('inspector').appendChild(heading);
        const dl = document.createElement('dl');
        for (const [key,value] of Object.entries(values)) {
            const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = value; dl.append(dt,dd);
        }
        $('inspector').appendChild(dl);
    }
    function inspectTable(key) {
        const table = state.model.tables.get(key); if (!table) return;
        state.highlighted = key;
        state.cy.elements().removeClass('focused'); state.cy.getElementById(key).addClass('focused');
        details(table.TABLA, {'Esquema':table.schema, 'Columnas':(state.model.columns.get(key) || []).length,
            'Relaciones declaradas':state.model.edges.filter(e => e.source === key || e.target === key).length,
            'Comentario Oracle':table.COMENTARIO || 'Sin comentario', 'Cobertura':table.external ? 'Fuera de la extracción actual' : 'Incluida en la extracción'});
        const actions = document.createElement('div'); actions.className = 'inspector-actions';
        if (!table.external) actions.appendChild(button('Ver estructura', () => {
            const rows = state.model.structure(key);
            DictionaryCore.showStructure(table.TABLA, rows, () => download(DictionaryCore.serializeCSV(rows), 'text/csv;charset=utf-8', `estructura_${table.TABLA}.csv`));
        }));
        actions.appendChild(button('Expandir relaciones', () => {
            if (state.seeds.has(key)) $('relation-depth').value = '2';
            else {state.seeds.add(key); $('relation-depth').value = '1';}
            draw();
        }));
        $('inspector').appendChild(actions);
    }
    function inspectEdge(edge) {
        state.cy.elements().removeClass('focused'); state.cy.getElementById(edge.id).addClass('focused');
        const source = state.model.tables.get(edge.source), target = state.model.tables.get(edge.target);
        details(edge.row.NOMBRE_RESTRICCION, {'Tabla hija':`${source.schema}.${source.TABLA}`, 'Columnas FK':edge.sourceColumns.join(', '),
            'Tabla padre':`${target.schema}.${target.TABLA}`, 'Columnas referenciadas':edge.targetColumns.join(', '),
            'Padre por registro hijo':edge.active ? edge.parentCardinality : 'No garantizado: FK deshabilitada / no validada',
            'Hijos por registro padre':edge.childCardinality, 'Estado':`${edge.row.ESTADO} / ${edge.row.VALIDADA}`,
            'Al borrar el padre':edge.row.REGLA_BORRADO || 'No informado',
            'Interpretación':'0..1: cero o uno · 0..N: cero o muchos. No representa conteos reales de registros.'});
        $('inspector').appendChild(button('Ver tabla hija', () => inspectTable(edge.source)));
        $('inspector').appendChild(button('Ver tabla padre', () => inspectTable(edge.target)));
    }
    function renderLists(graph) {
        $('seed-count').textContent = state.seeds.size; $('seed-list').replaceChildren();
        for (const key of state.seeds) $('seed-list').appendChild(button(`${state.model.tables.get(key).TABLA} ×`, () => {state.seeds.delete(key); draw();}));
        $('relation-list').replaceChildren(); $('edge-count').textContent = graph.edges.length;
        for (const edge of graph.edges) {
            const source = state.model.tables.get(edge.source), target = state.model.tables.get(edge.target);
            const element = button(`${source.TABLA} → ${target.TABLA}`, () => inspectEdge(edge));
            const subtitle = document.createElement('small'); subtitle.textContent = `${edge.row.NOMBRE_RESTRICCION}${edge.active ? '' : ' · No aplicada / no validada'}`; element.appendChild(subtitle);
            $('relation-list').appendChild(element);
        }
        $('visible-tables').replaceChildren();
        for (const key of graph.nodes) $('visible-tables').appendChild(button(state.model.tables.get(key).TABLA, () => inspectTable(key)));
        searchTables();
    }
    function searchTables() {
        const term = $('table-search').value.trim().toLocaleLowerCase('es'); $('table-results').replaceChildren();
        const matches = [...state.model.tables].filter(([,t]) => !t.external && t.TABLA.toLocaleLowerCase('es').includes(term)).sort((a,b) => a[1].TABLA.localeCompare(b[1].TABLA));
        for (const [key,table] of matches.slice(0,50)) {
            const element = button(table.TABLA, () => { if (state.seeds.has(key)) state.seeds.delete(key); else state.seeds.add(key); draw(); });
            element.classList.toggle('selected', state.seeds.has(key)); element.setAttribute('aria-pressed', String(state.seeds.has(key))); $('table-results').appendChild(element);
        }
        if (matches.length > 50) { const note = document.createElement('p'); note.className = 'muted'; note.textContent = `${matches.length} coincidencias. Escribe para acotar la búsqueda.`; $('table-results').appendChild(note); }
        if (!matches.length) $('table-results').textContent = 'No se encontraron tablas.';
    }
    async function draw() {
        const revision = ++state.revision;
        const graph = state.model.neighborhood([...state.seeds], {depth:Number($('relation-depth').value),limit:Number($('node-limit').value),includeDisabled:$('include-disabled').checked});
        state.graph = graph; renderLists(graph); $('graph-empty').hidden = graph.nodes.length !== 0;
        $('inspector').replaceChildren(); $('inspector-hint').hidden = false; $('mer-error').hidden = true;
        $('graph-status').textContent = graph.nodes.length ? 'Organizando el modelo…' : 'Selecciona una tabla para comenzar.';
        for (const id of ['export-png','export-model','fit-graph','relayout','zoom-in','zoom-out']) $(id).disabled = true;
        const nodes = graph.nodes.map(key => {
            const table = state.model.tables.get(key), label = state.model.nodeLabel(key);
            const lines = label.split('\n').reduce((total,line) => total + Math.max(1,Math.ceil(line.length/28)),0);
            return {data:{id:key,label,seed:state.seeds.has(key),external:table.external,height:Math.max(90,lines*16 + 24)}};
        });
        const edges = graph.edges.map(edge => ({data:{id:edge.id,source:edge.source,target:edge.target,label:edge.active ? `${edge.childCardinality} → ${edge.parentCardinality}` : 'FK no aplicada',inactive:!edge.active}}));
        try {
            let positions = new Map();
            if (nodes.length) {
                const result = await new ELK().layout({id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT','elk.spacing.nodeNode':'35','elk.layered.spacing.nodeNodeBetweenLayers':'110'},
                    children:nodes.map(node => ({id:node.data.id,width:220,height:node.data.height})),
                    edges:edges.map(edge => ({id:edge.data.id,sources:[edge.data.source],targets:[edge.data.target]}))});
                positions = new Map(result.children.map(node => [node.id,{x:node.x + node.width/2,y:node.y + node.height/2}]));
            }
            if (revision !== state.revision) return;
            state.cy.batch(() => { state.cy.elements().remove(); state.cy.add([...nodes.map(node => ({...node,position:positions.get(node.data.id)})),...edges]); });
            state.cy.layout({name:'preset',fit:true,padding:35}).run();
            for (const id of ['export-png','export-model','fit-graph','relayout','zoom-in','zoom-out']) $(id).disabled = !graph.nodes.length;
            $('graph-status').textContent = `${graph.nodes.length} tablas · ${graph.edges.length} FK visibles · ${state.model.manifest.schema}` +
                (graph.omitted.length ? ` · Vista parcial: ${graph.omitted.length} tablas vecinas/seleccionadas fuera del límite. Aumenta el máximo o acota la selección.` : '') +
                (state.model.warnings.length ? ` · ${state.model.warnings.length} referencias incompletas omitidas.` : '');
        } catch (error) {
            if (revision !== state.revision) return;
            $('graph-status').textContent = 'No se pudo organizar el modelo.'; $('mer-error').hidden = false; $('mer-error').textContent = error.message;
        }
    }
    async function init() {
        try {
            const snapshot = await DictionaryCore.loadSnapshot(); state.model = new MerModel(snapshot.data,snapshot.manifest);
            if (typeof cytoscape === 'undefined' || typeof ELK === 'undefined') throw new Error('No se cargaron las bibliotecas del MER. Reinicia el servidor local para habilitar los nuevos archivos.');
            const stamp = snapshot.manifest.timestamp;
            $('snapshot-label').textContent = `${snapshot.manifest.schema} · ${snapshot.data.tablas.length} tablas · ${state.model.edges.length} FK declaradas · Extracción ${stamp.slice(6,8)}/${stamp.slice(4,6)}/${stamp.slice(0,4)}`;
            state.cy = cytoscape({container:$('mer-graph'),elements:[],minZoom:.03,maxZoom:2.5,
                style:[{selector:'node',style:{shape:'roundrectangle',width:220,height:'data(height)','background-color':'#edf5ff','border-width':1.5,'border-color':'#78a7d1',label:'data(label)','text-wrap':'wrap','text-max-width':200,'font-family':'Consolas, monospace','font-size':11,color:'#294c70','text-valign':'center','text-halign':'center'}},
                    {selector:'node[?seed]',style:{'background-color':'#fff6dd','border-color':'#d2a845','border-width':2}},
                    {selector:'node[?external]',style:{'background-color':'#f3f3f3','border-style':'dashed','border-color':'#9ba6b2'}},
                    {selector:'edge',style:{width:1.5,'line-color':'#709bc4','target-arrow-color':'#709bc4','target-arrow-shape':'triangle','curve-style':'bezier',label:'data(label)','font-size':9,color:'#4e6b88','text-background-color':'#fff','text-background-opacity':.9,'text-background-padding':3}},
                    {selector:'edge[?inactive]',style:{'line-style':'dashed','line-color':'#c78b4e','target-arrow-color':'#c78b4e'}},
                    {selector:'node.focused',style:{'border-width':3,'border-color':'#225c91'}},
                    {selector:'edge.focused',style:{'line-color':'#225c91','target-arrow-color':'#225c91',width:3}}]});
            state.cy.on('tap','node',event => inspectTable(event.target.id()));
            state.cy.on('tap','edge',event => {const edge = state.graph.edges.find(e => e.id === event.target.id()); if (edge) inspectEdge(edge);});
            $('table-search').addEventListener('input',searchTables);
            for (const id of ['relation-depth','node-limit','include-disabled']) $(id).addEventListener('change',draw);
            $('clear-model').addEventListener('click', () => {state.seeds.clear(); draw();});
            $('relayout').addEventListener('click',draw); $('fit-graph').addEventListener('click',() => state.cy.fit(undefined,35));
            $('zoom-in').addEventListener('click',() => state.cy.zoom(Math.min(state.cy.zoom()*1.3, state.cy.maxZoom())));
            $('zoom-out').addEventListener('click',() => state.cy.zoom(Math.max(state.cy.zoom()/1.3, state.cy.minZoom())));
            $('export-png').addEventListener('click', () => { const link = document.createElement('a'); link.href = state.cy.png({full:true,bg:'#fff',maxWidth:6000,maxHeight:6000}); link.download = 'MER_SPE.png'; link.click(); });
            $('export-model').addEventListener('click', () => download(JSON.stringify({snapshot:snapshot.manifest,nodes:state.graph.nodes.map(key => ({id:key,...state.model.tables.get(key)})),relations:state.graph.edges,omitted:state.graph.omitted,positions:state.cy.nodes().map(node => ({id:node.id(),position:node.position()}))},null,2),'application/json','MER_SPE.json'));
            let selected = [];
            try { selected = JSON.parse(sessionStorage.getItem('ape-mer-selection') || '[]'); sessionStorage.removeItem('ape-mer-selection'); } catch { /* Selection transfer is optional. */ }
            if (Array.isArray(selected)) for (const table of selected) {const key = state.model.key(table); if (state.model.tables.has(key)) state.seeds.add(key);}
            if (!state.seeds.size) state.seeds.add(state.model.key(snapshot.data.tablas.some(t => t.TABLA === 'DEMANDA') ? 'DEMANDA' : snapshot.data.tablas[0].TABLA));
            await draw();
        } catch (error) { $('mer-error').hidden = false; $('mer-error').textContent = error.message; $('graph-status').textContent = 'No se pudo cargar el MER.'; }
    }
    document.addEventListener('DOMContentLoaded', init);
})();
