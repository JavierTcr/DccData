from ConexionAPE import DatabaseConnection

class SchemaExplorer(DatabaseConnection):
    """Explora los metadatos visibles para la cuenta configurada."""

    def list_available_schemas(self):
        """Listar esquemas disponibles para el usuario actual"""
        query = """
        SELECT DISTINCT OWNER as SCHEMA_NAME, 
               COUNT(*) as TOTAL_TABLES
        FROM ALL_TABLES 
        WHERE OWNER NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'DIP', 'ORACLE_OCM', 'DBSNMP', 
                           'APPQOSSYS', 'WMSYS', 'EXFSYS', 'CTXSYS', 'ANONYMOUS', 'XDB', 
                           'ORDPLUGINS', 'OWBSYS', 'ORDDATA', 'SI_INFORMTN_SCHEMA', 
                           'OLAPSYS', 'MDDATA', 'SPATIAL_WFS_ADMIN_USR', 'SPATIAL_CSW_ADMIN_USR',
                           'APEX_040000', 'APEX_PUBLIC_USER', 'FLOWS_FILES', 'MDSYS',
                           'ORDSYS', 'XS$NULL')
        GROUP BY OWNER
        ORDER BY OWNER
        """
        
        cursor = self.connection.cursor()
        cursor.execute(query)
        
        print("\n📂 ESQUEMAS DISPONIBLES:")
        print("-" * 50)
        print(f"{'Esquema':<25} {'Total Tablas':<12}")
        print("-" * 50)
        
        schemas = []
        for row in cursor:
            schema_name, table_count = row
            schemas.append((schema_name, table_count))
            print(f"{schema_name:<25} {table_count:<12}")
        
        cursor.close()
        print("-" * 50)
        print(f"Total esquemas encontrados: {len(schemas)}")
        
        return schemas
    
    def get_schema_preview(self, schema_name):
        """Obtener una vista previa de un esquema específico"""
        schema_name = schema_name.upper()
        
        # Información básica del esquema
        queries = {
            'tables': "SELECT COUNT(*) FROM ALL_TABLES WHERE OWNER = :schema",
            'views': "SELECT COUNT(*) FROM ALL_VIEWS WHERE OWNER = :schema",
            'sequences': "SELECT COUNT(*) FROM ALL_SEQUENCES WHERE SEQUENCE_OWNER = :schema"
        }
        
        cursor = self.connection.cursor()
        
        print(f"\n🔍 VISTA PREVIA DEL ESQUEMA: {schema_name}")
        print("=" * 60)
        
        for item_type, query in queries.items():
            cursor.execute(query, schema=schema_name)
            count = cursor.fetchone()[0]
            print(f"{item_type.capitalize()}: {count}")
        
        # Mostrar algunas tablas de ejemplo
        print(f"\n📋 PRIMERAS 10 TABLAS DEL ESQUEMA {schema_name}:")
        print("-" * 60)
        
        tables_query = """
        SELECT TABLE_NAME, NUM_ROWS, TABLESPACE_NAME
        FROM ALL_TABLES 
        WHERE OWNER = :schema
        AND ROWNUM <= 10
        ORDER BY TABLE_NAME
        """
        
        cursor.execute(tables_query, schema=schema_name)
        print(f"{'Tabla':<30} {'Filas':<10} {'Tablespace':<20}")
        print("-" * 60)
        
        for row in cursor:
            table_name = row[0] or 'N/A'
            num_rows = row[1] or 0
            tablespace = row[2] or 'N/A'
            print(f"{table_name:<30} {num_rows:<10} {tablespace:<20}")
        
        cursor.close()

if __name__ == "__main__":
    explorer = SchemaExplorer()
    
    try:
        explorer.connect()
        
        # Listar esquemas disponibles
        schemas = explorer.list_available_schemas()
        
        # Si hay esquemas, mostrar vista previa del primero o uno específico
        if schemas:
            print(f"\n¿Qué esquema te interesa analizar?")
            print("Esquemas disponibles:")
            for i, (schema_name, count) in enumerate(schemas, 1):
                print(f"  {i}. {schema_name} ({count} tablas)")
            
            # Por defecto, mostrar vista previa del primer esquema
            if schemas:
                first_schema = schemas[0][0]
                print(f"\nMostrando vista previa del esquema: {first_schema}")
                explorer.get_schema_preview(first_schema)
        
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise SystemExit(1)
    finally:
        explorer.disconnect()
