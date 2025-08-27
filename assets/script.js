// Diccionario de Datos - JavaScript Corregido
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
            this.showError('Error cargando los datos del diccionario');
        }
    }

    async loadData() {
        this.showLoading(true);
        
        try {
            console.log('Cargando datos desde la carpeta data...');
            
            // Detectar archivos CSV automáticamente
            const timestamp = this.detectTimestamp();
            console.log('Timestamp detectado:', timestamp);
            
            const [tablasData, columnasData, restriccionesData, indicesData] = await Promise.all([
                this.loadCSV(`data/tablas_spe_${timestamp}.csv`),
                this.loadCSV(`data/columnas_spe_${timestamp}.csv`),
                this.loadCSV(`data/restricciones_spe_${timestamp}.csv`),
                this.loadCSV(`data/indices_spe_${timestamp}.csv`)
            ]);

            this.data.tablas = tablasData;
            this.data.columnas = columnasData;
            this.data.restricciones = restriccionesData;
            this.data.indices = indicesData;

            console.log('Datos cargados:', {
                tablas: this.data.tablas.length,
                columnas: this.data.columnas.length,
                restricciones: this.data.restricciones.length,
                indices: this.data.indices.length
            });

            // Inicializar datos filtrados
            this.filteredData = {
                tablas: [...this.data.tablas],
                columnas: [...this.data.columnas],
                restricciones: [...this.data.restricciones],
                indices: [...this.data.indices]
            };
            
            // Llenar filtros
            this.populateFilters();
            
            // Actualizar estadísticas en las cards
            this.updateStats();
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            // Si no se pueden cargar los datos, mostrar datos de ejemplo
            this.loadSampleData();
        } finally {
            this.showLoading(false);
        }
    }

    detectTimestamp() {
        // Timestamp del archivo generado más reciente
        return '20250827_144418';
    }

    async loadCSV(filename) {
        try {
            console.log(`Cargando archivo: ${filename}`);
            const response = await fetch(filename);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            const parsed = this.parseCSV(text);
            console.log(`Archivo ${filename} cargado: ${parsed.length} registros`);
            return parsed;
        } catch (error) {
            console.warn(`No se pudo cargar ${filename}:`, error);
            return [];
        }
    }

    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];
        
        const headers = this.parseCSVLine(lines[0]);
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index]?.trim() || '';
                });
                data.push(row);
            }
        }
        
        return data;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    loadSampleData() {
        console.log('Cargando datos de ejemplo...');
        
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
        
        this.filteredData = {
            tablas: [...this.data.tablas],
            columnas: [...this.data.columnas],
            restricciones: [...this.data.restricciones],
            indices: [...this.data.indices]
        };
        
        this.populateFilters();
        this.updateStats();
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
        const container = document.querySelector('.col-lg-9');
        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Error:</strong> ${message}
                <br><small>Asegúrate de que los archivos CSV estén en la carpeta "data".</small>
            </div>
        `;
    }

    setupEventListeners() {
        console.log('Configurando event listeners...');
        
        // Búsquedas
        const tablaSearch = document.getElementById('tabla-search');
        if (tablaSearch) {
            tablaSearch.addEventListener('input', (e) => {
                this.searchTerms.tablas = e.target.value;
                this.applyFiltersAndSearch('tablas');
            });
        }

        const columnaSearch = document.getElementById('columna-search');
        if (columnaSearch) {
            columnaSearch.addEventListener('input', (e) => {
                this.searchTerms.columnas = e.target.value;
                this.applyFiltersAndSearch('columnas');
            });
        }

        const restriccionSearch = document.getElementById('restriccion-search');
        if (restriccionSearch) {
            restriccionSearch.addEventListener('input', (e) => {
                this.searchTerms.restricciones = e.target.value;
                this.applyFiltersAndSearch('restricciones');
            });
        }

        const indiceSearch = document.getElementById('indice-search');
        if (indiceSearch) {
            indiceSearch.addEventListener('input', (e) => {
                this.searchTerms.indices = e.target.value;
                this.applyFiltersAndSearch('indices');
            });
        }

        // Filtros
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

    populateFilters() {
        // Llenar filtro de tablas
        const tablaFilter = document.getElementById('tabla-filter');
        if (tablaFilter && this.data.tablas.length > 0) {
            const tablas = [...new Set(this.data.tablas.map(t => t.TABLA))].sort();
            tablaFilter.innerHTML = '<option value="">Filtrar por tabla...</option>';
            tablas.forEach(tabla => {
                tablaFilter.innerHTML += `<option value="${tabla}">${tabla}</option>`;
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
                (item.TIPO_DESCRIPCION || item.TIPO || '') === this.filters.tipoRestriccion
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
        if (event?.target) {
            event.target.classList.add('active');
        }

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

        tbody.innerHTML = '';

        pageData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.TABLA || 'N/A'}</strong></td>
                <td>${this.formatNumber(row.NUM_FILAS)}</td>
                <td><span class="badge badge-custom" style="background-color: #6c757d;">${row.TABLESPACE || 'N/A'}</span></td>
                <td><span class="badge badge-custom ${row.ESTADO === 'VALID' ? 'bg-success' : 'bg-warning'}">${row.ESTADO || 'N/A'}</span></td>
                <td>${this.formatDate(row.ULTIMO_ANALISIS)}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button type="button" class="btn btn-sm btn-outline-info" onclick="downloadTableDetails('${row.TABLA}')" title="Descargar detalles CSV">
                            <i class="fas fa-download"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-success" onclick="downloadTableDetailsExcel('${row.TABLA}')" title="Descargar detalles Excel">
                            <i class="fas fa-file-excel"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

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
            tr.innerHTML = `
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
            const tipoBadgeClass = this.getConstraintBadgeClass(row.TIPO_DESCRIPCION || row.TIPO);
            
            tr.innerHTML = `
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
            tr.innerHTML = `
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

    formatNumber(num) {
        if (!num || num === 'N/A' || num === '0') return '0';
        const parsed = parseInt(num);
        return isNaN(parsed) ? '0' : parsed.toLocaleString('es-ES');
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
        } else if (format === 'excel') {
            this.exportToExcel(data, `${section}_filtrado.xls`);
        }
    }

    exportToCSV(data, filename) {
        if (data.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','), // Usar coma estándar para CSV
            ...data.map(row => headers.map(header => {
                let value = (row[header] || '').toString();
                // Escapar comillas duplicándolas y encerrar en comillas si contiene coma o comillas
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(','))
        ].join('\r\n'); // Usar CRLF para Windows

        // Agregar BOM para UTF-8 para mejor compatibilidad con Excel
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    exportToExcel(data, filename) {
        if (data.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        // Crear archivo Excel usando formato HTML con encoding
        const headers = Object.keys(data[0]);
        let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
            <style>
                .text { mso-number-format:"\\@"; }
                .number { mso-number-format:"0"; }
            </style>
        </head>
        <body>
        <table border="1">
            <tr>`;
        
        // Agregar encabezados
        headers.forEach(header => {
            htmlContent += `<th style="background-color: #4CAF50; color: white; font-weight: bold;">${header}</th>`;
        });
        htmlContent += '</tr>';
        
        // Agregar datos
        data.forEach(row => {
            htmlContent += '<tr>';
            headers.forEach(header => {
                const value = row[header] || '';
                const className = isNaN(value) ? 'text' : 'number';
                htmlContent += `<td class="${className}">${value}</td>`;
            });
            htmlContent += '</tr>';
        });
        
        htmlContent += '</table></body></html>';
        
        // Agregar BOM para UTF-8
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + htmlContent], { 
            type: 'application/vnd.ms-excel;charset=utf-8' 
        });
        
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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

    downloadTableDetailsExcel(tableName) {
        const tableData = this.getTableDetailsData(tableName);
        
        if (tableData.length === 0) {
            alert('No hay datos para exportar de esta tabla');
            return;
        }

        const filename = `detalles_${tableName}_${new Date().toISOString().slice(0, 10)}.xls`;
        this.exportToExcel(tableData, filename);
    }

    getTableDetailsData(tableName) {
        // Obtener datos combinados de la tabla específica
        const tableData = [];
        
        // Agregar información de la tabla
        const tablaInfo = this.data.tablas.find(t => t.TABLA === tableName);
        if (tablaInfo) {
            tableData.push({
                Tipo: 'TABLA',
                Nombre: tableName,
                Descripcion: `Filas: ${tablaInfo.NUM_FILAS || 0}, Tablespace: ${tablaInfo.TABLESPACE || 'N/A'}`,
                Estado: tablaInfo.ESTADO || 'N/A'
            });
        }
        
        // Agregar columnas
        const columnas = this.data.columnas.filter(c => c.TABLA === tableName);
        columnas.forEach(col => {
            tableData.push({
                Tipo: 'COLUMNA',
                Nombre: col.COLUMNA,
                Descripcion: `Tipo: ${col.TIPO_COMPLETO}, Nulos: ${col.PERMITE_NULOS}`,
                Estado: `Posición: ${col.POSICION}`
            });
        });
        
        // Agregar restricciones
        const restricciones = this.data.restricciones.filter(r => r.TABLA === tableName);
        restricciones.forEach(rest => {
            tableData.push({
                Tipo: 'RESTRICCION',
                Nombre: rest.NOMBRE_RESTRICCION,
                Descripcion: `Tipo: ${rest.TIPO_DESCRIPCION}, Columnas: ${rest.COLUMNAS}`,
                Estado: rest.ESTADO
            });
        });
        
        // Agregar índices
        const indices = this.data.indices.filter(i => i.TABLA === tableName);
        indices.forEach(idx => {
            tableData.push({
                Tipo: 'INDICE',
                Nombre: idx.NOMBRE_INDICE,
                Descripcion: `Tipo: ${idx.TIPO_INDICE}, Columnas: ${idx.COLUMNAS}`,
                Estado: `${idx.UNICIDAD} - ${idx.ESTADO}`
            });
        });
        
        return tableData;
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

function downloadTableDetails(tableName) {
    if (window.diccionario) {
        window.diccionario.downloadTableDetails(tableName);
    }
}

function downloadTableDetailsExcel(tableName) {
    if (window.diccionario) {
        window.diccionario.downloadTableDetailsExcel(tableName);
    }
}

// Inicializar la aplicación cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, inicializando aplicación...');
    window.diccionario = new DiccionarioDatos();
});
