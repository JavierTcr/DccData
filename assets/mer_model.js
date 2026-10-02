/* Physical relationships derived exclusively from the published Oracle metadata. */
(function (root) {
    'use strict';
    const split = value => String(value || '').split(',').map(v => v.trim()).filter(Boolean);
    const id = (schema, table) => JSON.stringify([schema, table]);
    const active = row => row.ESTADO === 'ENABLED' && row.VALIDADA === 'VALIDATED';
    class MerModel {
        constructor(data, manifest) {
            this.data = data;
            this.manifest = manifest;
            this.tables = new Map();
            this.constraints = new Map();
            this.columns = new Map();
            for (const row of data.tablas) this.tables.set(id(manifest.schema, row.TABLA), {...row, schema: manifest.schema, external: false});
            for (const row of data.columnas) {
                const key = id(manifest.schema, row.TABLA);
                if (!this.columns.has(key)) this.columns.set(key, []);
                this.columns.get(key).push(row);
            }
            for (const row of data.restricciones) {
                const key = id(manifest.schema, row.TABLA);
                if (!this.constraints.has(key)) this.constraints.set(key, []);
                this.constraints.get(key).push(row);
            }
            this.edges = [];
            this.warnings = [];
            for (const row of data.restricciones.filter(row => row.TIPO === 'R')) {
                const schema = row.ESQUEMA_REFERENCIA;
                if (!schema || !row.TABLA_REFERENCIA || !row.COLUMNAS_REFERENCIA) {
                    this.warnings.push(`Destino incompleto: ${row.NOMBRE_RESTRICCION}`); continue;
                }
                const source = id(manifest.schema, row.TABLA);
                const target = id(schema, row.TABLA_REFERENCIA);
                const sourceColumns = split(row.COLUMNAS), targetColumns = split(row.COLUMNAS_REFERENCIA);
                if (!sourceColumns.length || sourceColumns.length !== targetColumns.length) {
                    this.warnings.push(`Columnas inconsistentes: ${row.NOMBRE_RESTRICCION}`); continue;
                }
                const local = this.columns.get(source) || [];
                if (sourceColumns.some(name => !local.some(c => c.COLUMNA === name)) ||
                    (this.tables.has(target) && !this.tables.get(target).external && targetColumns.some(name => !(this.columns.get(target) || []).some(c => c.COLUMNA === name)))) {
                    this.warnings.push(`Columna ausente: ${row.NOMBRE_RESTRICCION}`); continue;
                }
                if (!this.tables.has(target)) this.tables.set(target, {TABLA: row.TABLA_REFERENCIA, schema, external: true});
                const uniqueConstraint = (this.constraints.get(source) || []).some(c => ['P','U'].includes(c.TIPO) && active(c) && split(c.COLUMNAS).length && split(c.COLUMNAS).every(name => sourceColumns.includes(name)));
                const uniqueIndex = data.indices.some(i => i.TABLA === row.TABLA && i.UNICIDAD === 'UNIQUE' && i.ESTADO === 'VALID' && !i.EXPRESIONES && split(i.COLUMNAS).length && split(i.COLUMNAS).every(name => sourceColumns.includes(name)));
                const nullable = sourceColumns.some(name => local.find(c => c.COLUMNA === name)?.PERMITE_NULOS !== 'N');
                this.edges.push({id: 'fk:' + JSON.stringify([manifest.schema, row.NOMBRE_RESTRICCION]), source, target, row,
                    sourceColumns, targetColumns, active: active(row),
                    parentCardinality: nullable ? '0..1' : '1', childCardinality: uniqueConstraint || uniqueIndex ? '0..1' : '0..N'});
            }
        }
        key(table) { return id(this.manifest.schema, table); }
        relations(includeDisabled = false) { return this.edges.filter(edge => includeDisabled || edge.active); }
        neighborhood(seeds, {depth = 1, limit = 25, includeDisabled = false} = {}) {
            const edges = this.relations(includeDisabled);
            const adjacency = new Map();
            for (const edge of edges) {
                for (const [a,b] of [[edge.source,edge.target],[edge.target,edge.source]]) {
                    if (!adjacency.has(a)) adjacency.set(a, new Set());
                    adjacency.get(a).add(b);
                }
            }
            const requested = [...new Set(seeds)].filter(key => this.tables.has(key));
            const included = new Set(requested.slice(0, limit));
            let frontier = [...included];
            const omitted = new Set(requested.slice(limit));
            for (let level = 0; level < depth; level++) {
                const next = [...new Set(frontier.flatMap(key => [...(adjacency.get(key) || [])]))].sort();
                frontier = [];
                for (const key of next) {
                    if (included.has(key)) continue;
                    if (included.size < limit) { included.add(key); frontier.push(key); }
                    else omitted.add(key);
                }
            }
            for (const key of included) omitted.delete(key);
            return {nodes: [...included], edges: edges.filter(edge => included.has(edge.source) && included.has(edge.target)), omitted: [...omitted]};
        }
        nodeLabel(key) {
            const table = this.tables.get(key);
            const constraints = this.constraints.get(key) || [];
            const pk = constraints.filter(c => c.TIPO === 'P');
            const fk = constraints.filter(c => c.TIPO === 'R');
            const keys = (this.columns.get(key) || []).filter(c => [...pk,...fk].some(k => split(k.COLUMNAS).includes(c.COLUMNA)));
            const fields = keys.slice(0,4).map(c => `${pk.some(k => split(k.COLUMNAS).includes(c.COLUMNA)) ? 'PK' : 'FK'}  ${c.COLUMNA}`);
            if (keys.length > 4) fields.push(`+ ${keys.length - 4} campos de llave`);
            if (table.external) fields.push('Fuera del conjunto publicado');
            else if (!pk.length) fields.push('Sin PK declarada');
            return `${table.external ? table.schema + '.' : ''}${table.TABLA}\n${fields.length ? '\n' + fields.join('\n') : '\nSin campos de llave'}`;
        }
        structure(key) {
            const constraints = this.constraints.get(key) || [];
            return (this.columns.get(key) || []).map(column => {
                const keys = constraints.filter(c => split(c.COLUMNAS).includes(column.COLUMNA));
                const fk = keys.find(c => c.TIPO === 'R');
                return {'Tabla': column.TABLA, 'Nombre de la variable': column.COLUMNA, 'Nombre abreviado': column.COLUMNA,
                    'Llave primaria': keys.some(c => c.TIPO === 'P') ? 'SÍ' : 'NO',
                    'Llave foránea': fk ? 'SÍ' : 'NO', 'Campo Obligatorio': column.PERMITE_NULOS === 'N' ? 'SÍ' : 'NO',
                    'Tipo de datos': column.TIPO_COMPLETO || column.TIPO_DATO, 'Longitud': column.LONGITUD_CARACTERES || column.LONGITUD,
                    'Dominio': keys.filter(c => c.TIPO === 'C').map(c => c.CONDICION_CHECK).filter(Boolean).join('; '),
                    'Regla de validación': keys.map(c => c.CONDICION_CHECK || c.NOMBRE_RESTRICCION).join('; '),
                    'Descripción': column.COMENTARIO || 'Sin comentario Oracle',
                    'Observaciones': fk ? `FK ${fk.NOMBRE_RESTRICCION}: ${fk.ESQUEMA_REFERENCIA}.${fk.TABLA_REFERENCIA} (${fk.COLUMNAS_REFERENCIA}) · ${fk.ESTADO} / ${fk.VALIDADA}` : ''};
            });
        }
    }
    root.MerModel = MerModel;
    if (typeof module !== 'undefined' && module.exports) module.exports = MerModel;
})(globalThis);
