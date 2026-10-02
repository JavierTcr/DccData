// Diccionario de Datos - JavaScript
class DiccionarioDatos {
    constructor() {
        this.data = {
            tablas: [],
            columnas: [],
            restricciones: [],
            indices: []
        };
        this.currentSection = 'resumen';
        this.currentPage = {
            tablas: 1,
            columnas: 1,
            restricciones: 1,
            indices: 1
        };
        this.itemsPerPage = 50;
        this.filteredData = {};
        this.selectedTables = new Set(); // Para rastrear tablas seleccionadas
        
        this.init();
    }

    async init() {
        console.log('Inicializando DiccionarioDatos...');
        try {
            await this.loadData();
            this.setupEventListeners();
            this.showSection('resumen');
            console.log('DiccionarioDatos inicializado correctamente');
        } catch (error) {
            console.error('Error inicializando la aplicación:', error);
            this.showError('Error cargando los datos del diccionario: ' + error.message);
        }
    }

    async loadData() {
        this.showLoading(true);
        try {
            const {data, manifest} = await DictionaryCore.loadSnapshot();
            this.data = data;
            this.manifest = manifest;
            this.filteredData = Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, [...rows]]));
            if (this.createOptimizedIndexes) this.createOptimizedIndexes();
            this.populateFilters();
            DictionaryCore.updateSummary(data, manifest);
        } finally {
            this.showLoading(false);
        }
    }

    detectTimestamp() {
        return this.manifest?.timestamp || null;
    }

    async loadCSV(filename) {
        return DictionaryCore.loadCSV(filename);
    }

    parseCSV(text) {
        return DictionaryCore.parseCSV(text);
    }

        

    loadSampleData() {
        // Datos de ejemplo si no se pueden cargar los CSV
        this.data.tablas = [
            { TABLA: 'USUARIO', NUM_FILAS: '1500', TABLESPACE: 'USERS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2025-01-15' },
            { TABLA: 'PRODUCTO', NUM_FILAS: '850', TABLESPACE: 'USERS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2025-01-15' },
            { TABLA: 'PEDIDO', NUM_FILAS: '3200', TABLESPACE: 'USERS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2025-01-15' }
        ];
        
        this.data.columnas = [
            { TABLA: 'USUARIO', COLUMNA: 'ID_USUARIO', TIPO_COMPLETO: 'NUMBER(10)', PERMITE_NULOS: 'N', POSICION: '1' },
            { TABLA: 'USUARIO', COLUMNA: 'NOMBRE', TIPO_COMPLETO: 'VARCHAR2(100)', PERMITE_NULOS: 'Y', POSICION: '2' },
            { TABLA: 'PRODUCTO', COLUMNA: 'ID_PRODUCTO', TIPO_COMPLETO: 'NUMBER(10)', PERMITE_NULOS: 'N', POSICION: '1' }
        ];
        
        this.data.restricciones = [
            { TABLA: 'USUARIO', NOMBRE_RESTRICCION: 'PK_USUARIO', TIPO_DESCRIPCION: 'PRIMARY KEY', ESTADO: 'ENABLED', COLUMNAS: 'ID_USUARIO' }
        ];
        
        this.data.indices = [
            { TABLA: 'USUARIO', NOMBRE_INDICE: 'PK_USUARIO', TIPO_INDICE: 'NORMAL', UNICIDAD: 'UNIQUE', ESTADO: 'VALID', COLUMNAS: 'ID_USUARIO' }
        ];
        
        this.filteredData = { ...this.data };
        this.populateFilters();
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'block' : 'none';
        }
    }

    showError(message) {
        const container = document.querySelector('.col-lg-9') || document.querySelector('main') || document.body;
        container.innerHTML = DictionaryCore.html`
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Error:</strong> ${message}
                <br><small>Asegúrate de que los archivos CSV estén en el mismo directorio que este HTML.</small>
            </div>
        `;
    }

    setupEventListeners() {
        // Búsquedas
        document.getElementById('tabla-search')?.addEventListener('input', (e) => {
            this.filterData('tablas', e.target.value, 'TABLA');
        });

        document.getElementById('columna-search')?.addEventListener('input', (e) => {
            this.filterData('columnas', e.target.value, 'COLUMNA');
        });

        document.getElementById('restriccion-search')?.addEventListener('input', (e) => {
            this.filterData('restricciones', e.target.value, 'NOMBRE_RESTRICCION');
        });

        document.getElementById('indice-search')?.addEventListener('input', (e) => {
            this.filterData('indices', e.target.value, 'NOMBRE_INDICE');
        });

        // Filtros
        document.getElementById('tabla-filter')?.addEventListener('change', (e) => {
            this.filterColumnsByTable(e.target.value);
        });

        document.getElementById('tipo-restriccion-filter')?.addEventListener('change', (e) => {
            this.filterData('restricciones', e.target.value, 'TIPO_DESCRIPCION');
        });

        document.getElementById('unicidad-filter')?.addEventListener('change', (e) => {
            this.filterData('indices', e.target.value, 'UNICIDAD');
        });
    }

    populateFilters() {
        // Llenar filtro de tablas
        const tablaFilter = document.getElementById('tabla-filter');
        if (tablaFilter && this.data.tablas.length > 0) {
            const tablas = [...new Set(this.data.tablas.map(t => t.TABLA))].sort();
            tablaFilter.innerHTML = '<option value="">Filtrar por tabla...</option>';
            tablas.forEach(tabla => {
                tablaFilter.innerHTML += DictionaryCore.html`<option value="${tabla}">${tabla}</option>`;
            });
        }
    }

    showSection(section) {
        document.body.dataset.section = section;
        // Ocultar todas las secciones
        document.querySelectorAll('.content-section').forEach(el => {
            el.style.display = 'none';
        });

        // Remover clase active de todos los nav-links
        document.querySelectorAll('.sidebar .nav-link').forEach(el => {
            el.classList.remove('active');
        });

        // Mostrar sección seleccionada
        const sectionElement = document.getElementById(`${section}-section`);
        if (sectionElement) {
            sectionElement.style.display = 'block';
        }

        // Activar nav-link correspondiente
        document.querySelector(`[onclick="showSection('${section}')"]`)?.classList.add('active');

        this.currentSection = section;

        // Cargar datos de la sección
        if (section !== 'resumen') {
            this.loadSectionData(section);
        }
    }

    loadSectionData(section) {
        const data = this.filteredData[section] || [];
        
        switch (section) {
            case 'tablas':
                this.renderTablasTable(data);
                break;
            case 'columnas':
                this.renderColumnasTable(data);
                break;
            case 'restricciones':
                this.renderRestriccionesTable(data);
                break;
            case 'indices':
                this.renderIndicesTable(data);
                break;
        }
    }

    renderTablasTable(data) {
        console.log('Renderizando tabla de tablas con', data.length, 'elementos');
        const tbody = document.getElementById('tablas-tbody');
        const pagination = document.getElementById('tablas-pagination');
        
        if (!tbody) {
            console.error('No se encontró el elemento tablas-tbody');
            return;
        }

        const page = this.currentPage.tablas;
        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = data.slice(startIndex, endIndex);

        tbody.innerHTML = '';

        pageData.forEach((row, index) => {
            const globalIndex = startIndex + index;
            const tableName = row.TABLA || 'N/A';
            const isSelected = this.selectedTables.has(tableName);
            
            const tr = document.createElement('tr');
            tr.innerHTML = DictionaryCore.html`
                <td>
                    <input type="checkbox" class="table-checkbox" 
                           id="table-check-${globalIndex}" 
                           data-table-name="${tableName}" 
                           ${isSelected ? 'checked' : ''}
                           onchange="updateSelectedTables()">
                </td>
                <td><button type="button" class="btn btn-link p-0 fw-bold text-start" data-action="details" title="Ver estructura">${tableName}</button></td>
                <td>${this.formatNumber(row.NUM_FILAS)}</td>
                <td><span class="badge badge-custom" style="background-color: #6c757d;">${row.TABLESPACE || 'N/A'}</span></td>
                <td><span class="badge badge-custom ${row.ESTADO === 'VALID' ? 'bg-success' : 'bg-warning'}">${row.ESTADO || 'N/A'}</span></td>
                <td>${this.formatDate(row.ULTIMO_ANALISIS)}</td>
            `;
            
            tr.querySelector('[data-action="details"]').addEventListener('click', () => this.showTableDetails(tableName));
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', event => {
                if (!event.target.closest('input, label, button, a')) this.showTableDetails(tableName);
            });

            if (isSelected) {
                tr.classList.add('selected-row');
            }
            
            tbody.appendChild(tr);
        });

        this.renderPagination('tablas', data.length, pagination);
        this.updateSelectedTablesUI();
        console.log('Tabla de tablas renderizada completamente');
    }

    showTableDetails(tableName) {
        const structure = this.getSelectedTablesStructure([tableName]);
        if (!structure.length) {
            alert('No hay columnas disponibles para esta tabla');
            return;
        }
        DictionaryCore.showStructure(tableName, structure, () => this.exportToCSV(structure, `estructura_${tableName}.csv`));
    }

    renderColumnasTable(data) {
        const tbody = document.getElementById('columnas-tbody');
        const pagination = document.getElementById('columnas-pagination');
        
        if (!tbody) return;

        const page = this.currentPage.columnas;
        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = data.slice(startIndex, endIndex);

        tbody.innerHTML = '';

        pageData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = DictionaryCore.html`
                <td><strong>${row.TABLA || 'N/A'}</strong></td>
                <td>${row.COLUMNA || 'N/A'}</td>
                <td><code>${row.TIPO_COMPLETO || row.TIPO_DATO || 'N/A'}</code></td>
                <td><span class="badge badge-custom ${row.PERMITE_NULOS === 'N' ? 'bg-danger' : 'bg-success'}">${row.PERMITE_NULOS === 'N' ? 'NO' : 'SÍ'}</span></td>
                <td>${row.POSICION || 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });

        this.renderPagination('columnas', data.length, pagination);
    }

    renderRestriccionesTable(data) {
        const tbody = document.getElementById('restricciones-tbody');
        const pagination = document.getElementById('restricciones-pagination');
        
        if (!tbody) return;

        const page = this.currentPage.restricciones;
        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = data.slice(startIndex, endIndex);

        tbody.innerHTML = '';

        pageData.forEach(row => {
            const tr = document.createElement('tr');
            const tipoBadgeClass = this.getConstraintBadgeClass(row.TIPO_DESCRIPCION);
            
            tr.innerHTML = DictionaryCore.html`
                <td><strong>${row.TABLA || 'N/A'}</strong></td>
                <td>${row.NOMBRE_RESTRICCION || 'N/A'}</td>
                <td><span class="badge badge-custom ${tipoBadgeClass}">${row.TIPO_DESCRIPCION || row.TIPO || 'N/A'}</span></td>
                <td><span class="badge badge-custom ${row.ESTADO === 'ENABLED' ? 'bg-success' : 'bg-warning'}">${row.ESTADO || 'N/A'}</span></td>
                <td><small>${row.COLUMNAS || 'N/A'}</small></td>
            `;
            tbody.appendChild(tr);
        });

        this.renderPagination('restricciones', data.length, pagination);
    }

    renderIndicesTable(data) {
        const tbody = document.getElementById('indices-tbody');
        const pagination = document.getElementById('indices-pagination');
        
        if (!tbody) return;

        const page = this.currentPage.indices;
        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = data.slice(startIndex, endIndex);

        tbody.innerHTML = '';

        pageData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = DictionaryCore.html`
                <td><strong>${row.TABLA || 'N/A'}</strong></td>
                <td>${row.NOMBRE_INDICE || 'N/A'}</td>
                <td>${row.TIPO_INDICE || 'N/A'}</td>
                <td><span class="badge badge-custom ${row.UNICIDAD === 'UNIQUE' ? 'badge-unique' : 'bg-secondary'}">${row.UNICIDAD || 'N/A'}</span></td>
                <td><span class="badge badge-custom ${row.ESTADO === 'VALID' ? 'bg-success' : 'bg-warning'}">${row.ESTADO || 'N/A'}</span></td>
                <td><small>${row.COLUMNAS || 'N/A'}</small></td>
            `;
            tbody.appendChild(tr);
        });

        this.renderPagination('indices', data.length, pagination);
    }

    getConstraintBadgeClass(tipo) {
        switch (tipo) {
            case 'PRIMARY KEY': return 'badge-primary-key';
            case 'FOREIGN KEY': return 'badge-foreign-key';
            case 'UNIQUE': return 'badge-unique';
            case 'CHECK': return 'badge-check';
            default: return 'bg-secondary';
        }
    }

    renderPagination(section, totalItems, paginationElement) {
        if (!paginationElement) return;

        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const currentPage = this.currentPage[section];

        if (totalPages <= 1) {
            paginationElement.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // Botón anterior
        paginationHTML += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="diccionario.changePage('${section}', ${currentPage - 1}); return false;">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;

        // Páginas
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="diccionario.changePage('${section}', ${i}); return false;">${i}</a>
                </li>
            `;
        }

        // Botón siguiente
        paginationHTML += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="diccionario.changePage('${section}', ${currentPage + 1}); return false;">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;

        paginationElement.innerHTML = paginationHTML;
    }

    changePage(section, page) {
        this.currentPage[section] = page;
        this.loadSectionData(section);
    }

    filterData(section, searchTerm, field) {
        if (!searchTerm) {
            this.filteredData[section] = [...this.data[section]];
        } else {
            this.filteredData[section] = this.data[section].filter(item => 
                (item[field] || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        this.currentPage[section] = 1;
        this.loadSectionData(section);
    }

    filterColumnsByTable(tableName) {
        if (!tableName) {
            this.filteredData.columnas = [...this.data.columnas];
        } else {
            this.filteredData.columnas = this.data.columnas.filter(item => 
                item.TABLA === tableName
            );
        }
        
        this.currentPage.columnas = 1;
        this.loadSectionData('columnas');
    }

    formatNumber(num) {
        if (num === null || num === undefined || num === '') return 'Sin estadisticas';
        const parsed = Number(num);
        return Number.isFinite(parsed) ? parsed.toLocaleString('es-CO') : 'N/A';
    }

    formatDate(dateStr) {
        if (!dateStr || dateStr === 'N/A') return 'N/A';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('es-ES');
        } catch {
            return dateStr;
        }
    }

    exportData(section, format) {
        const data = this.filteredData[section] || [];
        
        if (format === 'csv') {
            const filename = `${section}_completo.csv`;
            this.exportToCSV(data, filename);
        }
    }

    exportToCSV(data, filename) {
        if (!data.length) { alert('No hay datos para exportar'); return; }
        const blob = new Blob([DictionaryCore.serializeCSV(data, ',')], {type: 'text/csv;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    updateSelectedTablesUI() {
        const checkboxes = document.querySelectorAll('.table-checkbox');
        
        // Actualizar el Set de tablas seleccionadas
        checkboxes.forEach(checkbox => {
            const tableName = checkbox.getAttribute('data-table-name');
            if (checkbox.checked) {
                this.selectedTables.add(tableName);
            } else {
                this.selectedTables.delete(tableName);
            }
        });
        
        const selectedCount = this.selectedTables.size;
        
        // Actualizar contadores
        const countElement = document.getElementById('selected-count');
        if (countElement) {
            countElement.textContent = selectedCount;
        }
        
        const countListElement = document.getElementById('selected-count-list');
        if (countListElement) {
            countListElement.textContent = selectedCount;
        }
        
        // Habilitar/deshabilitar botones de descarga
        const exportBtn = document.getElementById('export-selected-btn');
        if (exportBtn) {
            exportBtn.disabled = selectedCount === 0;
        }
        
        const exportListBtn = document.getElementById('export-selected-list-btn');
        if (exportListBtn) {
            exportListBtn.disabled = selectedCount === 0;
        }
        
        // Actualizar checkbox "seleccionar todas" para la página actual
        const selectAllChecks = [
            document.getElementById('select-all-tables'),
            document.getElementById('select-all-header')
        ];
        
        const visibleChecked = Array.from(checkboxes).filter(cb => cb.checked).length;
        const allVisible = checkboxes.length > 0 && visibleChecked === checkboxes.length;
        const someVisible = visibleChecked > 0 && visibleChecked < checkboxes.length;
        
        selectAllChecks.forEach(selectAll => {
            if (selectAll) {
                selectAll.checked = allVisible;
                selectAll.indeterminate = someVisible;
            }
        });
        
        // Resaltar filas seleccionadas
        checkboxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            if (row) {
                if (checkbox.checked) {
                    row.classList.add('selected-row');
                } else {
                    row.classList.remove('selected-row');
                }
            }
        });
    }

    getSelectedTables() {
        return Array.from(this.selectedTables);
    }

    exportSelectedTables() {
        const selectedTableNames = this.getSelectedTables();
        
        if (selectedTableNames.length === 0) {
            alert('No hay tablas seleccionadas para exportar');
            return;
        }
        
        // Obtener la estructura detallada de las tablas seleccionadas
        const tableStructures = this.getSelectedTablesStructure(selectedTableNames);
        
        if (tableStructures.length === 0) {
            alert('No se pudo obtener la estructura de las tablas seleccionadas');
            return;
        }
        
        // Crear nombre de archivo con las tablas incluidas
        let filename;
        if (selectedTableNames.length === 1) {
            filename = `estructura_${selectedTableNames[0]}.csv`;
        } else if (selectedTableNames.length <= 3) {
            filename = `estructura_${selectedTableNames.join('_')}.csv`;
        } else {
            filename = `estructura_${selectedTableNames.length}_tablas.csv`;
        }
        
        this.exportToCSV(tableStructures, filename);
        
        // Mostrar mensaje de confirmación
        alert(`Se ha exportado la estructura detallada de ${selectedTableNames.length} tablas: ${selectedTableNames.join(', ')}`);
    }

    getSelectedTablesStructure(selectedTableNames) {
        const structures = [];
        
        selectedTableNames.forEach(tableName => {
            // Obtener columnas de esta tabla
            const tableColumns = this.data.columnas.filter(col =>
                col.TABLA === tableName
            );
            
            // Obtener restricciones de esta tabla
            const tableConstraints = this.data.restricciones.filter(rest =>
                rest.TABLA === tableName
            );
            
            // Crear estructura para cada columna
            tableColumns.forEach(column => {
                // Buscar si esta columna tiene restricciones
                const primaryKey = tableConstraints.find(c => 
                    DictionaryCore.constraintType(c) === 'P' &&
                    DictionaryCore.hasColumn(c, column.COLUMNA)
                );
                
                const foreignKey = tableConstraints.find(c => 
                    DictionaryCore.constraintType(c) === 'R' &&
                    DictionaryCore.hasColumn(c, column.COLUMNA)
                );
                
                const uniqueConstraint = tableConstraints.find(c => 
                    DictionaryCore.constraintType(c) === 'U' &&
                    DictionaryCore.hasColumn(c, column.COLUMNA)
                );
                
                // Crear registro de estructura
                const structure = {
                    'Tabla': tableName,
                    'Nombre de la variable': column.COLUMNA || '',
                    'Nombre abreviado': this.getAbbreviatedName(column.COLUMNA || ''),
                    'Llave primaria': primaryKey ? 'SÍ' : 'NO',
                    'Llave foránea': foreignKey ? 'SÍ' : 'NO',
                    'Campo Obligatorio': column.PERMITE_NULOS === 'N' ? 'SÍ' : 'NO',
                    'Dominio': this.extractDomain(column.TIPO_COMPLETO || ''),
                    'Tipo de datos': this.normalizeDataType(column.TIPO_COMPLETO || ''),
                    'Longitud': this.extractLength(column.TIPO_COMPLETO || ''),
                    'Regla de validación': this.getValidationRule(column, tableConstraints),
                    'Descripción': this.generateColumnDescription(column, primaryKey, foreignKey),
                    'Observaciones': this.generateObservations(column, tableConstraints)
                };
                
                structures.push(structure);
            });
        });
        
        return structures;
    }

    getAbbreviatedName(columnName) {
        // Crear nombre abreviado basado en el nombre de la columna
        if (!columnName) return '';
        
        // Reglas comunes de abreviación
        const words = columnName.split('_');
        if (words.length > 1) {
            return words.map(word => word.substring(0, 3).toUpperCase()).join('_');
        }
        
        return columnName.length > 8 ? 
            columnName.substring(0, 8).toUpperCase() : 
            columnName.toUpperCase();
    }

    extractDomain(dataType) {
        // Extraer dominio del tipo de datos
        if (!dataType) return '';
        
        if (dataType.includes('VARCHAR')) return 'Texto';
        if (dataType.includes('NUMBER')) return 'Numérico';
        if (dataType.includes('DATE')) return 'Fecha';
        if (dataType.includes('TIMESTAMP')) return 'Fecha/Hora';
        if (dataType.includes('CLOB')) return 'Texto Largo';
        if (dataType.includes('BLOB')) return 'Binario';
        
        return 'Otro';
    }

    normalizeDataType(dataType) {
        // Normalizar tipo de datos
        if (!dataType) return '';
        
        if (dataType.includes('VARCHAR2')) return 'VARCHAR2';
        if (dataType.includes('NUMBER')) return 'NUMBER';
        if (dataType.includes('DATE')) return 'DATE';
        if (dataType.includes('TIMESTAMP')) return 'TIMESTAMP';
        if (dataType.includes('CLOB')) return 'CLOB';
        if (dataType.includes('BLOB')) return 'BLOB';
        
        return dataType;
    }

    extractLength(dataType) {
        // Extraer longitud del tipo de datos
        if (!dataType) return '';
        
        const match = dataType.match(/\(([^)]+)\)/);
        return match ? match[1] : '';
    }

    getValidationRule(column, constraints) {
        // Obtener reglas de validación
        const checkConstraints = constraints.filter(c => 
            DictionaryCore.constraintType(c) === 'C' &&
            DictionaryCore.hasColumn(c, column.COLUMNA)
        );
        
        if (checkConstraints.length > 0) {
            return checkConstraints.map(c => c.CONDICION_CHECK || c.RESTRICCION || c.NOMBRE_RESTRICCION).join(', ');
        }
        
        // Reglas básicas basadas en el tipo
        if (column.PERMITE_NULOS === 'N') {
            return 'Campo requerido';
        }
        
        return '';
    }

    generateColumnDescription(column, primaryKey, foreignKey) {
        // Generar descripción de la columna
        if (column.COMENTARIO) return column.COMENTARIO;
        let description = '';
        
        if (primaryKey) {
            description = (primaryKey.COLUMNAS || '').split(',').length > 1 ? 'Parte de llave primaria compuesta' : `Identificador único de la tabla ${column.TABLA}`;
        } else if (foreignKey) {
            description = `Referencia a otra tabla`;
        } else if (column.COLUMNA.includes('FECHA')) {
            description = 'Campo de fecha';
        } else if (column.COLUMNA.includes('NOMBRE')) {
            description = 'Campo de nombre';
        } else if (column.COLUMNA.includes('CODIGO')) {
            description = 'Campo de código';
        } else {
            description = `Campo ${column.COLUMNA.toLowerCase()} de la tabla ${column.TABLA}`;
        }
        
        return 'Descripción sugerida: ' + description;
    }

    generateObservations(column, constraints) {
        // Generar observaciones adicionales
        const observations = [];
        const foreignKey = constraints.find(c => DictionaryCore.constraintType(c) === 'R' && DictionaryCore.hasColumn(c, column.COLUMNA));
        if (foreignKey?.TABLA_REFERENCIA) {
            observations.push(`Referencia: ${foreignKey.ESQUEMA_REFERENCIA}.${foreignKey.TABLA_REFERENCIA} (${foreignKey.COLUMNAS_REFERENCIA})`);
        }
        
        if (column.PERMITE_NULOS === 'N') {
            observations.push('Campo obligatorio');
        }
        
        const uniqueConstraint = constraints.find(c => 
            DictionaryCore.constraintType(c) === 'U' &&
            DictionaryCore.hasColumn(c, column.COLUMNA)
        );
        
        if (uniqueConstraint) {
            observations.push((uniqueConstraint.COLUMNAS || '').split(',').length > 1 ? 'Parte de restricción UNIQUE compuesta' : 'Valor único');
        }
        
        return observations.join(', ');
    }

    exportSelectedTablesList() {
        const selectedTableNames = this.getSelectedTables();
        
        if (selectedTableNames.length === 0) {
            alert('No hay tablas seleccionadas para exportar');
            return;
        }
        
        // Filtrar los datos básicos de las tablas seleccionadas
        const selectedData = this.data.tablas.filter(tabla =>
            selectedTableNames.includes(tabla.TABLA)
        );
        
        // Crear nombre de archivo con las tablas incluidas
        let filename;
        if (selectedTableNames.length === 1) {
            filename = `lista_${selectedTableNames[0]}.csv`;
        } else if (selectedTableNames.length <= 3) {
            filename = `lista_${selectedTableNames.join('_')}.csv`;
        } else {
            filename = `lista_${selectedTableNames.length}_tablas.csv`;
        }
        
        this.exportToCSV(selectedData, filename);
        
        // Mostrar mensaje de confirmación
        alert(`Se ha exportado la lista de ${selectedTableNames.length} tablas: ${selectedTableNames.join(', ')}`);
    }
}

