"""Conexión Oracle compartida por los extractores de metadatos."""
import os
from pathlib import Path
import cx_Oracle
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / '.env')

class DatabaseConnection:
    def __init__(self):
        self.host = os.getenv('DB_HOST')
        self.port = os.getenv('DB_PORT')
        self.service_name = os.getenv('DB_SERVICE_NAME')
        self.user = os.getenv('DB_USER')
        self.password = os.getenv('DB_PASSWORD')
        self.connection = None

    def validate_credentials(self):
        if not all([self.host, self.port, self.service_name, self.user, self.password]):
            raise ValueError('Faltan variables obligatorias DB_* en la configuración')
        try:
            port = int(self.port)
        except (TypeError, ValueError):
            raise ValueError('DB_PORT debe ser un número entero') from None
        if not 1 <= port <= 65535:
            raise ValueError('DB_PORT fuera de rango')
        # Avoid injecting descriptor syntax through configuration fields.
        if any(ch in value for value in [self.host, self.service_name] for ch in '()\n\r'):
            raise ValueError('Host o servicio Oracle inválido')

    def connect(self):
        if self.connection is not None:
            return self.connection
        self.validate_credentials()
        protocol = os.getenv('DB_PROTOCOL', 'TCP').upper()
        if protocol not in ('TCP', 'TCPS'):
            raise ValueError('DB_PROTOCOL debe ser TCP o TCPS')
        connect_timeout = self._positive_int('DB_CONNECT_TIMEOUT_SECONDS', 5)
        call_timeout = self._positive_int('DB_CALL_TIMEOUT_MS', 30000)
        dsn = (
            f'(DESCRIPTION=(CONNECT_TIMEOUT={connect_timeout})'
            f'(TRANSPORT_CONNECT_TIMEOUT={connect_timeout})(RETRY_COUNT=0)'
            f'(ADDRESS=(PROTOCOL={protocol})(HOST={self.host})(PORT={int(self.port)}))'
            f'(CONNECT_DATA=(SERVICE_NAME={self.service_name})))'
        )
        connection = cx_Oracle.connect(user=self.user, password=self.password, dsn=dsn)
        try:
            connection.call_timeout = call_timeout
        except Exception:
            connection.close()
            raise
        self.connection = connection
        return connection

    @staticmethod
    def _positive_int(name, default):
        try:
            value = int(os.getenv(name, str(default)))
        except ValueError:
            raise ValueError(f'{name} debe ser un entero positivo') from None
        if value <= 0:
            raise ValueError(f'{name} debe ser un entero positivo')
        return value

    def disconnect(self):
        connection, self.connection = self.connection, None
        if connection is not None:
            connection.close()

    def __enter__(self):
        return self.connect()

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()

if __name__ == '__main__':
    try:
        with DatabaseConnection() as conn:
            with conn.cursor() as cursor:
                cursor.execute('SELECT 1 FROM DUAL')
                print('Conexión Oracle validada:', cursor.fetchone()[0])
    except (cx_Oracle.Error, ValueError) as exc:
        code = getattr(exc.args[0], 'code', None) if exc.args else None
        print('No fue posible validar la conexión. Código Oracle:', code)
        raise SystemExit(1)
