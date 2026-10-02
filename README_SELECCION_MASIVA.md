> Actualización 2026-10-01: iniciar con `python servir_diccionario.py` y abrir `/diccionario_viewer.html`. La selección persiste entre páginas y filtros; seleccionar todas actúa sobre la página visible. Las estructuras seleccionadas se exportan completas, independientemente de filtros de columnas/restricciones. Se corrigió la detección de llaves Oracle y la lectura CSV multilínea. Ver [README.md](README.md) para los comandos actuales.

# Nueva Funcionalidad: Selección Masiva de Tablas

## ¿Qué se agregó?

Se ha implementado una nueva funcionalidad de **selección masiva de tablas** en el apartado "Tablas" del diccionario de datos, que permite:

### ✅ Funcionalidades añadidas:

1. **Checkboxes individuales**: Cada tabla en la lista ahora tiene un checkbox para seleccionarla individualmente
2. **Seleccionar todas**: Checkbox en el encabezado y opción debajo del buscador para seleccionar todas las tablas visibles
3. **Contador dinámico**: Se muestra el número de tablas seleccionadas en tiempo real
4. **Descarga masiva**: Botón específico para descargar solo las tablas seleccionadas en formato CSV
5. **Limpiar selección**: Botón para quitar todas las selecciones de una vez
6. **Persistencia**: Las selecciones se mantienen al cambiar de página o filtrar

### 🎯 Cómo usar:

#### Seleccionar tablas individuales:
- Hacer clic en el checkbox al lado de cada tabla que deseas seleccionar
- Las filas seleccionadas se resaltan visualmente

#### Seleccionar todas las tablas:
- Usar el checkbox en el encabezado de la tabla, o
- Usar el checkbox "Seleccionar todas las tablas visibles" debajo del buscador

#### Descargar tablas seleccionadas:
- Seleccionar las tablas deseadas
- Hacer clic en "CSV Seleccionadas (X)" donde X es el número de tablas seleccionadas
- El archivo se descargará con el nombre `estructura_N_tablas.csv` (o `estructura_NOMBRE.csv` para una tabla)

#### Limpiar selección:
- Hacer clic en el botón "Limpiar Selección" para quitar todas las selecciones

### 🔧 Detalles técnicos:

- **Sin afectar funcionalidad existente**: Todas las funciones previas siguen funcionando igual
- **Responsive**: Los checkboxes y botones se adaptan a dispositivos móviles
- **Eficiente**: Las selecciones se almacenan en memoria usando un Set() para mejor rendimiento
- **Navegación**: Las selecciones se mantienen al cambiar páginas en la paginación

### 📁 Archivos modificados:

1. **diccionario_viewer.html**:
   - Agregada columna de checkbox en la tabla
   - Nuevos botones de control (CSV Seleccionadas, Limpiar Selección)
   - Checkbox de "seleccionar todas"

2. **diccionario_viewer.js**:
   - Funciones para manejar selecciones: `updateSelectedTablesUI()`, `getSelectedTables()`, `exportSelectedTables()`
   - Funciones globales: `toggleAllTables()`, `clearAllSelections()`
   - Propiedad `selectedTables` para persistir selecciones

### 🎨 Estilos visuales:

- **Filas seleccionadas**: Fondo azul claro para identificar visualmente las tablas seleccionadas
- **Checkboxes**: Tamaño aumentado para mejor usabilidad
- **Botones**: Colores distintivos (verde para descarga seleccionadas, amarillo para limpiar)
- **Contador**: Número resaltado en verde para mostrar cantidad seleccionada

Esta implementación es **completamente opcional** y no interfiere con el uso normal del diccionario de datos.