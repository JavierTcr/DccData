import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

from ConexionAPE import DatabaseConnection
from diccionario_optimizado_fixed import OptimizedDataDictionaryExtractor, TABLE_FILTER
from snapshot_manifest import build_manifest, publish_manifest, REQUIRED
from servir_diccionario import PUBLIC_FILES
from servir_diccionario import DictionaryHandler
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.request import urlopen
from urllib.error import HTTPError


class DictionaryTests(unittest.TestCase):
    def test_oracle_type_semantics(self):
        kind = OptimizedDataDictionaryExtractor.complete_type
        self.assertEqual(kind('NUMBER', 22, 10, -2, 0, None), 'NUMBER(10,-2)')
        self.assertEqual(kind('NUMBER', 22, 10, 0, 0, None), 'NUMBER(10,0)')
        self.assertEqual(kind('NUMBER', 22, None, None, 0, None), 'NUMBER')
        self.assertEqual(kind('VARCHAR2', 400, None, None, 100, 'C'), 'VARCHAR2(100 CHAR)')
        self.assertEqual(kind('NVARCHAR2', 200, None, None, 100, 'C'), 'NVARCHAR2(100)')
        self.assertIn("ESCAPE '\\'", TABLE_FILTER)

    def test_connection_reused_and_closed(self):
        connection = MagicMock()
        with patch('ConexionAPE.cx_Oracle.connect', return_value=connection):
            db = DatabaseConnection()
            db.host, db.port, db.service_name, db.user, db.password = 'host', '1521', 'svc', 'user', 'password'
            self.assertIs(db.connect(), db.connect())
            db.disconnect()
            self.assertIsNone(db.connection)
            connection.close.assert_called_once()

    def test_invalid_port(self):
        db = DatabaseConnection()
        db.host, db.port, db.service_name, db.user, db.password = 'host', 'bad', 'svc', 'user', 'password'
        with self.assertRaises(ValueError):
            db.validate_credentials()

    def test_manifest_rejects_partial_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            timestamp = '20260101_010101'
            for section, required in REQUIRED.items():
                with (directory / f'{section}_spe_{timestamp}.csv').open('w', newline='', encoding='utf-8') as file:
                    fields = sorted(required)
                    writer = csv.DictWriter(file, fieldnames=fields)
                    writer.writeheader()
                    writer.writerow({field: 'T' if field == 'TABLA' else 'X' for field in fields})
            manifest = build_manifest(directory, 'SPE', timestamp)
            publish_manifest(directory, manifest)
            before = (directory / 'manifest.json').read_bytes()
            (directory / f'indices_spe_{timestamp}.csv').unlink()
            with self.assertRaises(FileNotFoundError):
                build_manifest(directory, 'SPE', timestamp)
            self.assertEqual((directory / 'manifest.json').read_bytes(), before)

    def test_failed_extraction_keeps_published_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            marker = root / 'data' / 'manifest.json'
            marker.write_text('{"previous":true}', encoding='utf-8')
            extractor = OptimizedDataDictionaryExtractor()
            with patch('diccionario_optimizado_fixed.PROJECT_ROOT', root), \
                 patch.object(extractor, 'connect'), patch.object(extractor, 'disconnect') as close, \
                 patch.object(extractor, 'get_table_count', return_value=(1, 0, 1)), \
                 patch.object(extractor, 'extract_tables_info_csv', side_effect=RuntimeError('query failed')):
                with self.assertRaises(RuntimeError):
                    extractor.extract_full_dictionary_optimized()
                close.assert_called_once()
            self.assertEqual(marker.read_text(), '{"previous":true}')
            self.assertFalse(list((root / 'data').glob('.extraccion-*')))

    def test_secrets_not_public(self):
        self.assertNotIn('.env', PUBLIC_FILES)
        self.assertNotIn('ConexionAPE.py', PUBLIC_FILES)
        self.assertNotIn('.git/config', PUBLIC_FILES)

    def test_http_public_files_and_private_denials(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), DictionaryHandler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            for path in ('/', '/diccionario_viewer.html', '/assets/dictionary_core.js?v=20261001c', '/assets/dictionary_details.css?v=20261001c', '/data/manifest.json', '/mer.html', '/assets/mer.js', '/assets/mer_model.js', '/assets/mer.css', '/assets/vendor/cytoscape.min.js', '/assets/vendor/elk.bundled.js'):
                with urlopen(base + path, timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
                    self.assertIn("object-src 'none'", response.headers['Content-Security-Policy'])
                    self.assertTrue(response.read(), 'Public files must be transferred completely')
            for path in ('/.env', '/.git/config', '/ConexionAPE.py', '/data/', '/%2eenv', '/assets/../.env'):
                with self.assertRaises(HTTPError) as result:
                    urlopen(base + path, timeout=5)
                self.assertEqual(result.exception.code, 404)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == '__main__':
    unittest.main()
