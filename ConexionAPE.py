import cx_Oracle
import os
from dotenv import load_dotenv

# Cargar variables de entorno desde el archivo .env
load_dotenv()

class DatabaseConnection:
    """Clase para manejar la conexión a la base de datos Oracle de forma segura"""
    
    def __init__(self):
        self.host = os.getenv('DB_HOST')
        self.port = os.getenv('DB_PORT')
        self.service_name = os.getenv('DB_SERVICE_NAME')
        self.user = os.getenv('DB_USER')
        self.password = os.getenv('DB_PASSWORD')
        self.connection = None
        
    def validate_credentials(self):
        """Validar que todas las credenciales estén disponibles"""
        if not all([self.host, self.port, self.service_name, self.user, self.password]):
            raise ValueError("Faltan credenciales de la base de datos en el archivo .env")
    
    def connect(self):
        """Establecer conexión a la base de datos"""
        try:
            self.validate_credentials()
            
            # Crear DSN
            dsn_tns = cx_Oracle.makedsn(
                host=self.host,
                port=self.port,
                service_name=self.service_name
            )
            
            # Establecer conexión
            self.connection = cx_Oracle.connect(
                user=self.user,
                password=self.password,
                dsn=dsn_tns
            )
            
            print("✅ Conexión exitosa a la base de datos Oracle")
            return self.connection
            
        except cx_Oracle.DatabaseError as e:
            print(f"❌ Error de base de datos: {e}")
            raise
        except ValueError as e:
            print(f"❌ Error de configuración: {e}")
            raise
        except Exception as e:
            print(f"❌ Error inesperado: {e}")
            raise
    
    def disconnect(self):
        """Cerrar la conexión a la base de datos"""
        if self.connection:
            try:
                self.connection.close()
                print("🔒 Conexión cerrada correctamente")
            except Exception as e:
                print(f"⚠️ Error al cerrar la conexión: {e}")
    
    def __enter__(self):
        """Soporte para context manager (with statement)"""
        return self.connect()
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Cerrar conexión automáticamente al salir del context manager"""
        self.disconnect()

# Ejemplo de uso
if __name__ == "__main__":
    # Opción 1: Uso básico
    db = DatabaseConnection()
    try:
        conn = db.connect()
        # Aquí puedes realizar tus consultas
        db.disconnect()
    except Exception as e:
        print(f"No se pudo establecer la conexión: {e}")
    
    # Opción 2: Uso con context manager (recomendado)
    try:
        with DatabaseConnection() as conn:
            print("🔍 Conexión lista para realizar consultas")
            # Aquí puedes realizar tus consultas
            # La conexión se cerrará automáticamente
    except Exception as e:
        print(f"No se pudo establecer la conexión: {e}")