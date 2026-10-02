# Diccionario de Datos APE — Oracle SPE

El extractor consulta metadatos Oracle y genera archivos CSV. Los visores muestran esos archivos mediante HTTP; el navegador no recibe credenciales ni se conecta a Oracle.

## Inicio local

Desde la carpeta del proyecto:

```powershell
python -m pip install -r requirements.txt
python servir_diccionario.py
```

Abrir `http://127.0.0.1:8000/diccionario_viewer.html` para selección masiva y exportación de estructuras. Abrir `http://127.0.0.1:8000/` para el visor con detalles por tabla y descarga individual. Para otro puerto: `python servir_diccionario.py --port 8080`.

El servidor escucha únicamente en `127.0.0.1` y sirve una lista explícita de archivos públicos. Bloquea `.env`, `.git`, scripts Python, respaldos y listados de directorios. No usar `python -m http.server` en la raíz: esa carpeta contiene credenciales. Abrir HTML mediante `file://` tampoco permite la carga normal de los CSV por `fetch`.

## Conexión y extracción

Crear `.env` a partir de `.env.example` y completar `DB_HOST`, `DB_PORT`, `DB_SERVICE_NAME`, `DB_USER` y `DB_PASSWORD`. `.env` está excluido de Git.

Requiere Python 3.11, las dependencias fijadas y Oracle Instant Client compatible con `cx_Oracle`. El cliente Oracle debe estar disponible en el entorno del proceso. La cuenta necesita acceso a los metadatos del esquema; los extractores no ejecutan cambios en Oracle.

```powershell
python ConexionAPE.py
python diccionario_optimizado_fixed.py
python explorar_esquemas.py
```

Puede especificarse otro esquema: `python diccionario_optimizado_fixed.py --schema SPE`.

La extracción escribe primero en una carpeta temporal. Valida cabeceras, conteos y referencias a tablas; publica los CSV terminados y actualiza `data/manifest.json` como último paso mediante reemplazo atómico. Los visores cargan el conjunto indicado por el manifiesto y rechazan cargas parciales o inconsistentes. Una extracción fallida conserva el manifiesto anterior. Los snapshots previos se conservan; no hay borrado automático.

Para reconstruir el manifiesto del último conjunto SPE completo disponible: `python snapshot_manifest.py`.

Las rutas de extracción y configuración se resuelven desde la ubicación del proyecto. Puede ejecutarse el extractor desde otro directorio.

Opciones de conexión:

- `DB_CONNECT_TIMEOUT_SECONDS=5`: límite de conexión.
- `DB_CALL_TIMEOUT_MS=30000`: límite de cada llamada Oracle.
- `DB_PROTOCOL=TCP`: mantiene el transporte existente. `TCPS` requiere configurar certificados/wallet en el entorno Oracle; cambiar la variable no configura por sí solo el cifrado.

La conexión se comparte entre los scripts y se cierra al terminar. Los fallos de extracción devuelven un código de salida distinto de cero.

## Funciones conservadas

- Búsqueda, filtros por tabla/tipo de restricción/unicidad y paginación.
- Selección individual y de las tablas visibles en la página actual.
- Persistencia de selección al filtrar o cambiar de página, contador y limpieza.
- Exportación de lista y estructura de las tablas seleccionadas.
- Modal de detalles y descarga individual en `index.html`.
- Nombres de tabla pulsables en ambos visores para consultar su estructura; los checkboxes solo modifican la selección.
- Vista de estructura compacta con 12 campos por página, búsqueda sobre todos los campos, colores por tipo de dato, indicadores PK/FK y detalles desplegables para consultar dominios, reglas y observaciones. La descarga CSV mantiene todas las columnas originales, incluso con búsqueda o paginación activas.
- CSV con BOM UTF-8: separador coma en selección masiva, punto y coma en el visor de detalles.

La estructura de tablas seleccionadas se exporta completa aunque otros filtros oculten columnas o restricciones. Los códigos Oracle `P`, `R`, `U` y `C` se interpretan correctamente y las columnas se comparan por nombre exacto.

El parser admite campos multilínea, comillas escapadas, BOM y CRLF. La carga soporta snapshots históricos en Windows-1252; las nuevas extracciones se generan en UTF-8. Los valores CSV se escapan al renderizar HTML. Las exportaciones preservan cero y anteponen una comilla simple a textos que podrían interpretarse como fórmulas al abrirlos en una hoja de cálculo.

## Alcance de los metadatos

Se exportan tablas, columnas, restricciones e índices, conservando las cabeceras anteriores y añadiendo comentarios Oracle, semántica de longitud, destinos de FK, reglas de borrado, condición CHECK, estado de validación y expresiones de índices.

- `NUM_FILAS` corresponde a estadísticas Oracle, no a un conteo en tiempo real. Un valor vacío indica que no hay estadísticas.
- La exclusión conserva la convención del proyecto: nombres que contienen `TEMP_` literal. No equivale a que Oracle marque la tabla como temporal; ese atributo se exporta aparte.
- Los defaults se conservan completos y los tipos incluyen escalas cero/negativas y semántica CHAR/BYTE.
- Las descripciones usan comentarios oficiales cuando existen. Las descripciones y dominios deducidos del nombre se identifican como sugeridos.
- Las fechas, conteos y datos de extracción mostrados proceden del snapshot publicado.

## Archivos principales

| Archivo | Función |
| --- | --- |
| `ConexionAPE.py` | Conexión y configuración compartidas |
| `diccionario_optimizado_fixed.py` | Extracción y publicación |
| `snapshot_manifest.py` | Validación y manifiesto |
| `servir_diccionario.py` | Servidor local con acceso restringido a archivos públicos |
| `diccionario_viewer.html` / `diccionario_viewer.js` | Selección masiva |
| `index.html` / `assets/script_fixed.js` | Detalles y exportación individual |
| `assets/dictionary_core.js` | CSV, carga, validación, escape y serialización compartidos |
| `data/manifest.json` | Snapshot activo |
| `tests/` | Pruebas de regresión y acceso HTTP |

Los archivos `backup`, `simple`, las páginas de depuración y `templates/index.html` se conservan como referencias históricas; no son entradas del servidor local soportado.

## Verificación

```powershell
node tests/dictionary.test.js
python -m unittest discover -s tests -p "test_*.py" -v
```

Node solo se necesita para las pruebas JavaScript. Para incluir las pruebas de navegación sobre el DOM de las páginas:

```powershell
npm ci --ignore-scripts
npm test
```

Las pruebas cubren CSV, conteos, cargas parciales, detección exacta de llaves, exportación con filtros activos, persistencia de selección, escape HTML, semántica Oracle, preservación del manifiesto ante fallos y bloqueo HTTP de archivos privados. Las pruebas DOM verifican clic en nombre/fila, apertura y cierre de la estructura, descarga CSV y que el checkbox no abra los detalles.

## Despliegue

Este servidor está destinado a uso local. Un despliegue compartido requiere un directorio público aislado, autenticación para los metadatos, HTTPS, permisos mínimos de Oracle y validación del cifrado y la operación en la infraestructura correspondiente. Los metadatos CSV también requieren control de acceso.

Bootstrap 5.3.0 y Font Awesome 6.0.0 conservan sus versiones y CDN originales, ahora con comprobación de integridad SRI. El visor de selección usa un diálogo nativo para la estructura. El visor de detalles mantiene el modal Bootstrap y usa el diálogo nativo si no carga esa biblioteca. La interfaz requiere el CDN para sus estilos e iconos habituales. La política CSP local mantiene los manejadores inline existentes para conservar la interfaz.
