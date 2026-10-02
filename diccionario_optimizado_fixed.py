"""Extractor Oracle de solo lectura con publicación de snapshots completos."""
import csv
import os
import re
import tempfile
import time
from datetime import datetime
from pathlib import Path

from ConexionAPE import DatabaseConnection, PROJECT_ROOT
from snapshot_manifest import build_manifest, publish_manifest

# Preserve the exclusion by naming convention, but interpret the underscore literally.
TABLE_FILTER = r"UPPER(TABLE_NAME) NOT LIKE '%TEMP\_%' ESCAPE '\'"

class OptimizedDataDictionaryExtractor(DatabaseConnection):
    def __init__(self, schema_name="SPE"):
        super().__init__()
        self.schema_name = schema_name.upper()
        if not re.fullmatch(r'[A-Z][A-Z0-9_]*', self.schema_name):
            raise ValueError('Nombre de esquema inválido')
        self.start_time = None

    def _write(self, query, filename, headers, convert):
        count = 0
        with self.connection.cursor() as cursor:
            cursor.arraysize = 1000
            cursor.execute(query, schema_name=self.schema_name)
            with open(filename, 'w', newline='', encoding='utf-8-sig') as output:
                writer = csv.DictWriter(output, fieldnames=headers)
                writer.writeheader()
                for row in cursor:
                    writer.writerow(dict(zip(headers, convert(row))))
                    count += 1
        return count

    def get_table_count(self):
        with self.connection.cursor() as cursor:
            cursor.execute(f"SELECT COUNT(*), COUNT(CASE WHEN {TABLE_FILTER} THEN 1 END) FROM ALL_TABLES WHERE OWNER = :schema_name", schema_name=self.schema_name)
            total, included = cursor.fetchone()
        return total, total - included, included

    def extract_tables_info_csv(self, filename="tablas_info.csv"):
        query = f"""
            SELECT t.TABLE_NAME, t.NUM_ROWS, t.BLOCKS, t.EMPTY_BLOCKS, t.AVG_ROW_LEN,
                   t.TABLESPACE_NAME, t.STATUS, t.LAST_ANALYZED, t.DEGREE, t.COMPRESSION,
                   tc.COMMENTS, t.TEMPORARY
            FROM ALL_TABLES t
            LEFT JOIN ALL_TAB_COMMENTS tc ON tc.OWNER = t.OWNER AND tc.TABLE_NAME = t.TABLE_NAME AND tc.TABLE_TYPE = 'TABLE'
            WHERE t.OWNER = :schema_name AND {TABLE_FILTER.replace('TABLE_NAME', 't.TABLE_NAME')}
            ORDER BY t.TABLE_NAME
        """
        headers = ['TABLA', 'NUM_FILAS', 'BLOQUES', 'BLOQUES_VACIOS', 'LONGITUD_PROMEDIO_FILA',
                   'TABLESPACE', 'ESTADO', 'ULTIMO_ANALISIS', 'GRADO', 'COMPRESION', 'COMENTARIO', 'TEMPORAL']
        def convert(r):
            return [r[0], r[1] if r[1] is not None else '', r[2] if r[2] is not None else '',
                    r[3] if r[3] is not None else '', r[4] if r[4] is not None else '',
                    r[5] or 'N/A', r[6] or 'N/A', r[7].strftime('%Y-%m-%d %H:%M:%S') if r[7] else 'N/A',
                    r[8] or 'N/A', r[9] or 'N/A', r[10] or '', r[11] or 'N']
        return self._write(query, filename, headers, convert)

    @staticmethod
    def complete_type(data_type, byte_length, precision, scale, char_length, char_used):
        if data_type in ('VARCHAR2', 'CHAR'):
            length = char_length if char_used == 'C' else byte_length
            return f"{data_type}({length} {'CHAR' if char_used == 'C' else 'BYTE'})"
        if data_type in ('NVARCHAR2', 'NCHAR'):
            return f'{data_type}({char_length})'
        if data_type == 'NUMBER':
            if precision is not None:
                return f'NUMBER({precision},{scale})' if scale is not None else f'NUMBER({precision})'
            if scale is not None:
                return f'NUMBER(*,{scale})'
        return data_type

    def extract_columns_info_csv(self, filename="columnas_info.csv"):
        query = f"""
            SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE, c.DATA_LENGTH, c.DATA_PRECISION,
                   c.DATA_SCALE, c.NULLABLE, c.COLUMN_ID, c.DEFAULT_LENGTH, c.DATA_DEFAULT,
                   c.CHAR_LENGTH, c.CHAR_USED, cc.COMMENTS
            FROM ALL_TAB_COLUMNS c
            LEFT JOIN ALL_COL_COMMENTS cc ON cc.OWNER = c.OWNER AND cc.TABLE_NAME = c.TABLE_NAME AND cc.COLUMN_NAME = c.COLUMN_NAME
            WHERE c.OWNER = :schema_name AND EXISTS (
                SELECT 1 FROM ALL_TABLES t WHERE t.OWNER = c.OWNER AND t.TABLE_NAME = c.TABLE_NAME
                AND {TABLE_FILTER.replace('TABLE_NAME', 't.TABLE_NAME')})
            ORDER BY c.TABLE_NAME, c.COLUMN_ID
        """
        headers = ['TABLA', 'COLUMNA', 'TIPO_DATO', 'TIPO_COMPLETO', 'LONGITUD', 'PRECISION', 'ESCALA',
                   'PERMITE_NULOS', 'POSICION', 'VALOR_DEFAULT', 'LONGITUD_CARACTERES', 'SEMANTICA_LONGITUD', 'COMENTARIO']
        def present(value):
            return '' if value is None else value
        def convert(r):
            return [r[0], r[1], r[2], self.complete_type(r[2], r[3], r[4], r[5], r[10], r[11]),
                    present(r[3]), present(r[4]), present(r[5]), r[6], r[7], present(r[9]),
                    present(r[10]), present(r[11]), present(r[12])]
        return self._write(query, filename, headers, convert)

    def extract_constraints_info_csv(self, filename="restricciones_info.csv"):
        # SEARCH_CONDITION is LONG: retrieve it separately, without GROUP BY.
        with self.connection.cursor() as cursor:
            cursor.execute("SELECT CONSTRAINT_NAME, SEARCH_CONDITION FROM ALL_CONSTRAINTS WHERE OWNER = :schema_name AND CONSTRAINT_TYPE = 'C'", schema_name=self.schema_name)
            checks = dict(cursor)
        query = f"""
            SELECT c.TABLE_NAME, c.CONSTRAINT_NAME, c.CONSTRAINT_TYPE,
                   CASE c.CONSTRAINT_TYPE WHEN 'P' THEN 'PRIMARY KEY' WHEN 'R' THEN 'FOREIGN KEY'
                        WHEN 'U' THEN 'UNIQUE' WHEN 'C' THEN 'CHECK' ELSE c.CONSTRAINT_TYPE END,
                   c.STATUS, c.DEFERRABLE, c.DEFERRED, c.R_CONSTRAINT_NAME,
                   LISTAGG(cc.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY cc.POSITION),
                   c.R_OWNER, referenced.TABLE_NAME,
                   LISTAGG(rc.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY cc.POSITION),
                   c.DELETE_RULE, c.VALIDATED
            FROM ALL_CONSTRAINTS c
            LEFT JOIN ALL_CONS_COLUMNS cc ON cc.OWNER = c.OWNER AND cc.CONSTRAINT_NAME = c.CONSTRAINT_NAME
            LEFT JOIN ALL_CONSTRAINTS referenced ON referenced.OWNER = c.R_OWNER AND referenced.CONSTRAINT_NAME = c.R_CONSTRAINT_NAME
            LEFT JOIN ALL_CONS_COLUMNS rc ON rc.OWNER = c.R_OWNER AND rc.CONSTRAINT_NAME = c.R_CONSTRAINT_NAME AND rc.POSITION = cc.POSITION
            WHERE c.OWNER = :schema_name AND EXISTS (
                SELECT 1 FROM ALL_TABLES t WHERE t.OWNER = c.OWNER AND t.TABLE_NAME = c.TABLE_NAME
                AND {TABLE_FILTER.replace('TABLE_NAME', 't.TABLE_NAME')})
            GROUP BY c.TABLE_NAME, c.CONSTRAINT_NAME, c.CONSTRAINT_TYPE, c.STATUS,
                     c.DEFERRABLE, c.DEFERRED, c.R_CONSTRAINT_NAME, c.R_OWNER, referenced.TABLE_NAME,
                     c.DELETE_RULE, c.VALIDATED
            ORDER BY c.TABLE_NAME, c.CONSTRAINT_TYPE, c.CONSTRAINT_NAME
        """
        headers = ['TABLA', 'NOMBRE_RESTRICCION', 'TIPO', 'TIPO_DESCRIPCION', 'ESTADO', 'DIFERIBLE', 'DIFERIDO',
                   'REFERENCIA', 'COLUMNAS', 'ESQUEMA_REFERENCIA', 'TABLA_REFERENCIA', 'COLUMNAS_REFERENCIA',
                   'REGLA_BORRADO', 'VALIDADA', 'CONDICION_CHECK']
        return self._write(query, filename, headers, lambda r: [v if v is not None else '' for v in r] + [checks.get(r[1]) or ''])

    def extract_indexes_info_csv(self, filename="indices_info.csv"):
        with self.connection.cursor() as cursor:
            cursor.execute("SELECT INDEX_OWNER, INDEX_NAME, COLUMN_POSITION, COLUMN_EXPRESSION FROM ALL_IND_EXPRESSIONS WHERE TABLE_OWNER = :schema_name ORDER BY INDEX_OWNER, INDEX_NAME, COLUMN_POSITION", schema_name=self.schema_name)
            expressions = {}
            for owner, name, position, expression in cursor:
                expressions.setdefault((owner, name), []).append(f'{position}: {expression}')
        query = f"""
            SELECT i.TABLE_NAME, i.INDEX_NAME, i.INDEX_TYPE, i.UNIQUENESS, i.STATUS, i.DEGREE,
                   i.COMPRESSION, LISTAGG(ic.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY ic.COLUMN_POSITION), i.OWNER
            FROM ALL_INDEXES i
            LEFT JOIN ALL_IND_COLUMNS ic ON ic.INDEX_OWNER = i.OWNER AND ic.INDEX_NAME = i.INDEX_NAME
            WHERE i.TABLE_OWNER = :schema_name AND EXISTS (
                SELECT 1 FROM ALL_TABLES t WHERE t.OWNER = i.TABLE_OWNER AND t.TABLE_NAME = i.TABLE_NAME
                AND {TABLE_FILTER.replace('TABLE_NAME', 't.TABLE_NAME')})
            GROUP BY i.TABLE_NAME, i.INDEX_NAME, i.INDEX_TYPE, i.UNIQUENESS, i.STATUS, i.DEGREE, i.COMPRESSION, i.OWNER
            ORDER BY i.TABLE_NAME, i.INDEX_NAME
        """
        headers = ['TABLA', 'NOMBRE_INDICE', 'TIPO_INDICE', 'UNICIDAD', 'ESTADO', 'GRADO', 'COMPRESION', 'COLUMNAS', 'PROPIETARIO_INDICE', 'EXPRESIONES']
        return self._write(query, filename, headers, lambda r: [v if v is not None else '' for v in r] + ['; '.join(expressions.get((r[8], r[1]), []))])

    def create_summary_csv(self, stats, filename="resumen_esquema.csv"):
        with open(filename, 'w', newline='', encoding='utf-8-sig') as output:
            writer = csv.writer(output)
            writer.writerow(['METRICA', 'VALOR'])
            writer.writerows([
                ['Esquema', self.schema_name], ['Fecha de extracción', datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
                ['Tiempo total (segundos)', f"{stats['tiempo_total']:.2f}"], ['Tablas procesadas', stats['tablas']],
                ['Columnas procesadas', stats['columnas']], ['Restricciones procesadas', stats['restricciones']],
                ['Índices procesados', stats['indices']], ['Tablas temp_ excluidas', stats['temp_excluidas']],
                ['Criterio exclusión', 'Nombre contiene TEMP_ literal; no equivale a TEMPORARY=Y'],
                ['NUM_FILAS', 'Estadísticas Oracle; vacío significa sin estadísticas, no cero filas']
            ])

    def extract_full_dictionary_optimized(self):
        self.start_time = time.monotonic()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        directory = PROJECT_ROOT / 'data'
        directory.mkdir(exist_ok=True)
        suffix = f'{self.schema_name.lower()}_{timestamp}.csv'
        if any((directory / f'{section}_{suffix}').exists() for section in ['tablas', 'columnas', 'restricciones', 'indices', 'resumen']):
            raise FileExistsError('Ya existe una extracción con esta fecha')
        try:
            self.connect()
            _, excluded, _ = self.get_table_count()
            with tempfile.TemporaryDirectory(prefix='.extraccion-', dir=directory) as temporary:
                staging = Path(temporary)
                stats = {'temp_excluidas': excluded}
                for section, method in [('tablas', self.extract_tables_info_csv), ('columnas', self.extract_columns_info_csv),
                                        ('restricciones', self.extract_constraints_info_csv), ('indices', self.extract_indexes_info_csv)]:
                    stats[section] = method(staging / f'{section}_{suffix}')
                    print(f'{section}: {stats[section]}')
                stats['tiempo_total'] = time.monotonic() - self.start_time
                self.create_summary_csv(stats, staging / f'resumen_{suffix}')
                manifest = build_manifest(staging, self.schema_name, timestamp)
                for source in staging.iterdir():
                    os.replace(source, directory / source.name)
                # Readers retain the previous snapshot until this final atomic replacement.
                publish_manifest(directory, manifest)
            print('Extracción publicada:', timestamp)
            return stats
        finally:
            self.disconnect()

if __name__ == '__main__':
    import argparse
    import cx_Oracle
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--schema', default='SPE')
    args = parser.parse_args()
    try:
        OptimizedDataDictionaryExtractor(args.schema).extract_full_dictionary_optimized()
    except cx_Oracle.Error as exc:
        print('Extracción fallida. Código Oracle:', getattr(exc.args[0], 'code', None))
        raise SystemExit(1)
    except (ValueError, OSError, csv.Error) as exc:
        print('Extracción fallida:', exc)
        raise SystemExit(1)
