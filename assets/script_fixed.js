// Diccionario de Datos - JavaScript con datos embebidos
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
        this.searchTerms = {
            tablas: '',
            columnas: '',
            restricciones: '',
            indices: ''
        };
        this.filters = {
            tabla: '',
            tipoRestriccion: '',
            unicidad: ''
        };
        
        // Optimizaciones de rendimiento
        this.renderingCache = new Map();
        this.debounceTimers = new Map();
        
        // Índices optimizados para búsquedas rápidas
        this.indexes = {
            columnasByTable: new Map(),
            restriccionesByTable: new Map(),
            indicesByTable: new Map(),
            primaryKeysByTable: new Map(),
            foreignKeysByTable: new Map()
        };
        
        this.init();
    }

    async init() {
        try {
            console.log('Inicializando aplicación...');
            await this.loadData();
            this.setupEventListeners();
            this.showSection('resumen');
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

    detectLatestTimestamp() {
        return this.manifest?.timestamp || null;
    }

    async loadCSV(filename) {
        return DictionaryCore.loadCSV(filename);
    }

    parseCSV(text) {
        return DictionaryCore.parseCSV(text);
    }

        

    fixEncodingIssues(text) {
        // Corregir problemas comunes de codificación UTF-8 mal interpretada
        // Usar códigos de escape para evitar problemas de codificación en el editor
        return text
            .replace(/Ã¡/g, 'á')
            .replace(/Ã©/g, 'é')
            .replace(/Ã­/g, 'í')
            .replace(/Ã³/g, 'ó')
            .replace(/Ãº/g, 'ú')
            .replace(/Ã±/g, 'ñ')
            .replace(/Ã\u0081/g, 'Á')
            .replace(/Ã‰/g, 'É')
            .replace(/Ã\u008D/g, 'Í')
            .replace(/Ã"/g, 'Ó')
            .replace(/Ãš/g, 'Ú')
            .replace(/Ã'/g, 'Ñ')
            .replace(/Ã¼/g, 'ü')
            .replace(/Ã‡/g, 'Ç');
    }

    createOptimizedIndexes() {
        console.log('Creando índices optimizados para búsquedas rápidas...');
        const startTime = performance.now();
        
        // Limpiar índices existentes
        this.indexes.columnasByTable.clear();
        this.indexes.restriccionesByTable.clear();
        this.indexes.indicesByTable.clear();
        this.indexes.primaryKeysByTable.clear();
        this.indexes.foreignKeysByTable.clear();
        
        // Indexar columnas por tabla
        this.data.columnas.forEach(col => {
            const tabla = col.TABLA;
            if (!this.indexes.columnasByTable.has(tabla)) {
                this.indexes.columnasByTable.set(tabla, []);
            }
            this.indexes.columnasByTable.get(tabla).push(col);
        });
        
        // Indexar restricciones por tabla y tipo
        this.data.restricciones.forEach(rest => {
            const tabla = rest.TABLA;
            
            // Índice general por tabla
            if (!this.indexes.restriccionesByTable.has(tabla)) {
                this.indexes.restriccionesByTable.set(tabla, []);
            }
            this.indexes.restriccionesByTable.get(tabla).push(rest);
            
            // Índices específicos para PK y FK - usar campo TIPO que es más confiable
            const tipo = rest.TIPO;
            if (tipo === 'P') { // PRIMARY KEY
                if (!this.indexes.primaryKeysByTable.has(tabla)) {
                    this.indexes.primaryKeysByTable.set(tabla, []);
                }
                this.indexes.primaryKeysByTable.get(tabla).push(rest);
            } else if (tipo === 'R') { // FOREIGN KEY
                if (!this.indexes.foreignKeysByTable.has(tabla)) {
                    this.indexes.foreignKeysByTable.set(tabla, []);
                }
                this.indexes.foreignKeysByTable.get(tabla).push(rest);
            }
        });
        
        // Indexar índices por tabla
        this.data.indices.forEach(idx => {
            const tabla = idx.TABLA;
            if (!this.indexes.indicesByTable.has(tabla)) {
                this.indexes.indicesByTable.set(tabla, []);
            }
            this.indexes.indicesByTable.get(tabla).push(idx);
        });
        
        const endTime = performance.now();
        console.log(`Índices creados en ${(endTime - startTime).toFixed(2)}ms`);
        
        // Debug: Verificar que las Primary Keys se están identificando
        console.log('Primary Keys identificadas por tabla:', {
            totalTables: this.indexes.primaryKeysByTable.size,
            examples: Array.from(this.indexes.primaryKeysByTable.entries()).slice(0, 5)
        });
    }

    updateStats() {
        console.log('Actualizando estadísticas...');
        
        document.getElementById('total-tablas').textContent = this.formatNumber(this.data.tablas.length);
        document.getElementById('total-columnas').textContent = this.formatNumber(this.data.columnas.length);
        document.getElementById('total-restricciones').textContent = this.formatNumber(this.data.restricciones.length);
        document.getElementById('total-indices').textContent = this.formatNumber(this.data.indices.length);
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
                <br><small>Para resolver este problema, inicia un servidor local: <code>python -m http.server 8000</code></small>
            </div>
        `;
    }

    setupEventListeners() {
        console.log('Configurando event listeners optimizados...');
        
        // Búsquedas con debounce para mejor rendimiento
        const tablaSearch = document.getElementById('tabla-search');
        if (tablaSearch) {
            tablaSearch.addEventListener('input', (e) => {
                this.debounceSearch('tablas', e.target.value);
            });
        }

        const columnaSearch = document.getElementById('columna-search');
        if (columnaSearch) {
            columnaSearch.addEventListener('input', (e) => {
                this.debounceSearch('columnas', e.target.value);
            });
        }

        const restriccionSearch = document.getElementById('restriccion-search');
        if (restriccionSearch) {
            restriccionSearch.addEventListener('input', (e) => {
                this.debounceSearch('restricciones', e.target.value);
            });
        }

        const indiceSearch = document.getElementById('indice-search');
        if (indiceSearch) {
            indiceSearch.addEventListener('input', (e) => {
                this.debounceSearch('indices', e.target.value);
            });
        }

        // Filtros (sin debounce porque son selectores)
        const tablaFilter = document.getElementById('tabla-filter');
        if (tablaFilter) {
            tablaFilter.addEventListener('change', (e) => {
                this.filters.tabla = e.target.value;
                this.applyFiltersAndSearch('columnas');
            });
        }

        const tipoRestriccionFilter = document.getElementById('tipo-restriccion-filter');
        if (tipoRestriccionFilter) {
            tipoRestriccionFilter.addEventListener('change', (e) => {
                this.filters.tipoRestriccion = e.target.value;
                this.applyFiltersAndSearch('restricciones');
            });
        }

        const unicidadFilter = document.getElementById('unicidad-filter');
        if (unicidadFilter) {
            unicidadFilter.addEventListener('change', (e) => {
                this.filters.unicidad = e.target.value;
                this.applyFiltersAndSearch('indices');
            });
        }
    }

    debounceSearch(section, value) {
        // Limpiar timer anterior si existe
        if (this.debounceTimers.has(section)) {
            clearTimeout(this.debounceTimers.get(section));
        }
        
        // Crear nuevo timer con delay de 300ms
        const timer = setTimeout(() => {
            this.searchTerms[section] = value;
            this.applyFiltersAndSearch(section);
            this.debounceTimers.delete(section);
        }, 300);
        
        this.debounceTimers.set(section, timer);
    }

    populateFilters() {
        // Llenar filtro de tablas
        const tablaFilter = document.getElementById('tabla-filter');
        if (tablaFilter && this.data.tablas.length > 0) {
            const tablas = [...new Set(this.data.tablas.map(t => t.TABLA))].sort();
            tablaFilter.innerHTML = '<option value="">Todas las tablas...</option>';
            tablas.forEach(tabla => {
                tablaFilter.innerHTML += DictionaryCore.html`<option value="${tabla}">${tabla}</option>`;
            });
        }
    }

    applyFiltersAndSearch(section) {
        let filteredData = [...this.data[section]];
        
        // Aplicar búsqueda
        const searchTerm = this.searchTerms[section];
        if (searchTerm) {
            filteredData = filteredData.filter(item => {
                switch (section) {
                    case 'tablas':
                        return (item.TABLA || '').toLowerCase().includes(searchTerm.toLowerCase());
                    case 'columnas':
                        return (item.COLUMNA || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                               (item.TABLA || '').toLowerCase().includes(searchTerm.toLowerCase());
                    case 'restricciones':
                        return (item.NOMBRE_RESTRICCION || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                               (item.TABLA || '').toLowerCase().includes(searchTerm.toLowerCase());
                    case 'indices':
                        return (item.NOMBRE_INDICE || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                               (item.TABLA || '').toLowerCase().includes(searchTerm.toLowerCase());
                    default:
                        return true;
                }
            });
        }
        
        // Aplicar filtros específicos
        if (section === 'columnas' && this.filters.tabla) {
            filteredData = filteredData.filter(item => item.TABLA === this.filters.tabla);
        }
        
        if (section === 'restricciones' && this.filters.tipoRestriccion) {
            filteredData = filteredData.filter(item => 
                item.TIPO === this.filters.tipoRestriccion || 
                (item.TIPO_DESCRIPCION || '') === this.filters.tipoRestriccion
            );
        }
        
        if (section === 'indices' && this.filters.unicidad) {
            filteredData = filteredData.filter(item => item.UNICIDAD === this.filters.unicidad);
        }
        
        this.filteredData[section] = filteredData;
        this.currentPage[section] = 1;
        
        if (this.currentSection === section) {
            this.loadSectionData(section);
        }
    }

    showSection(section) {
        console.log(`Mostrando sección: ${section}`);
        
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
        console.log(`Cargando sección ${section} con ${data.length} registros`);
        
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
        const tbody = document.getElementById('tablas-tbody');
        const pagination = document.getElementById('tablas-pagination');
        
        if (!tbody) return;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data"><i class="fas fa-search"></i><br>No se encontraron resultados</td></tr>';
            if (pagination) pagination.innerHTML = '';
            return;
        }

        const page = this.currentPage.tablas;
        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = data.slice(startIndex, endIndex);

        // Usar DocumentFragment para operaciones DOM eficientes
        const fragment = document.createDocumentFragment();

        pageData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = DictionaryCore.html`
                <td>
                    <button type="button" class="btn btn-link p-0 fw-bold text-start" data-action="details">${row.TABLA || 'N/A'}</button>
                    <br><small class="text-muted">Clic para ver detalles</small>
                </td>
                <td>${this.formatNumber(row.NUM_FILAS)}</td>
                <td><span class="badge badge-custom" style="background-color: #6c757d;">${row.TABLESPACE || 'N/A'}</span></td>
                <td><span class="badge badge-custom ${row.ESTADO === 'VALID' ? 'bg-success' : 'bg-warning'}">${row.ESTADO || 'N/A'}</span></td>
                <td>${this.formatDate(row.ULTIMO_ANALISIS)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="details" title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success" data-action="download" title="Descargar detalles">
                        <i class="fas fa-download"></i>
                    </button>
                </td>
            `;

            tr.querySelectorAll('[data-action="details"]').forEach(button => button.addEventListener('click', () => this.showTableDetails(row.TABLA)));
            tr.querySelector('[data-action="download"]').addEventListener('click', () => this.downloadTableDetails(row.TABLA));
            
            // Hacer la fila clickeable
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    this.showTableDetails(row.TABLA);
                }
            });
            
            fragment.appendChild(tr);
        });

        // Una sola operación DOM
        tbody.innerHTML = '';
        tbody.appendChild(fragment);

        this.renderPagination('tablas', data.length, pagination);
    }

    renderColumnasTable(data) {
        const tbody = document.getElementById('columnas-tbody');
        const pagination = document.getElementById('columnas-pagination');
        
        if (!tbody) return;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data"><i class="fas fa-search"></i><br>No se encontraron resultados</td></tr>';
            if (pagination) pagination.innerHTML = '';
            return;
        }

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

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data"><i class="fas fa-search"></i><br>No se encontraron resultados</td></tr>';
            if (pagination) pagination.innerHTML = '';
            return;
        }

        const page = this.currentPage.restricciones;
        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = data.slice(startIndex, endIndex);

        tbody.innerHTML = '';

        pageData.forEach(row => {
            const tr = document.createElement('tr');
            const tipoBadgeClass = this.getConstraintBadgeClass(row.TIPO);
            
            tr.innerHTML = DictionaryCore.html`
                <td><strong>${row.TABLA || 'N/A'}</strong></td>
                <td>${row.NOMBRE_RESTRICCION || 'N/A'}</td>
                <td><span class="badge badge-custom ${tipoBadgeClass}">${row.TIPO_DESCRIPCION || this.getConstraintTypeName(row.TIPO) || 'N/A'}</span></td>
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

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data"><i class="fas fa-search"></i><br>No se encontraron resultados</td></tr>';
            if (pagination) pagination.innerHTML = '';
            return;
        }

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
            case 'P':
            case 'PRIMARY KEY': return 'badge-primary-key';
            case 'R':
            case 'FOREIGN KEY': return 'badge-foreign-key';
            case 'U':
            case 'UNIQUE': return 'badge-unique';
            case 'C':
            case 'CHECK': return 'badge-check';
            default: return 'bg-secondary';
        }
    }

    getConstraintTypeName(tipo) {
        switch (tipo) {
            case 'P': return 'PRIMARY KEY';
            case 'R': return 'FOREIGN KEY';
            case 'U': return 'UNIQUE';
            case 'C': return 'CHECK';
            default: return tipo;
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
            this.exportToCSV(data, `${section}_filtrado.csv`);
        }
    }

    exportToCSV(data, filename) {
        if (!data.length) { alert('No hay datos para exportar'); return; }
        const blob = new Blob([DictionaryCore.serializeCSV(data, ';')], {type: 'text/csv;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    showTableDetails(tableName) {
        console.log(`Mostrando detalles de la tabla: ${tableName}`);
        
        // Verificar cache primero
        let tableData;
        if (this.renderingCache.has(tableName)) {
            console.log(`Usando datos en cache para ${tableName}`);
            tableData = this.renderingCache.get(tableName);
        } else {
            console.log(`Generando datos para ${tableName}`);
            tableData = this.getTableDetailsData(tableName);
            // Guardar en cache
            this.renderingCache.set(tableName, tableData);
        }
        
        // Crear modal
        this.createTableDetailsModal(tableName, tableData);
    }

    getTableDetailsData(tableName) {
        console.log(`Procesando tabla ${tableName} con índices optimizados...`);
        const startTime = performance.now();
        
        // Usar índices optimizados para acceso rápido
        const columnas = this.indexes.columnasByTable.get(tableName) || [];
        const restricciones = this.indexes.restriccionesByTable.get(tableName) || [];
        const indices = this.indexes.indicesByTable.get(tableName) || [];
        const primaryKeys = this.indexes.primaryKeysByTable.get(tableName) || [];
        const foreignKeys = this.indexes.foreignKeysByTable.get(tableName) || [];
        
        console.log(`Datos obtenidos en ${(performance.now() - startTime).toFixed(2)}ms:`, {
            columnas: columnas.length,
            restricciones: restricciones.length,
            indices: indices.length,
            primaryKeys: primaryKeys.length,
            foreignKeys: foreignKeys.length
        });
        
        // Crear mapas optimizados para búsquedas O(1) - SOLO USAR RESTRICCIONES PARA PKs y FKs
        const pkColumnsMap = new Map();
        const fkColumnsMap = new Map();
        const checkConstraintsMap = new Map();
        const uniqueIndexMap = new Map(); // Este sí puede usar índices
        
        // Pre-procesar PK - USAR SOLO RESTRICCIONES
        primaryKeys.forEach(pk => {
            const columns = (pk.COLUMNAS || '').split(',').map(c => c.trim().toUpperCase());
            columns.forEach(col => {
                if (col) {
                    pkColumnsMap.set(col, pk);
                }
            });
        });
        
        // Pre-procesar FK - USAR SOLO RESTRICCIONES
        foreignKeys.forEach(fk => {
            const columns = (fk.COLUMNAS || '').split(',').map(c => c.trim().toUpperCase());
            columns.forEach(col => {
                if (col) {
                    fkColumnsMap.set(col, fk);
                }
            });
        });
        
        // Pre-procesar CHECK constraints - USAR SOLO RESTRICCIONES
        restricciones.forEach(rest => {
            if (rest.TIPO === 'C') {
                const columns = (rest.COLUMNAS || '').split(',').map(c => c.trim().toUpperCase());
                columns.forEach(col => {
                    if (col) {
                        if (!checkConstraintsMap.has(col)) {
                            checkConstraintsMap.set(col, []);
                        }
                        checkConstraintsMap.get(col).push(rest);
                    }
                });
            }
        });
        
        // Pre-procesar índices únicos - AQUÍ SÍ USAR ÍNDICES
        indices.forEach(idx => {
            if (idx.UNICIDAD === 'UNIQUE') {
                const columns = (idx.COLUMNAS || '').split(',').map(c => c.trim().toUpperCase());
                columns.forEach(col => {
                    if (col) {
                        uniqueIndexMap.set(col, idx);
                    }
                });
            }
        });
        
        // Debug específico para tabla DEMANDA
        if (tableName === 'DEMANDA') {
            console.log('=== DEBUG TABLA DEMANDA ===');
            console.log('Primary Keys encontradas:', primaryKeys.map(pk => ({
                nombre: pk.NOMBRE_RESTRICCION,
                tipo: pk.TIPO,
                columnas: pk.COLUMNAS
            })));
            console.log('Mapa PK creado:', Array.from(pkColumnsMap.entries()));
        }
        
        // Procesar columnas con acceso optimizado
        const tableDetails = columnas.map(col => {
            const columnName = (col.COLUMNA || '').toUpperCase();
            
            // Búsquedas O(1) usando mapas
            const isPrimaryKey = pkColumnsMap.has(columnName);
            const foreignKey = fkColumnsMap.get(columnName);
            const checkConstraints = checkConstraintsMap.get(columnName) || [];
            const uniqueIndex = uniqueIndexMap.get(columnName);
            
            // Debug detallado para cualquier tabla con problemas
            if (columnName.includes('_ID') && col.COLUMNA && col.COLUMNA.length <= 10) {
                console.log(`🔍 COLUMNA ${tableName}.${columnName}:`, {
                    nombreOriginal: col.COLUMNA,
                    nombreMayus: columnName,
                    esPK: isPrimaryKey,
                    pkMapTiene: pkColumnsMap.has(columnName),
                    todasLlavesPK: Array.from(pkColumnsMap.keys()),
                    restrictcionesPK: primaryKeys.map(pk => `${pk.NOMBRE_RESTRICCION}: ${pk.COLUMNAS}`)
                });
            }
            
            return {
                'Nombre de la variable': col.COLUMNA || '',
                'Nombre abreviado': this.getAbbreviatedName(col.COLUMNA),
                'Llave primaria': isPrimaryKey ? 'SÍ' : 'NO',
                'Llave foránea': foreignKey ? 'SÍ' : 'NO',
                'Campo Obligatorio': col.PERMITE_NULOS === 'N' ? 'SÍ' : 'NO',
                'Dominio': this.getDomainValues(col, checkConstraints),
                'Tipo de datos': this.getSimpleDataType(col.TIPO_COMPLETO || col.TIPO_DATO),
                'Longitud': this.getDataLength(col.TIPO_COMPLETO || col.TIPO_DATO),
                'Regla de validación': this.getValidationRule(col, checkConstraints, uniqueIndex),
                'Descripción': this.getColumnDescription(col, isPrimaryKey, foreignKey),
                'Observaciones': this.getColumnObservations(col, foreignKey, checkConstraints, uniqueIndex)
            };
        });
        
        const endTime = performance.now();
        console.log(`Procesamiento completado en ${(endTime - startTime).toFixed(2)}ms`);
        
        return tableDetails;
    }

    getAbbreviatedName(columnName) {
        if (!columnName) return '';
        // Crear abreviación basada en el nombre de columna
        if (columnName.length <= 8) return columnName;
        
        const parts = columnName.split('_');
        if (parts.length > 1) {
            return parts.map(part => part.substring(0, 3)).join('_').toUpperCase();
        }
        
        return columnName.substring(0, 8).toUpperCase();
    }

    getDomainValues(column, checkConstraints = []) {
        const conditions = checkConstraints.map(check => check.CONDICION_CHECK).filter(Boolean);
        if (conditions.length) return 'CHECK Oracle: ' + conditions.join('; ');
        return 'Dominio sugerido: ' + this.inferDomainValues(column, checkConstraints);
    }

    inferDomainValues(column, checkConstraints = []) {
        const columnName = (column.COLUMNA || '').toLowerCase();
        const dataType = (column.TIPO_COMPLETO || column.TIPO_DATO || '').toUpperCase();
        
        // Si hay restricciones CHECK, intentar extraer valores
        if (checkConstraints.length > 0) {
            for (const check of checkConstraints) {
                if (check.NOMBRE_RESTRICCION && check.NOMBRE_RESTRICCION.toLowerCase().includes('genero')) {
                    return 'Sugerido: M, F';
                }
                if (check.NOMBRE_RESTRICCION && check.NOMBRE_RESTRICCION.toLowerCase().includes('estado')) {
                    return 'ACTIVO, INACTIVO, PENDIENTE';
                }
            }
        }
        
        // Valores de dominio comunes basados en el nombre de columna
        if (columnName.includes('estado')) {
            return 'ACTIVO, INACTIVO, PENDIENTE, PROCESADO';
        }
        if (columnName.includes('tipo_documento')) {
            return 'CC, TI, CE, PA, RC';
        }
        if (columnName.includes('tipo')) {
            return 'Valores según catálogo';
        }
        if (columnName.includes('genero') || columnName.includes('sexo')) {
            return 'Sugerido: M, F';
        }
        if (columnName.includes('estado_civil')) {
            return 'Sugerido: SOLTERO, CASADO, DIVORCIADO, VIUDO, UNIÓN LIBRE';
        }
        if (columnName.includes('email') || columnName.includes('correo')) {
            return 'Formato: usuario@dominio.com';
        }
        if (columnName.includes('telefono') || columnName.includes('celular')) {
            return 'Formato: +57XXXXXXXXXX';
        }
        if (dataType.includes('DATE')) {
            return 'Fecha válida (YYYY-MM-DD)';
        }
        if (dataType.includes('NUMBER')) {
            const length = this.getDataLength(dataType);
            return `Valor numérico según ${dataType}`;
        }
        if (dataType.includes('VARCHAR')) {
            const length = this.getDataLength(dataType);
            return `Texto libre (máx. ${length} caracteres)`;
        }
        
        return 'Sin restricciones específicas';
    }

    getSimpleDataType(fullType) {
        if (!fullType) return 'N/A';
        
        if (fullType.includes('VARCHAR')) return 'Texto';
        if (fullType.includes('NUMBER')) return 'Numérico';
        if (fullType.includes('DATE')) return 'Fecha';
        if (fullType.includes('TIMESTAMP')) return 'Fecha/Hora';
        if (fullType.includes('CHAR')) return 'Texto';
        if (fullType.includes('CLOB')) return 'Texto largo';
        if (fullType.includes('BLOB')) return 'Binario';
        
        return fullType;
    }

    getDataLength(fullType) {
        if (!fullType) return 'N/A';
        
        const match = fullType.match(/\((\d+)(?:\s+(?:CHAR|BYTE)|,-?\d+)?\)/);
        if (match) {
            return match[1];
        }
        
        if (fullType.includes('DATE')) return '10';
        if (fullType.includes('TIMESTAMP')) return '19';
        
        return 'Variable';
    }

    getValidationRule(column, checkConstraints = [], uniqueIndex = null) {
        const columnName = (column.COLUMNA || '').toLowerCase();
        const dataType = (column.TIPO_COMPLETO || column.TIPO_DATO || '').toUpperCase();
        const rules = [];
        
        // Restricciones por ser NOT NULL
        if (column.PERMITE_NULOS === 'N') {
            rules.push('Campo obligatorio');
        }
        
        // Restricciones CHECK específicas
        if (checkConstraints.length > 0) {
            checkConstraints.forEach(check => {
                if (check.CONDICION_CHECK) { rules.push(check.CONDICION_CHECK); return; }
                const checkName = (check.NOMBRE_RESTRICCION || '').toLowerCase();
                if (checkName.includes('email') || checkName.includes('format')) {
                    rules.push('Formato de email válido');
                } else if (checkName.includes('genero')) {
                    rules.push('Solo valores M o F');
                } else if (checkName.includes('estado')) {
                    rules.push('Solo valores de catálogo de estados');
                } else {
                    rules.push('Restricción CHECK aplicada');
                }
            });
        }
        
        // Restricciones por índice único
        if (uniqueIndex) {
            rules.push((uniqueIndex.COLUMNAS || '').split(',').length > 1 ? 'Combinación de columnas única en la tabla' : 'Debe ser único en la tabla');
        }
        
        // Restricciones basadas en el nombre de columna
        if (columnName.includes('email') || columnName.includes('correo')) {
            if (!rules.some(r => r.includes('email'))) {
                rules.push('Formato de email válido');
            }
        }
        
        if (columnName.includes('documento') || columnName.includes('cedula')) {
            rules.push('Solo números, sin espacios ni caracteres especiales');
        }
        
        if (columnName.includes('telefono') || columnName.includes('celular')) {
            rules.push('Solo números, formato internacional opcional');
        }
        
        if (columnName.includes('codigo')) {
            rules.push('Código alfanumérico según estándar');
        }
        
        // Restricciones por tipo de dato
        if (dataType.includes('DATE')) {
            rules.push('Fecha válida en formato YYYY-MM-DD');
        }
        
        if (dataType.includes('NUMBER')) {
            const length = this.getDataLength(dataType);
            rules.push(`Valor numérico según ${dataType}`);
        }
        
        if (dataType.includes('VARCHAR')) {
            const length = this.getDataLength(dataType);
            rules.push(`Longitud máxima ${length} caracteres`);
        }
        
        return rules.length > 0 ? 'Validaciones Oracle y sugeridas: ' + rules.join('. ') : 'Sin validaciones específicas';
    }

    getColumnDescription(column, isPrimaryKey = false, foreignKey = null) {
        if (column.COMENTARIO) return column.COMENTARIO;
        return 'Descripci\u00f3n sugerida: ' + this.inferColumnDescription(column, isPrimaryKey, foreignKey);
    }

    inferColumnDescription(column, isPrimaryKey = false, foreignKey = null) {
        const columnName = (column.COLUMNA || '').toLowerCase();
        
        // Descripción específica para llaves
        if (isPrimaryKey) {
            return `Columna de la llave primaria de la tabla`;
        }
        
        if (foreignKey) {
            return `Referencia a otra tabla (clave foránea)`;
        }
        
        // Descripciones comunes basadas en nombres de columna
        if (columnName.includes('id_') && !isPrimaryKey) {
            const entity = columnName.replace('id_', '').replace('_', ' ');
            return `Identificador de ${entity}`;
        }
        
        if (columnName.includes('numero_documento')) {
            return 'Número de documento de identificación personal';
        }
        
        if (columnName.includes('tipo_documento')) {
            return 'Tipo de documento de identificación';
        }
        
        if (columnName.includes('nombres')) {
            return 'Nombres completos de la persona';
        }
        
        if (columnName.includes('apellidos')) {
            return 'Apellidos completos de la persona';
        }
        
        if (columnName.includes('email') || columnName.includes('correo')) {
            return 'Dirección de correo electrónico';
        }
        
        if (columnName.includes('telefono') || columnName.includes('celular')) {
            return 'Número de teléfono de contacto';
        }
        
        if (columnName.includes('fecha_nacimiento')) {
            return 'Fecha de nacimiento de la persona';
        }
        
        if (columnName.includes('genero')) {
            return 'Género de la persona (M/F)';
        }
        
        if (columnName.includes('estado_civil')) {
            return 'Estado civil actual de la persona';
        }
        
        if (columnName.includes('fecha_creacion')) {
            return 'Fecha de creación del registro (auditoría)';
        }
        
        if (columnName.includes('usuario_creacion')) {
            return 'Usuario que creó el registro (auditoría)';
        }
        
        if (columnName.includes('fecha_cruce')) {
            return 'Fecha en que se realizó el cruce de información';
        }
        
        if (columnName.includes('estado_cruce')) {
            return 'Estado actual del proceso de cruce';
        }
        
        if (columnName.includes('observaciones')) {
            return 'Comentarios o notas adicionales';
        }
        
        if (columnName.includes('codigo_cno')) {
            return 'Código de la Clasificación Nacional de Ocupaciones';
        }
        
        if (columnName.includes('descripcion_cno')) {
            return 'Descripción de la ocupación según CNO';
        }
        
        if (columnName.includes('nivel')) {
            return 'Nivel jerárquico o de clasificación';
        }
        
        if (columnName.includes('codigo_padre')) {
            return 'Código del elemento padre en la jerarquía';
        }
        
        if (columnName.includes('estado')) {
            return 'Estado actual del registro';
        }
        
        if (columnName.includes('descripcion')) {
            return 'Descripción detallada del elemento';
        }
        
        if (columnName.includes('codigo')) {
            return 'Código identificador único';
        }
        
        // Descripción genérica
        return `Campo de datos: ${column.COLUMNA}`;
    }

    getColumnObservations(column, foreignKey = null, checkConstraints = [], uniqueIndex = null) {
        let observations = [];
        
        // Observaciones para llaves foráneas
        if (foreignKey) {
            observations.push(`Referencia FK: ${foreignKey.NOMBRE_RESTRICCION}`);
            if (foreignKey.TABLA_REFERENCIA) {
                observations.push(`Destino: ${foreignKey.ESQUEMA_REFERENCIA}.${foreignKey.TABLA_REFERENCIA} (${foreignKey.COLUMNAS_REFERENCIA})`);
            }
        }
        
        // Observaciones para campos obligatorios
        if (column.PERMITE_NULOS === 'N') {
            observations.push('Campo requerido');
        }
        
        // Observaciones para restricciones CHECK
        if (checkConstraints.length > 0) {
            checkConstraints.forEach(check => {
                observations.push(`Check: ${check.NOMBRE_RESTRICCION}`);
            });
        }
        
        // Observaciones para índices únicos
        if (uniqueIndex) {
            observations.push(`Índice único: ${uniqueIndex.NOMBRE_INDICE}`);
        }
        
        const columnName = (column.COLUMNA || '').toLowerCase();
        
        // Observaciones específicas por tipo de campo
        if (columnName.includes('fecha_creacion') || columnName.includes('fecha_registro')) {
            observations.push('Campo de auditoría - Creación');
        }
        
        if (columnName.includes('usuario_') || columnName.includes('creado_por')) {
            observations.push('Campo de auditoría - Usuario');
        }
        
        if (columnName.includes('fecha_modificacion') || columnName.includes('fecha_actualizacion')) {
            observations.push('Campo de auditoría - Modificación');
        }
        
        if (columnName.includes('version') || columnName.includes('timestamp')) {
            observations.push('Control de concurrencia');
        }
        
        if (columnName.includes('activo') || columnName.includes('habilitado')) {
            observations.push('Control de estado lógico');
        }
        
        if (columnName.includes('hash') || columnName.includes('token')) {
            observations.push('Campo de seguridad');
        }
        
        if (columnName.includes('temp_') || columnName.includes('temporal')) {
            observations.push('Campo temporal/proceso');
        }
        
        // Observaciones por tipo de dato
        const dataType = (column.TIPO_COMPLETO || column.TIPO_DATO || '').toUpperCase();
        if (dataType.includes('CLOB') || dataType.includes('TEXT')) {
            observations.push('Campo de texto largo');
        }
        
        if (dataType.includes('BLOB') || dataType.includes('BINARY')) {
            observations.push('Campo binario/archivo');
        }
        
        if (dataType.includes('TIMESTAMP')) {
            observations.push('Incluye información de hora');
        }
        
        // Observaciones de posición
        if (column.POSICION === '1') {
            observations.push('Primera columna de la tabla');
        }
        
        return observations.length > 0 ? observations.join('. ') : 'Sin observaciones especiales';
    }

    createTableDetailsModal(tableName, tableData) {
        if (typeof bootstrap === 'undefined') {
            return DictionaryCore.showStructure(tableName, tableData, () => this.downloadTableDetails(tableName));
        }
        document.getElementById('tableDetailsModal')?.remove();
        const element = document.createElement('div');
        element.id = 'tableDetailsModal';
        element.className = 'modal fade dictionary-structure-modal';
        element.tabIndex = -1;
        element.setAttribute('aria-labelledby', 'tableDetailsModalLabel');
        element.innerHTML = '<div class="modal-dialog modal-dialog-centered"><div class="modal-content dictionary-structure-content"></div></div>';
        const content = element.querySelector('.modal-content');
        content.innerHTML = DictionaryCore.structureMarkup(tableName, tableData);
        document.body.appendChild(element);
        const modal = new bootstrap.Modal(element);
        DictionaryCore.bindStructure(content, tableData, () => this.downloadTableDetails(tableName), () => modal.hide());
        element.addEventListener('hidden.bs.modal', () => { modal.dispose(); element.remove(); }, {once: true});
        modal.show();
    }

    generateTableDetailsRows(tableData) {
        return tableData.map(row => {
            return DictionaryCore.html`
                <tr>
                    <td><strong>${row['Nombre de la variable']}</strong></td>
                    <td><code>${row['Nombre abreviado']}</code></td>
                    <td><span class="badge ${row['Llave primaria'] === 'SÍ' ? 'bg-warning' : 'bg-secondary'}">${row['Llave primaria']}</span></td>
                    <td><span class="badge ${row['Llave foránea'] === 'SÍ' ? 'bg-info' : 'bg-secondary'}">${row['Llave foránea']}</span></td>
                    <td><span class="badge ${row['Campo Obligatorio'] === 'SÍ' ? 'bg-danger' : 'bg-success'}">${row['Campo Obligatorio']}</span></td>
                    <td><small>${row['Dominio']}</small></td>
                    <td><span class="badge bg-primary">${row['Tipo de datos']}</span></td>
                    <td>${row['Longitud']}</td>
                    <td><small>${row['Regla de validación']}</small></td>
                    <td><small>${row['Descripción']}</small></td>
                    <td><small>${row['Observaciones']}</small></td>
                </tr>
            `;
        }).join('');
    }

    downloadTableDetails(tableName) {
        const tableData = this.getTableDetailsData(tableName);
        
        if (tableData.length === 0) {
            alert('No hay datos para exportar de esta tabla');
            return;
        }

        const filename = `detalles_${tableName}_${new Date().toISOString().slice(0, 10)}.csv`;
        this.exportToCSV(tableData, filename);
    }
}

// Funciones globales
function showSection(section) {
    if (window.diccionario) {
        window.diccionario.showSection(section);
    }
}

function exportData(section, format) {
    if (window.diccionario) {
        window.diccionario.exportData(section, format);
    }
}

function showTableDetails(tableName) {
    if (window.diccionario) {
        window.diccionario.showTableDetails(tableName);
    }
}

function downloadTableDetails(tableName) {
    if (window.diccionario) {
        window.diccionario.downloadTableDetails(tableName);
    }
}

// Inicializar la aplicación cuando se carga la página
function openMer() {
    window.location.href = 'mer.html';
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, inicializando aplicación...');
    window.diccionario = new DiccionarioDatos();
});
