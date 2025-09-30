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
        this.selectedTables = new Set();
        
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
            this.showError('Error cargando los datos del diccionario');
        }
    }

    async loadData() {
        this.showLoading(true);
        
        try {
            // Intentar cargar archivos CSV
            const timestamp = this.detectTimestamp();
            
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

            console.log('Datos CSV cargados:', {
                tablas: tablasData.length,
                columnas: columnasData.length,
                restricciones: restriccionesData.length,
                indices: indicesData.length
            });
            
        } catch (error) {
            console.warn('Error cargando CSV, usando datos de ejemplo:', error);
            this.loadSampleData();
        }

        // Inicializar datos filtrados
        this.filteredData = {...this.data};
        
        // Llenar filtros
        this.populateFilters();
        
        this.showLoading(false);
    }

    detectTimestamp() {
        return '20250721_114257';
    }

    async loadCSV(filename) {
        const response = await fetch(filename);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        return this.parseCSV(text);
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
            
            if (char === '"' && (i === 0 || line[i-1] === ',')) {
                inQuotes = true;
            } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
                inQuotes = false;
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
        console.log('Cargando datos de ejemplo...');
        this.data.tablas = [
            {TABLA: 'USUARIOS', NUM_FILAS: '1500', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-15'},
            {TABLA: 'PRODUCTOS', NUM_FILAS: '2300', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-14'},
            {TABLA: 'PEDIDOS', NUM_FILAS: '5600', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-15'},
            {TABLA: 'CLIENTES', NUM_FILAS: '890', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-13'},
            {TABLA: 'CATEGORIAS', NUM_FILAS: '45', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-12'},
            {TABLA: 'FACTURAS', NUM_FILAS: '4200', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-15'},
            {TABLA: 'INVENTARIO', NUM_FILAS: '1800', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-14'},
            {TABLA: 'PROVEEDORES', NUM_FILAS: '120', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-13'},
            {TABLA: 'EMPLEADOS', NUM_FILAS: '80', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-15'},
            {TABLA: 'SUCURSALES', NUM_FILAS: '25', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-14'}
        ];
        
        this.data.columnas = [
            {TABLA: 'USUARIOS', COLUMNA: 'ID', TIPO_COMPLETO: 'NUMBER(10)', PERMITE_NULOS: 'N', POSICION: '1'},
            {TABLA: 'USUARIOS', COLUMNA: 'NOMBRE', TIPO_COMPLETO: 'VARCHAR2(100)', PERMITE_NULOS: 'N', POSICION: '2'},
            {TABLA: 'USUARIOS', COLUMNA: 'EMAIL', TIPO_COMPLETO: 'VARCHAR2(150)', PERMITE_NULOS: 'Y', POSICION: '3'},
            {TABLA: 'PRODUCTOS', COLUMNA: 'ID', TIPO_COMPLETO: 'NUMBER(10)', PERMITE_NULOS: 'N', POSICION: '1'},
            {TABLA: 'PRODUCTOS', COLUMNA: 'NOMBRE', TIPO_COMPLETO: 'VARCHAR2(200)', PERMITE_NULOS: 'N', POSICION: '2'},
            {TABLA: 'PRODUCTOS', COLUMNA: 'PRECIO', TIPO_COMPLETO: 'NUMBER(10,2)', PERMITE_NULOS: 'N', POSICION: '3'}
        ];
        
        this.data.restricciones = [
            {TABLA: 'USUARIOS', RESTRICCION: 'PK_USUARIOS', TIPO: 'PRIMARY KEY', ESTADO: 'ENABLED', COLUMNAS: 'ID'},
            {TABLA: 'PRODUCTOS', RESTRICCION: 'PK_PRODUCTOS', TIPO: 'PRIMARY KEY', ESTADO: 'ENABLED', COLUMNAS: 'ID'}
        ];
        
        this.data.indices = [
            {TABLA: 'USUARIOS', INDICE: 'PK_USUARIOS', TIPO: 'UNIQUE', ESTADO: 'VALID', COLUMNAS: 'ID'},
            {TABLA: 'PRODUCTOS', INDICE: 'PK_PRODUCTOS', TIPO: 'UNIQUE', ESTADO: 'VALID', COLUMNAS: 'ID'}
        ];
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'block' : 'none';
        }
    }

    showError(message) {
        const container = document.querySelector('.col-lg-9');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Error:</strong> ${message}
                </div>
            `;
        }
    }

    populateFilters() {
        // Llenar filtro de tablas para columnas
        const tablaFilter = document.getElementById('tabla-filter');
        if (tablaFilter && this.data.tablas.length > 0) {
            const tablas = [...new Set(this.data.tablas.map(t => t.TABLA))].sort();
            tablaFilter.innerHTML = '<option value="">Filtrar por tabla...</option>';
            tablas.forEach(tabla => {
                tablaFilter.innerHTML += `<option value="${tabla}">${tabla}</option>`;
            });
        }
    }

    setupEventListeners() {
        // Búsqueda de tablas
        const tablaSearch = document.getElementById('tabla-search');
        if (tablaSearch) {
            tablaSearch.addEventListener('input', (e) => {
                this.filterData('tablas', e.target.value);
            });
        }
    }

    showSection(section) {
        console.log('Mostrando sección:', section);
        this.currentSection = section;
        
        // Ocultar todas las secciones
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(sec => sec.style.display = 'none');
        
        // Mostrar sección seleccionada
        const targetSection = document.getElementById(`${section}-section`);
        if (targetSection) {
            targetSection.style.display = 'block';
        } else {
            console.error(`No se encontró la sección: ${section}-section`);
        }
        
        // Actualizar navegación
        const navLinks = document.querySelectorAll('.sidebar .nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            // Activar el enlace correspondiente basado en el onclick
            if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(`'${section}'`)) {
                link.classList.add('active');
            }
        });
        
        // Renderizar datos
        if (section !== 'resumen') {
            this.renderSection(section);
        }
        
        console.log(`Sección ${section} mostrada correctamente`);
    }

    renderSection(section) {
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
        console.log('Renderizando tabla con', data.length, 'elementos');
        const tbody = document.getElementById('tablas-tbody');
        if (!tbody) {
            console.error('No se encontró tablas-tbody');
            return;
        }

        tbody.innerHTML = '';
        
        data.forEach((row, index) => {
            const tableName = row.TABLA;
            const isSelected = this.selectedTables.has(tableName);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <input type="checkbox" class="table-checkbox" 
                           data-table-name="${tableName}" 
                           ${isSelected ? 'checked' : ''}
                           onchange="updateSelectedTables()">
                </td>
                <td><strong>${tableName}</strong></td>
                <td>${row.NUM_FILAS}</td>
                <td><span class="badge" style="background-color: #6c757d;">${row.TABLESPACE}</span></td>
                <td><span class="badge bg-success">${row.ESTADO}</span></td>
                <td>${row.ULTIMO_ANALISIS}</td>
            `;
            
            if (isSelected) {
                tr.classList.add('selected-row');
            }
            
            tbody.appendChild(tr);
        });
        
        this.updateSelectedTablesUI();
        console.log('Tabla renderizada');
    }

    renderColumnasTable(data) {
        console.log('Renderizando columnas con', data.length, 'elementos');
        const tbody = document.getElementById('columnas-tbody');
        if (!tbody) {
            console.error('No se encontró columnas-tbody');
            return;
        }

        tbody.innerHTML = '';
        
        data.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.TABLA || 'N/A'}</strong></td>
                <td>${row.COLUMNA || 'N/A'}</td>
                <td><code>${row.TIPO_COMPLETO || row.TIPO_DATO || 'N/A'}</code></td>
                <td><span class="badge ${row.PERMITE_NULOS === 'N' ? 'bg-danger' : 'bg-success'}">${row.PERMITE_NULOS === 'N' ? 'NO' : 'SÍ'}</span></td>
                <td>${row.POSICION || 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });
        
        console.log('Columnas renderizadas');
    }

    renderRestriccionesTable(data) {
        console.log('Renderizando restricciones con', data.length, 'elementos');
        const tbody = document.getElementById('restricciones-tbody');
        if (!tbody) {
            console.error('No se encontró restricciones-tbody');
            return;
        }

        tbody.innerHTML = '';
        
        data.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.TABLA || 'N/A'}</strong></td>
                <td>${row.RESTRICCION || 'N/A'}</td>
                <td><span class="badge ${this.getBadgeClass(row.TIPO)}">${row.TIPO || 'N/A'}</span></td>
                <td><span class="badge ${row.ESTADO === 'ENABLED' ? 'bg-success' : 'bg-warning'}">${row.ESTADO || 'N/A'}</span></td>
                <td>${row.COLUMNAS || 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });
        
        console.log('Restricciones renderizadas');
    }

    renderIndicesTable(data) {
        console.log('Renderizando índices con', data.length, 'elementos');
        const tbody = document.getElementById('indices-tbody');
        if (!tbody) {
            console.error('No se encontró indices-tbody');
            return;
        }

        tbody.innerHTML = '';
        
        data.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.TABLA || 'N/A'}</strong></td>
                <td>${row.INDICE || 'N/A'}</td>
                <td><span class="badge bg-info">${row.TIPO || 'N/A'}</span></td>
                <td><span class="badge ${row.ESTADO === 'VALID' ? 'bg-success' : 'bg-warning'}">${row.ESTADO || 'N/A'}</span></td>
                <td>${row.COLUMNAS || 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });
        
        console.log('Índices renderizados');
    }

    getBadgeClass(tipo) {
        switch (tipo) {
            case 'PRIMARY KEY': return 'bg-danger';
            case 'FOREIGN KEY': return 'bg-warning';
            case 'UNIQUE': return 'bg-info';
            case 'CHECK': return 'bg-success';
            default: return 'bg-secondary';
        }
    }

    filterData(section, searchTerm) {
        const originalData = this.data[section] || [];
        if (!searchTerm) {
            this.filteredData[section] = originalData;
        } else {
            this.filteredData[section] = originalData.filter(item => 
                Object.values(item).some(value => 
                    value.toString().toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        }
        
        if (this.currentSection === section) {
            this.renderSection(section);
        }
    }

    updateSelectedTablesUI() {
        const checkboxes = document.querySelectorAll('.table-checkbox');
        
        // Actualizar el Set
        checkboxes.forEach(checkbox => {
            const tableName = checkbox.getAttribute('data-table-name');
            if (checkbox.checked) {
                this.selectedTables.add(tableName);
            } else {
                this.selectedTables.delete(tableName);
            }
        });
        
        const selectedCount = this.selectedTables.size;
        
        // Actualizar contador
        const countElement = document.getElementById('selected-count');
        if (countElement) {
            countElement.textContent = selectedCount;
        }
        
        // Botón
        const exportBtn = document.getElementById('export-selected-btn');
        if (exportBtn) {
            exportBtn.disabled = selectedCount === 0;
        }
        
        // Checkboxes de seleccionar todo
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
        
        // Resaltar filas
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

    exportSelectedTables() {
        const selectedTableNames = Array.from(this.selectedTables);
        if (selectedTableNames.length === 0) {
            alert('No hay tablas seleccionadas');
            return;
        }
        
        const selectedData = this.filteredData.tablas.filter(tabla => 
            selectedTableNames.includes(tabla.TABLA)
        );
        
        // Simular descarga
        const csv = this.generateCSV(selectedData);
        this.downloadCSV(csv, `tablas_seleccionadas_${selectedTableNames.length}.csv`);
        alert(`Se han exportado ${selectedTableNames.length} tablas`);
    }

    generateCSV(data) {
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n');
        
        return csvContent;
    }

    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
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

// Funciones globales
function showSection(section) {
    if (diccionario) {
        diccionario.showSection(section);
    }
}

function updateSelectedTables() {
    if (diccionario) {
        diccionario.updateSelectedTablesUI();
    }
}

function toggleAllTables(checked) {
    console.log('toggleAllTables:', checked);
    const checkboxes = document.querySelectorAll('.table-checkbox');
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

function clearAllSelections() {
    if (diccionario) {
        diccionario.selectedTables.clear();
        const checkboxes = document.querySelectorAll('.table-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
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

function exportData(section, format) {
    alert('Exportando todas las tablas en formato ' + format);
}

// Inicializar
let diccionario;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, inicializando...');
    diccionario = new DiccionarioDatos();
});