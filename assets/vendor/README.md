# Bibliotecas locales del MER

Los archivos se sirven desde el proyecto, sin enviar metadatos a servicios externos.

| Archivo | Paquete y versión | Licencia |
| --- | --- | --- |
| cytoscape.min.js | cytoscape 3.33.1 | MIT, ver LICENSE-cytoscape |
| elk.bundled.js | elkjs 0.11.0 | EPL-2.0, ver LICENSE-elkjs.md |

Las versiones se fijan en package.json y package-lock.json. Tras `npm ci --ignore-scripts`, las copias públicas pueden regenerarse desde `node_modules/cytoscape/dist/cytoscape.min.js` y `node_modules/elkjs/lib/elk.bundled.js`. No se publica node_modules mediante el servidor local.
