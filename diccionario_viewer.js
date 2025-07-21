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
        
        this.init();
    }

    async init() {
        try {
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
            // Detectar archivos CSV automáticamente por timestamp
            const timestamp = this.detectTimestamp();
            
            const [tablasData, columnasData, restriccionesData, indicesData] = await Promise.all([
                this.loadCSV(`tablas_spe_${timestamp}.csv`),
                this.loadCSV(`columnas_spe_${timestamp}.csv`),
                this.loadCSV(`restricciones_spe_${timestamp}.csv`),
                this.loadCSV(`indices_spe_${timestamp}.csv`)
            ]);

            this.data.tablas = tablasData;
            this.data.columnas = columnasData;
            this.data.restricciones = restriccionesData;
            this.data.indices = indicesData;

            // Inicializar datos filtrados
            this.filteredData = { ...this.data };
            
            // Llenar filtros
            this.populateFilters();
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            // Si no se pueden cargar los datos, mostrar datos de ejemplo
            this.loadSampleData();
        } finally {
            this.showLoading(false);
        }
    }

    detectTimestamp() {
        // Intentar detectar el timestamp del archivo más reciente
        // En un entorno real, esto podría venir de un parámetro o API
        return '20250721_114257'; // Valor por defecto basado en el archivo generado
    }

    async loadCSV(filename) {
        try {
            const response = await fetch(filename);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            return this.parseCSV(text);
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
                    row[header] = values[index];
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
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
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
        const container = document.querySelector('.col-lg-9');
        container.innerHTML = `
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
                tablaFilter.innerHTML += `<option value="${tabla}">${tabla}</option>`;
            });
        }
    }

    showSection(section) {
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
        event?.target?.classList.add('active');

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
        const tbody = document.getElementById('tablas-tbody');
        const pagination = document.getElementById('tablas-pagination');
        
        if (!tbody) return;

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
            `;
            tbody.appendChild(tr);
        });

        this.renderPagination('tablas', data.length, pagination);
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

        const page = this.currentPage.restricciones;
        const startIndex = (page - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = data.slice(startIndex, endIndex);

        tbody.innerHTML = '';

        pageData.forEach(row => {
            const tr = document.createElement('tr');
            const tipoBadgeClass = this.getConstraintBadgeClass(row.TIPO_DESCRIPCION);
            
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
        if (!num || num === 'N/A' || num === '0') return '0';
        return parseInt(num).toLocaleString();
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
        if (data.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
let diccionario;
document.addEventListener('DOMContentLoaded', () => {
    diccionario = new DiccionarioDatos();
});
