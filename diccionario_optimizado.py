import cx_Oracle
import os
import csv
import time
from dotenv import load_dotenv
from datetime import datetime

# Cargar variables de entorno
load_dotenv()

class OptimizedDataDictionaryExtractor:
    """Extractor optimizado del diccionario de datos Oracle"""
    
    def __init__(self, schema_name="SPE"):
        self.host = os.getenv('DB_HOST')
        self.port = os.getenv('DB_PORT')
        self.service_name = os.getenv('DB_SERVICE_NAME')
        self.user = os.getenv('DB_USER')
        self.password = os.getenv('DB_PASSWORD')
        self.connection = None
        self.schema_name = schema_name.upper()
        self.start_time = None
        
    def connect(self):
        """Establecer conexión a la base de datos"""
        try:
            dsn_tns = cx_Oracle.makedsn(
                host=self.host,
                port=self.port,
                service_name=self.service_name
            )
            
            self.connection = cx_Oracle.connect(
                user=self.user,
                password=self.password,
                dsn=dsn_tns
            )
            print(f"✅ Conectado para extraer esquema: {self.schema_name}")
            
        except cx_Oracle.DatabaseError as e:
            print(f"❌ Error de conexión: {e}")
            raise
    
    def disconnect(self):
        """Cerrar la conexión"""
        if self.connection:
            self.connection.close()
            print("🔒 Conexión cerrada")
    
    def get_table_count(self):
        """Obtener conteo rápido de tablas"""
        query = """
        SELECT 
            COUNT(*) as total_tables,
            COUNT(CASE WHEN UPPER(TABLE_NAME) LIKE '%TEMP_%' THEN 1 END) as temp_tables
        FROM ALL_TABLES 
        WHERE OWNER = :schema_name
        """
        
        cursor = self.connection.cursor()
        cursor.execute(query, schema_name=self.schema_name)
        result = cursor.fetchone()
        cursor.close()
        
        total, temp = result
        return total, temp, total - temp
    
    def extract_tables_info_csv(self, filename="tablas_info.csv"):
        """Extraer información de tablas a CSV"""
        print("📋 Extrayendo información de tablas...")
        
        query = """
        SELECT 
            TABLE_NAME,
            NUM_ROWS,
            BLOCKS,
            EMPTY_BLOCKS,
            AVG_ROW_LEN,
            TABLESPACE_NAME,
            STATUS,
            LAST_ANALYZED,
            DEGREE,
            COMPRESSION
        FROM ALL_TABLES 
        WHERE OWNER = :schema_name
        AND UPPER(TABLE_NAME) NOT LIKE '%TEMP_%'
        ORDER BY TABLE_NAME
        """
        
        cursor = self.connection.cursor()
        cursor.execute(query, schema_name=self.schema_name)
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['TABLA', 'NUM_FILAS', 'BLOQUES', 'BLOQUES_VACIOS', 
                         'LONGITUD_PROMEDIO_FILA', 'TABLESPACE', 'ESTADO', 
                         'ULTIMO_ANALISIS', 'GRADO', 'COMPRESION']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            count = 0
            for row in cursor:
                writer.writerow({
                    'TABLA': row[0],
                    'NUM_FILAS': row[1] or 0,
                    'BLOQUES': row[2] or 0,
                    'BLOQUES_VACIOS': row[3] or 0,
                    'LONGITUD_PROMEDIO_FILA': row[4] or 0,
                    'TABLESPACE': row[5] or 'N/A',
                    'ESTADO': row[6] or 'N/A',
                    'ULTIMO_ANALISIS': row[7].strftime('%Y-%m-%d %H:%M:%S') if row[7] else 'N/A',
                    'GRADO': row[8] or 'N/A',
                    'COMPRESION': row[9] or 'N/A'
                })
                count += 1
                if count % 50 == 0:
                    print(f"   Procesadas {count} tablas...")
        
        cursor.close()
        print(f"✅ Información de tablas guardada en {filename} ({count} tablas)")
        return count
    
    def extract_columns_info_csv(self, filename="columnas_info.csv"):
        """Extraer información de columnas a CSV de forma optimizada"""
        print("📋 Extrayendo información de columnas...")
        
        # Consulta optimizada sin joins complejos
        query = """
        SELECT 
            c.TABLE_NAME,
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.DATA_LENGTH,
            c.DATA_PRECISION,
            c.DATA_SCALE,
            c.NULLABLE,
            c.COLUMN_ID,
            c.DEFAULT_LENGTH,
            c.DATA_DEFAULT
        FROM ALL_TAB_COLUMNS c
        WHERE c.OWNER = :schema_name
        AND EXISTS (
            SELECT 1 FROM ALL_TABLES t 
            WHERE t.OWNER = c.OWNER 
            AND t.TABLE_NAME = c.TABLE_NAME
            AND UPPER(t.TABLE_NAME) NOT LIKE '%TEMP_%'
        )
        ORDER BY c.TABLE_NAME, c.COLUMN_ID
        """
        
        cursor = self.connection.cursor()
        cursor.execute(query, schema_name=self.schema_name)
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['TABLA', 'COLUMNA', 'TIPO_DATO', 'TIPO_COMPLETO', 
                         'LONGITUD', 'PRECISION', 'ESCALA', 'PERMITE_NULOS', 
                         'POSICION', 'VALOR_DEFAULT']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            count = 0
            current_table = None
            
            for row in cursor:
                table_name = row[0]
                if table_name != current_table:
                    current_table = table_name
                    if count % 100 == 0:
                        print(f"   Procesando tabla: {table_name} (columna #{count})")
                
                # Construir tipo completo
                data_type = row[2]
                if data_type in ('VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR'):
                    tipo_completo = f"{data_type}({row[3]})"
                elif data_type == 'NUMBER' and row[4] is not None:
                    if row[5] is not None and row[5] > 0:
                        tipo_completo = f"{data_type}({row[4]},{row[5]})"
                    else:
                        tipo_completo = f"{data_type}({row[4]})"
                else:
                    tipo_completo = data_type
                
                writer.writerow({
                    'TABLA': table_name,
                    'COLUMNA': row[1],
                    'TIPO_DATO': data_type,
                    'TIPO_COMPLETO': tipo_completo,
                    'LONGITUD': row[3] or '',
                    'PRECISION': row[4] or '',
                    'ESCALA': row[5] or '',
                    'PERMITE_NULOS': row[6],
                    'POSICION': row[7],
                    'VALOR_DEFAULT': str(row[9])[:100] if row[9] else ''  # Truncar defaults largos
                })
                count += 1
        
        cursor.close()
        print(f"✅ Información de columnas guardada en {filename} ({count} columnas)")
        return count
    
    def extract_constraints_info_csv(self, filename="restricciones_info.csv"):
        """Extraer información de restricciones de forma optimizada"""
        print("📋 Extrayendo restricciones...")
        
        query = """
        SELECT 
            c.TABLE_NAME,
            c.CONSTRAINT_NAME,
            c.CONSTRAINT_TYPE,
            CASE c.CONSTRAINT_TYPE
                WHEN 'P' THEN 'PRIMARY KEY'
                WHEN 'R' THEN 'FOREIGN KEY'
                WHEN 'U' THEN 'UNIQUE'
                WHEN 'C' THEN 'CHECK'
                ELSE c.CONSTRAINT_TYPE
            END as TIPO_DESC,
            c.STATUS,
            c.DEFERRABLE,
            c.DEFERRED,
            c.R_CONSTRAINT_NAME,
            LISTAGG(cc.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY cc.POSITION) as COLUMNAS
        FROM ALL_CONSTRAINTS c
        LEFT JOIN ALL_CONS_COLUMNS cc ON c.OWNER = cc.OWNER 
                                      AND c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
        WHERE c.OWNER = :schema_name
        AND EXISTS (
            SELECT 1 FROM ALL_TABLES t 
            WHERE t.OWNER = c.OWNER 
            AND t.TABLE_NAME = c.TABLE_NAME
            AND UPPER(t.TABLE_NAME) NOT LIKE '%TEMP_%'
        )
        GROUP BY c.TABLE_NAME, c.CONSTRAINT_NAME, c.CONSTRAINT_TYPE, c.STATUS, 
                 c.DEFERRABLE, c.DEFERRED, c.R_CONSTRAINT_NAME
        ORDER BY c.TABLE_NAME, c.CONSTRAINT_TYPE
        """
        
        cursor = self.connection.cursor()
        cursor.execute(query, schema_name=self.schema_name)
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['TABLA', 'NOMBRE_RESTRICCION', 'TIPO', 'TIPO_DESCRIPCION', 
                         'ESTADO', 'DIFERIBLE', 'DIFERIDO', 'REFERENCIA', 'COLUMNAS']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            count = 0
            for row in cursor:
                writer.writerow({
                    'TABLA': row[0],
                    'NOMBRE_RESTRICCION': row[1],
                    'TIPO': row[2],
                    'TIPO_DESCRIPCION': row[3],
                    'ESTADO': row[4],
                    'DIFERIBLE': row[5] or 'N/A',
                    'DIFERIDO': row[6] or 'N/A',
                    'REFERENCIA': row[7] or '',
                    'COLUMNAS': row[8] or ''
                })
                count += 1
                if count % 100 == 0:
                    print(f"   Procesadas {count} restricciones...")
        
        cursor.close()
        print(f"✅ Restricciones guardadas en {filename} ({count} restricciones)")
        return count
    
    def extract_indexes_info_csv(self, filename="indices_info.csv"):
        """Extraer información de índices de forma optimizada"""
        print("📋 Extrayendo índices...")
        
        query = """
        SELECT 
            i.TABLE_NAME,
            i.INDEX_NAME,
            i.INDEX_TYPE,
            i.UNIQUENESS,
            i.STATUS,
            i.DEGREE,
            i.COMPRESSION,
            LISTAGG(ic.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY ic.COLUMN_POSITION) as COLUMNAS
        FROM ALL_INDEXES i
        LEFT JOIN ALL_IND_COLUMNS ic ON i.OWNER = ic.INDEX_OWNER 
                                     AND i.INDEX_NAME = ic.INDEX_NAME
        WHERE i.TABLE_OWNER = :schema_name
        AND EXISTS (
            SELECT 1 FROM ALL_TABLES t 
            WHERE t.OWNER = i.TABLE_OWNER 
            AND t.TABLE_NAME = i.TABLE_NAME
            AND UPPER(t.TABLE_NAME) NOT LIKE '%TEMP_%'
        )
        GROUP BY i.TABLE_NAME, i.INDEX_NAME, i.INDEX_TYPE, i.UNIQUENESS, 
                 i.STATUS, i.DEGREE, i.COMPRESSION
        ORDER BY i.TABLE_NAME, i.INDEX_NAME
        """
        
        cursor = self.connection.cursor()
        cursor.execute(query, schema_name=self.schema_name)
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['TABLA', 'NOMBRE_INDICE', 'TIPO_INDICE', 'UNICIDAD', 
                         'ESTADO', 'GRADO', 'COMPRESION', 'COLUMNAS']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            count = 0
            for row in cursor:
                writer.writerow({
                    'TABLA': row[0],
                    'NOMBRE_INDICE': row[1],
                    'TIPO_INDICE': row[2],
                    'UNICIDAD': row[3],
                    'ESTADO': row[4],
                    'GRADO': row[5] or 'N/A',
                    'COMPRESION': row[6] or 'DISABLED',
                    'COLUMNAS': row[7] or ''
                })
                count += 1
                if count % 100 == 0:
                    print(f"   Procesados {count} índices...")
        
        cursor.close()
        print(f"✅ Índices guardados en {filename} ({count} índices)")
        return count
    
    def create_summary_csv(self, stats, filename="resumen_esquema.csv"):
        """Crear archivo de resumen"""
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['METRICA', 'VALOR']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            writer.writerow({'METRICA': 'Esquema', 'VALOR': self.schema_name})
            writer.writerow({'METRICA': 'Fecha de extracción', 'VALOR': datetime.now().strftime('%Y-%m-%d %H:%M:%S')})
            writer.writerow({'METRICA': 'Tiempo total (segundos)', 'VALOR': f"{stats['tiempo_total']:.2f}"})
            writer.writerow({'METRICA': 'Tablas procesadas', 'VALOR': stats['tablas']})
            writer.writerow({'METRICA': 'Columnas procesadas', 'VALOR': stats['columnas']})
            writer.writerow({'METRICA': 'Restricciones procesadas', 'VALOR': stats['restricciones']})
            writer.writerow({'METRICA': 'Índices procesados', 'VALOR': stats['indices']})
            writer.writerow({'METRICA': 'Tablas temp_ excluidas', 'VALOR': stats['temp_excluidas']})
        
        print(f"✅ Resumen guardado en {filename}")
    
    def extract_full_dictionary_optimized(self):
        """Extraer el diccionario completo de forma optimizada"""
        self.start_time = time.time()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        print(f"🚀 EXTRACCIÓN OPTIMIZADA DEL ESQUEMA {self.schema_name}")
        print("=" * 60)
        
        try:
            self.connect()
            
            # Obtener conteos rápidos
            total_tables, temp_tables, process_tables = self.get_table_count()
            print(f"📊 Total tablas: {total_tables}")
            print(f"📊 Tablas temp_: {temp_tables}")
            print(f"📊 Tablas a procesar: {process_tables}")
            print("=" * 60)
            
            # Extraer cada tipo de información
            stats = {
                'temp_excluidas': temp_tables,
                'tablas': self.extract_tables_info_csv(f"tablas_spe_{timestamp}.csv"),
                'columnas': self.extract_columns_info_csv(f"columnas_spe_{timestamp}.csv"),
                'restricciones': self.extract_constraints_info_csv(f"restricciones_spe_{timestamp}.csv"),
                'indices': self.extract_indexes_info_csv(f"indices_spe_{timestamp}.csv")
            }
            
            # Calcular tiempo total
            end_time = time.time()
            stats['tiempo_total'] = end_time - self.start_time
            
            # Crear resumen
            self.create_summary_csv(stats, f"resumen_spe_{timestamp}.csv")
            
            self.disconnect()
            
            print("=" * 60)
            print(f"🎉 EXTRACCIÓN COMPLETADA EN {stats['tiempo_total']:.2f} SEGUNDOS")
            print(f"📁 Archivos generados:")
            print(f"   📊 tablas_spe_{timestamp}.csv")
            print(f"   📋 columnas_spe_{timestamp}.csv")
            print(f"   🔗 restricciones_spe_{timestamp}.csv")
            print(f"   📇 indices_spe_{timestamp}.csv")
            print(f"   📈 resumen_spe_{timestamp}.csv")
            
            return stats
            
        except Exception as e:
            print(f"❌ Error durante la extracción: {e}")
            if self.connection:
                self.disconnect()
            raise

if __name__ == "__main__":
    print("🔍 Iniciando extracción optimizada del esquema SPE")
    print("⚡ Versión optimizada para mayor velocidad")
    print("📁 Generando archivos CSV separados")
    
    try:
        extractor = OptimizedDataDictionaryExtractor("SPE")
        stats = extractor.extract_full_dictionary_optimized()
        
        print(f"\n📊 ESTADÍSTICAS FINALES:")
        print(f"   Tiempo total: {stats['tiempo_total']:.2f} segundos")
        print(f"   Tablas: {stats['tablas']}")
        print(f"   Columnas: {stats['columnas']}")
        print(f"   Restricciones: {stats['restricciones']}")
        print(f"   Índices: {stats['indices']}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
