// Diccionario de Datos - JavaScript Simple para Testing
class DiccionarioDatosSimple {
    constructor() {
        this.data = {
            tablas: [
                {TABLA: 'USUARIOS', NUM_FILAS: '1500', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-15'},
                {TABLA: 'PRODUCTOS', NUM_FILAS: '2300', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-14'},
                {TABLA: 'PEDIDOS', NUM_FILAS: '5600', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-15'},
                {TABLA: 'CLIENTES', NUM_FILAS: '890', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-13'},
                {TABLA: 'CATEGORIAS', NUM_FILAS: '45', TABLESPACE: 'TS_DATOS', ESTADO: 'VALID', ULTIMO_ANALISIS: '2024-01-12'}
            ],
            columnas: [],
            restricciones: [],
            indices: []
        };
        this.currentSection = 'resumen';
        this.currentPage = { tablas: 1, columnas: 1, restricciones: 1, indices: 1 };
        this.itemsPerPage = 50;
        this.filteredData = {...this.data};
        this.selectedTables = new Set();
        
        this.init();
    }

    init() {
        console.log('Inicializando DiccionarioDatos Simple...');
        this.setupEventListeners();
        this.showSection('resumen');
        console.log('DiccionarioDatos Simple inicializado');
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
        }
        
        // Actualizar navegación
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('active'));
        
        // Renderizar datos
        if (section !== 'resumen') {
            this.renderSection(section);
        }
    }

    renderSection(section) {
        const data = this.filteredData[section] || [];
        if (section === 'tablas') {
            this.renderTablasTable(data);
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
    diccionario = new DiccionarioDatosSimple();
});