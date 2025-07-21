import cx_Oracle
import os
import pandas as pd
from dotenv import load_dotenv
from datetime import datetime
import json

# Cargar variables de entorno
load_dotenv()

class DataDictionaryExtractor:
    """Clase para extraer el diccionario de datos de un esquema Oracle específico"""
    
    def __init__(self, schema_name):
        self.host = os.getenv('DB_HOST')
        self.port = os.getenv('DB_PORT')
        self.service_name = os.getenv('DB_SERVICE_NAME')
        self.user = os.getenv('DB_USER')
        self.password = os.getenv('DB_PASSWORD')
        self.connection = None
        self.schema_name = schema_name.upper()  # Oracle siempre en mayúsculas
        
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
            print(f"✅ Conectado para extraer diccionario de datos del esquema: {self.schema_name}")
            
        except cx_Oracle.DatabaseError as e:
            print(f"❌ Error de conexión: {e}")
            raise
    
    def disconnect(self):
        """Cerrar la conexión"""
        if self.connection:
            self.connection.close()
            print("🔒 Conexión cerrada")
    
    def get_tables_info(self):
        """Obtener información de todas las tablas del esquema (excluyendo tablas temp_)"""
        query = """
        SELECT 
            TABLE_NAME as "Tabla",
            NUM_ROWS as "Num_Filas",
            TABLESPACE_NAME as "Tablespace",
            STATUS as "Estado",
            LAST_ANALYZED as "Ultimo_Analisis"
        FROM ALL_TABLES 
        WHERE OWNER = :schema_name
        AND UPPER(TABLE_NAME) NOT LIKE '%TEMP_%'
        ORDER BY TABLE_NAME
        """
        
        cursor = self.connection.cursor()
        cursor.execute(query, schema_name=self.schema_name)
        columns = [col[0] for col in cursor.description]
        data = cursor.fetchall()
        cursor.close()
        
        return pd.DataFrame(data, columns=columns)
    
    def get_columns_info(self):
        """Obtener información detallada de todas las columnas (excluyendo tablas temp_)"""
        query = """
        SELECT 
            c.TABLE_NAME as "Tabla",
            c.COLUMN_NAME as "Columna",
            c.DATA_TYPE as "Tipo_Dato",
            CASE 
                WHEN c.DATA_TYPE IN ('VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR') THEN 
                    c.DATA_TYPE || '(' || c.DATA_LENGTH || ')'
                WHEN c.DATA_TYPE = 'NUMBER' AND c.DATA_PRECISION IS NOT NULL THEN 
                    c.DATA_TYPE || '(' || c.DATA_PRECISION || 
                    CASE WHEN c.DATA_SCALE IS NOT NULL AND c.DATA_SCALE > 0 
                         THEN ',' || c.DATA_SCALE 
                         ELSE '' END || ')'
                ELSE c.DATA_TYPE
            END as "Tipo_Completo",
            c.NULLABLE as "Permite_Nulos",
            c.DATA_DEFAULT as "Valor_Default",
            cc.COMMENTS as "Comentarios"
        FROM ALL_TAB_COLUMNS c
        LEFT JOIN ALL_COL_COMMENTS cc ON c.OWNER = cc.OWNER 
                                      AND c.TABLE_NAME = cc.TABLE_NAME 
                                      AND c.COLUMN_NAME = cc.COLUMN_NAME
        WHERE c.OWNER = :schema_name
        AND UPPER(c.TABLE_NAME) NOT LIKE '%TEMP_%'
        ORDER BY c.TABLE_NAME, c.COLUMN_ID
        """
        
        cursor = self.connection.cursor()
        cursor.execute(query, schema_name=self.schema_name)
        columns = [col[0] for col in cursor.description]
        data = cursor.fetchall()
        cursor.close()
        
        return pd.DataFrame(data, columns=columns)
    
    def get_constraints_info(self):
        """Obtener información de restricciones (PKs, FKs, UNIQUEs, CHECKs) excluyendo tablas temp_"""
        query = """
        SELECT 
            c.TABLE_NAME as "Tabla",
            c.CONSTRAINT_NAME as "Nombre_Restriccion",
            c.CONSTRAINT_TYPE as "Tipo_Restriccion",
            CASE c.CONSTRAINT_TYPE
                WHEN 'P' THEN 'PRIMARY KEY'
                WHEN 'R' THEN 'FOREIGN KEY'
                WHEN 'U' THEN 'UNIQUE'
                WHEN 'C' THEN 'CHECK'
                ELSE c.CONSTRAINT_TYPE
            END as "Tipo_Descripcion",
            cc.COLUMN_NAME as "Columna",
            c.R_CONSTRAINT_NAME as "Referencia_Restriccion",
            c.STATUS as "Estado"
        FROM ALL_CONSTRAINTS c
        JOIN ALL_CONS_COLUMNS cc ON c.OWNER = cc.OWNER 
                                 AND c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
        WHERE c.OWNER = :schema_name
        AND UPPER(c.TABLE_NAME) NOT LIKE '%TEMP_%'
        ORDER BY c.TABLE_NAME, c.CONSTRAINT_TYPE, cc.POSITION
        """
        
        cursor = self.connection.cursor()
        cursor.execute(query, schema_name=self.schema_name)
        columns = [col[0] for col in cursor.description]
        data = cursor.fetchall()
        cursor.close()
        
        return pd.DataFrame(data, columns=columns)
    
    def get_indexes_info(self):
        """Obtener información de índices (excluyendo tablas temp_)"""
        query = """
        SELECT 
            i.TABLE_NAME as "Tabla",
            i.INDEX_NAME as "Nombre_Indice",
            i.INDEX_TYPE as "Tipo_Indice",
            i.UNIQUENESS as "Unicidad",
            ic.COLUMN_NAME as "Columna",
            ic.COLUMN_POSITION as "Posicion",
            i.STATUS as "Estado"
        FROM ALL_INDEXES i
        JOIN ALL_IND_COLUMNS ic ON i.OWNER = ic.INDEX_OWNER 
                                AND i.INDEX_NAME = ic.INDEX_NAME
        WHERE i.TABLE_OWNER = :schema_name
        AND UPPER(i.TABLE_NAME) NOT LIKE '%TEMP_%'
        ORDER BY i.TABLE_NAME, i.INDEX_NAME, ic.COLUMN_POSITION
        """
        
        cursor = self.connection.cursor()
        cursor.execute(query, schema_name=self.schema_name)
        columns = [col[0] for col in cursor.description]
        data = cursor.fetchall()
        cursor.close()
        
        return pd.DataFrame(data, columns=columns)
    
    def get_schema_summary(self):
        """Obtener resumen general del esquema (excluyendo tablas temp_)"""
        queries = {
            'total_tables': "SELECT COUNT(*) FROM ALL_TABLES WHERE OWNER = :schema_name AND UPPER(TABLE_NAME) NOT LIKE '%TEMP_%'",
            'total_temp_tables': "SELECT COUNT(*) FROM ALL_TABLES WHERE OWNER = :schema_name AND UPPER(TABLE_NAME) LIKE '%TEMP_%'",
            'total_views': "SELECT COUNT(*) FROM ALL_VIEWS WHERE OWNER = :schema_name",
            'total_sequences': "SELECT COUNT(*) FROM ALL_SEQUENCES WHERE SEQUENCE_OWNER = :schema_name",
            'total_procedures': "SELECT COUNT(*) FROM ALL_PROCEDURES WHERE OWNER = :schema_name AND OBJECT_TYPE = 'PROCEDURE'",
            'total_functions': "SELECT COUNT(*) FROM ALL_PROCEDURES WHERE OWNER = :schema_name AND OBJECT_TYPE = 'FUNCTION'"
        }
        
        summary = {}
        cursor = self.connection.cursor()
        
        for key, query in queries.items():
            cursor.execute(query, schema_name=self.schema_name)
            result = cursor.fetchone()
            summary[key] = result[0] if result else 0
        
        cursor.close()
        return summary
    
    def extract_full_dictionary(self):
        """Extraer el diccionario completo de datos"""
        print("🔍 Iniciando extracción del diccionario de datos...")
        
        try:
            self.connect()
            
            # Obtener resumen del esquema
            print("📊 Obteniendo resumen del esquema...")
            summary = self.get_schema_summary()
            
            # Obtener información detallada
            print("📋 Extrayendo información de tablas...")
            tables_df = self.get_tables_info()
            
            print("📋 Extrayendo información de columnas...")
            columns_df = self.get_columns_info()
            
            print("🔗 Extrayendo restricciones...")
            constraints_df = self.get_constraints_info()
            
            print("📇 Extrayendo índices...")
            indexes_df = self.get_indexes_info()
            
            # Crear estructura de datos completa
            dictionary_data = {
                'schema_info': {
                    'schema_name': self.schema_name,
                    'extraction_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'summary': summary
                },
                'tables': tables_df,
                'columns': columns_df,
                'constraints': constraints_df,
                'indexes': indexes_df
            }
            
            self.disconnect()
            print("✅ Diccionario de datos extraído exitosamente")
            
            return dictionary_data
            
        except Exception as e:
            print(f"❌ Error durante la extracción: {e}")
            if self.connection:
                self.disconnect()
            raise
    
    def export_to_excel(self, dictionary_data, filename=None):
        """Exportar el diccionario a Excel"""
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'diccionario_datos_{self.schema_name}_{timestamp}.xlsx'
        
        print(f"📊 Exportando a Excel: {filename}")
        
        with pd.ExcelWriter(filename, engine='openpyxl') as writer:
            # Hoja de resumen
            summary_df = pd.DataFrame([dictionary_data['schema_info']['summary']])
            summary_df.to_excel(writer, sheet_name='Resumen', index=False)
            
            # Hojas con datos detallados
            dictionary_data['tables'].to_excel(writer, sheet_name='Tablas', index=False)
            dictionary_data['columns'].to_excel(writer, sheet_name='Columnas', index=False)
            dictionary_data['constraints'].to_excel(writer, sheet_name='Restricciones', index=False)
            dictionary_data['indexes'].to_excel(writer, sheet_name='Indices', index=False)
        
        print(f"✅ Archivo Excel creado: {filename}")
        return filename
    
    def export_to_json(self, dictionary_data, filename=None):
        """Exportar el diccionario a JSON"""
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'diccionario_datos_{self.schema_name}_{timestamp}.json'
        
        print(f"📄 Exportando a JSON: {filename}")
        
        # Convertir DataFrames a diccionarios para JSON
        json_data = {
            'schema_info': dictionary_data['schema_info'],
            'tables': dictionary_data['tables'].to_dict('records'),
            'columns': dictionary_data['columns'].to_dict('records'),
            'constraints': dictionary_data['constraints'].to_dict('records'),
            'indexes': dictionary_data['indexes'].to_dict('records')
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"✅ Archivo JSON creado: {filename}")
        return filename