// Funciones globales para manejo de checkboxes
function updateSelectedTables() {
    if (diccionario) {
        diccionario.updateSelectedTablesUI();
    }
}

function toggleAllTables(checked) {
    console.log('toggleAllTables llamada con:', checked);
    const checkboxes = document.querySelectorAll('.table-checkbox');
    console.log('Encontrados', checkboxes.length, 'checkboxes');
    checkboxes.forEach(checkbox => {
        checkbox.checked = checked;
        const tableName = checkbox.getAttribute('data-table-name');
        if (checked) {
            diccionario.selectedTables.add(tableName);
        } else {
            diccionario.selectedTables.delete(tableName);
        }
    });
    updateSelectedTables();
}

function exportSelectedTables() {
    if (diccionario) {
        diccionario.exportSelectedTables();
    }
}

function exportSelectedTablesList() {
    if (diccionario) {
        diccionario.exportSelectedTablesList();
    }
}

function clearAllSelections() {
    if (diccionario) {
        diccionario.selectedTables.clear();
        diccionario.updateSelectedTablesUI();
        // También desmarcar todos los checkboxes visibles
        const checkboxes = document.querySelectorAll('.table-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        // Desmarcar checkbox de seleccionar todas
        const selectAllChecks = [
            document.getElementById('select-all-tables'),
            document.getElementById('select-all-header')
        ];
        selectAllChecks.forEach(selectAll => {
            if (selectAll) {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            }
        });
        diccionario.updateSelectedTablesUI();
    }
}



// Función global para mostrar secciones
function showSection(section) {
    diccionario.showSection(section);
}

// Función global para exportar datos
function exportData(section, format) {
    diccionario.exportData(section, format);
}

// Inicializar la aplicación cuando se carga la página
function openMer() {
    try { sessionStorage.setItem('ape-mer-selection', JSON.stringify(diccionario?.getSelectedTables() || [])); } catch { /* The MER can also start without a transferred selection. */ }
    window.location.href = 'mer.html';
}

let diccionario;
document.addEventListener('DOMContentLoaded', () => {
    diccionario = new DiccionarioDatos();
});
