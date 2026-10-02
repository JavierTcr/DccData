# Validación del proyecto Diccionario de Datos APE

Fecha: 1 de octubre de 2026. Revisión de código, configuración local, CSV y conexión Oracle con consultas de solo lectura. No se modificaron los archivos de la aplicación ni los datos de Oracle.

## Resultado

La conexión Oracle funciona desde este equipo: puerto TCP accesible, autenticación correcta y SELECT 1 FROM DUAL exitoso. ALL_TABLES muestra 734 tablas visibles del esquema SPE. Esto no acredita disponibilidad desde otro servidor, permisos mínimos, cifrado efectivo, respaldos ni alta disponibilidad.

La arquitectura es un extractor Python que consulta metadatos Oracle y escribe CSV; dos interfaces HTML/JavaScript consumen esos archivos. No se encontró backend web, autenticación web, configuración de despliegue ni automatización de actualización en los archivos revisados.

## Hallazgos prioritarios

1. **Crítico si se publica la raíz: posible exposición de credenciales.** README.md:78 propone `python -m http.server 8000` desde el proyecto, cuya raíz contiene .env. Ese archivo puede ser descargado por HTTP cuando se sirve la raíz con el servidor estándar; .gitignore no controla el acceso web. El comando tampoco limita la escucha a localhost. No se levantó un servidor ni se descargaron secretos para probarlo. Servir únicamente una carpeta pública con HTML, assets y CSV autorizados; para uso local, limitar la escucha a 127.0.0.1. Si ya estuvo expuesto a terceros, revisar accesos y rotar las credenciales.

2. **Alta: pérdida comprobada de columnas al leer CSV.** diccionario_viewer.js:108 y assets/script_fixed.js:185 separan el documento por saltos de línea antes de interpretar campos entre comillas. Python csv cuenta 4.979 columnas; ambos parsers JavaScript devuelven 4.978. El registro real afectado es AAA_CRUCE, columna cuyo nombre contiene `Lugar de\n Residencia`. Usar un parser CSV que soporte registros multilínea; validar conteos y cabeceras. El parser de diccionario_viewer.js también elimina comillas escapadas dentro de los valores.

3. **Alta: exportación incorrecta de PK/FK/UNIQUE.** diccionario_viewer.js:698 compara TIPO con PRIMARY KEY, FOREIGN KEY y UNIQUE; los CSV producidos por el extractor usan P, R y U en TIPO, y los nombres completos en TIPO_DESCRIPCION. Reproducción con una columna ID y restricción P devuelve Llave primaria = NO. Además, includes sobre COLUMNAS puede confundir ID con otros nombres que lo contienen. Comparar códigos y pertenencia exacta a la lista de columnas.

4. **Alta: actualización de datos desconectada del visor.** diccionario_viewer.js:78 y assets/script_fixed.js:133 usan listas de fechas fijas. Nuevas extracciones no se descubrirán automáticamente. Publicar un manifiesto que apunte a un conjunto completo y validado; actualizarlo solo después de terminar la extracción. Las fechas y conteos fijos de index.html y README también pueden resultar engañosos.

5. **Alta: cargas parciales aceptadas como válidas.** diccionario_viewer.js:94 captura errores HTTP y retorna []; la inicialización puede continuar con secciones vacías. assets/script_fixed.js:75 convierte fallos individuales en listas vacías y solo rechaza cuando faltan a la vez tablas y columnas. Exigir los cuatro archivos y su consistencia; mostrar un error visible si falla alguno.

6. **Media: calidad y cobertura incompletas del diccionario.** diccionario_optimizado_fixed.py usa DATA_LENGTH para tipos de caracteres sin CHAR_LENGTH/CHAR_USED, omite escalas negativas al construir NUMBER y convierte escala cero en texto vacío. Trunca defaults a 100 caracteres. No exporta comentarios oficiales de tablas/columnas, expresión CHECK, R_OWNER, tabla y columna destino de FK ni regla de borrado. El visor genera descripciones por heurísticas: no deben presentarse como definiciones oficiales de negocio.

7. **Media: criterio de exclusión de tablas ambiguo.** El filtro SQL `%TEMP_%` trata `_` como comodín de un carácter; no equivale a un guion bajo literal y tampoco acredita que una tabla sea temporal. Definir si se quiere excluir por nombre o por ALL_TABLES.TEMPORARY y aplicar el criterio consistentemente. Los 734 objetos visibles actuales no son directamente comparables con las 639 tablas exportadas bajo ese filtro.

8. **Media: superficie de inyección en el frontend.** Ambos visores interpolan valores CSV en innerHTML y atributos. No se detectó un ataque real; un CSV manipulado o metadatos con contenido HTML podrían producir ejecución o alterar la interfaz. Usar textContent y construir elementos/atributos de forma segura. La exportación CSV tampoco neutraliza fórmulas de hoja de cálculo: evaluar la política para textos que comiencen por =, +, - o @.