# Ejemplo de uso
if __name__ == "__main__":
    # Esquema específico: SPE (excluyendo tablas temp_)
    SCHEMA_NAME = "SPE"
    
    print(f"🔍 Iniciando extracción del diccionario de datos para el esquema: {SCHEMA_NAME}")
    print("⚠️ Excluyendo tablas que contengan 'temp_' en su nombre")
    
    try:
        # Crear el extractor
        extractor = DataDictionaryExtractor(SCHEMA_NAME)
        
        # Extraer el diccionario completo
        dictionary_data = extractor.extract_full_dictionary()
        
        # Mostrar resumen
        print(f"\n📊 RESUMEN DEL ESQUEMA {SCHEMA_NAME}:")
        for key, value in dictionary_data['schema_info']['summary'].items():
            if key == 'total_temp_tables':
                print(f"   Tablas temp_ excluidas: {value}")
            else:
                print(f"   {key.replace('_', ' ').title()}: {value}")
        
        # Exportar a Excel
        excel_file = extractor.export_to_excel(dictionary_data)
        
        # Exportar a JSON
        json_file = extractor.export_to_json(dictionary_data)
        
        print(f"\n🎉 Proceso completado exitosamente!")
        print(f"   📊 Excel: {excel_file}")
        print(f"   📄 JSON: {json_file}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