9. **Media: operación y conexión poco reproducibles.** No hay requirements.txt/pyproject ni versiones fijadas. Hay tres implementaciones separadas de conexión; solo ConexionAPE.py valida presencia de configuración. No hay límites explícitos de conexión/consulta en la aplicación, ni reintentos acotados. Los cursores pueden quedar abiertos si falla una extracción. El cierre global existe, pero los archivos se escriben directamente y una falla deja un conjunto parcial. Las rutas dependen del directorio de ejecución; el README apunta a diccionario_optimizado.py, archivo que no existe. Consolidar conexión, rutas y publicación de archivos.

10. **Media: codificación y mantenimiento.** columnas_spe_20250827_144418.csv no decodifica como UTF-8; fue legible usando cp1252. Los últimos conjuntos sí decodifican como UTF-8. Existen varios visores, respaldos y páginas manuales de prueba, sin suite automatizada o entrada única. index.html usa assets/script_fixed.js y diccionario_viewer.html usa diccionario_viewer.js; revisar solo uno deja comportamientos distintos sin validar.

11. **Infraestructura pendiente de evidencia.** Bootstrap y Font Awesome se cargan desde CDN sin atributos de integridad en las páginas principales. No se encontraron configuración HTTPS, cabeceras de seguridad, control de acceso a metadatos, monitoreo o políticas de retención. La conexión de código usa host/puerto/service sin configuración explícita de TCPS; no se determinó si Oracle aplica cifrado nativo. Tampoco se auditaron privilegios, red, backups o configuración del servidor Oracle. Solicitar esas evidencias para una evaluación de infraestructura completa.

## Verificaciones realizadas

- Sintaxis Python válida: ConexionAPE.py, diccionario_optimizado_fixed.py y explorar_esquemas.py.
- `node --check` exitoso para los dos scripts activos.
- Pruebas de los parsers reales con los cuatro CSV más recientes y registros multilínea/comillas.
- Reproducción de la exportación incorrecta de llave primaria mediante el método real getSelectedTablesStructure.
- Seis conjuntos de CSV revisados: cinco completos tienen 639 tablas, 4.979 columnas, 3.728 restricciones y 664 índices; el conjunto inicial contiene 10/9/4/4 registros. No se detectaron referencias TABLA ausentes del archivo de tablas en esos conjuntos.
- Última extracción local: 27 de agosto de 2025 a las 17:10:54 según nombres de archivo; no se ejecutó una nueva extracción.
- Variables obligatorias presentes en .env; no se imprimieron sus valores. .env está ignorado y no figura como archivo rastreado ni en el historial consultado para esa ruta. Esto no equivale a una auditoría de secretos de todo el historial.
- Conexión real: TCP y SELECT 1 FROM DUAL correctos; 734 tablas visibles en SPE. Se requirió ejecución fuera del sandbox porque la primera prueba de red fue bloqueada por permisos.
- Se observaron eliminaciones preexistentes de archivos ERD en git; no se restauraron ni modificaron.

## Orden propuesto de corrección

1. Separar el directorio público de secretos y scripts de extracción.
2. Corregir parser CSV y exportación de llaves; verificar los 4.979 registros y casos compuestos.
3. Crear manifiesto de extracción y rechazar conjuntos incompletos.
4. Completar metadatos, revisar exclusiones y actualizar documentación/dependencias.
5. Validar permisos mínimos, cifrado, despliegue y operación con evidencia de infraestructura.

Alcance: no se realizó prueba visual en navegador, extracción completa en vivo, auditoría del servidor Oracle ni prueba de carga. Los resultados de sintaxis y parsers no acreditan que todas las interacciones de la interfaz funcionen.


## Ajustes aplicados el 1 de octubre de 2026

Los hallazgos de código se corrigieron conservando ambas interfaces: parser y serializador compartidos, llaves exactas, estructuras seleccionadas completas, carga mediante manifiesto, rechazo de snapshots parciales, escape HTML y neutralización de fórmulas CSV. Se añadieron servidor local con lista de archivos permitidos y cabeceras, SRI para los CDN actuales, dependencias fijadas y conexión compartida con límites de tiempo.

El extractor ampliado se ejecutó satisfactoriamente con consultas de solo lectura: snapshot `20261001_110212`, 649 tablas, 5.043 columnas, 3.787 restricciones y 738 índices. Incorpora comentarios, CHECK, destino de FK y tipos completos. El filtro ahora interpreta TEMP_ literal; la cuenta ve 734 tablas en total y 85 se excluyen por esa convención. Los CSV antiguos se conservaron.

Se incorporaron pruebas de regresión JavaScript y siete pruebas Python, incluyendo acceso HTTP a archivos públicos y denegación de secretos, semántica Oracle y conservación del manifiesto ante errores. La prueba visual en navegador sigue pendiente porque no existe un navegador conectado en esta sesión. Los controles del servidor Oracle y del despliegue compartido requieren evidencia del entorno y no se modificaron.
