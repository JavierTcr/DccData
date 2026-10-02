"""Validate and atomically publish a complete dictionary snapshot."""
import csv
import json
import os
import re
import tempfile
from pathlib import Path

SECTIONS = ('tablas', 'columnas', 'restricciones', 'indices')
REQUIRED = {
    'tablas': {'TABLA', 'NUM_FILAS'},
    'columnas': {'TABLA', 'COLUMNA', 'TIPO_DATO'},
    'restricciones': {'TABLA', 'TIPO', 'COLUMNAS'},
    'indices': {'TABLA', 'NOMBRE_INDICE'},
}


def build_manifest(directory, schema, timestamp):
    if not re.fullmatch(r'[A-Z][A-Z0-9_]*', schema) or not re.fullmatch(r'\d{8}_\d{6}', timestamp):
        raise ValueError('Esquema o fecha de extracción inválidos')
    directory = Path(directory)
    data, files = {}, {}
    for section in SECTIONS:
        filename = f'{section}_{schema.lower()}_{timestamp}.csv'
        files[section] = filename
        raw = (directory / filename).read_bytes()
        try:
            text = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            text = raw.decode('cp1252')
        import io
        reader = csv.DictReader(io.StringIO(text, newline=''), strict=True)
        if not REQUIRED[section].issubset(reader.fieldnames or []):
            raise ValueError(f'Cabeceras incompletas: {filename}')
        rows = list(reader)
        if any(None in row or any(v is None for v in row.values()) or not row['TABLA'] for row in rows):
            raise ValueError(f'Registros incompletos: {filename}')
        data[section] = rows
    tables = {row['TABLA'] for row in data['tablas']}
    if not tables or not data['columnas'] or len(tables) != len(data['tablas']):
        raise ValueError('Diccionario vacío o tablas duplicadas')
    if any(row['TABLA'] not in tables for section in SECTIONS[1:] for row in data[section]):
        raise ValueError('Referencias a tablas ausentes')
    manifest = {'version': 1, 'schema': schema, 'timestamp': timestamp,
                'files': files, 'counts': {key: len(rows) for key, rows in data.items()}}
    summary_path = directory / f'resumen_{schema.lower()}_{timestamp}.csv'
    if summary_path.exists():
        with summary_path.open(encoding='utf-8-sig', newline='') as source:
            summary = list(csv.DictReader(source))
        for row in summary:
            if row.get('METRICA', '').startswith('Tiempo total'):
                manifest['duration_seconds'] = float(row['VALOR'])
            if row.get('METRICA', '').startswith('Tablas temp_'):
                manifest['excluded_tables'] = int(row['VALOR'])
    return manifest


def publish_manifest(directory, manifest):
    directory = Path(directory)
    descriptor, name = tempfile.mkstemp(prefix='.manifest-', suffix='.tmp', dir=directory)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
            json.dump(manifest, output, ensure_ascii=False, indent=2)
            output.write('\n')
            output.flush()
            os.fsync(output.fileno())
        os.replace(name, directory / 'manifest.json')
    finally:
        if Path(name).exists():
            Path(name).unlink()


if __name__ == '__main__':
    directory = Path(__file__).resolve().parent / 'data'
    candidates = sorted(directory.glob('tablas_spe_*.csv'), reverse=True)
    for candidate in candidates:
        try:
            manifest = build_manifest(directory, 'SPE', candidate.stem.removeprefix('tablas_spe_'))
        except (OSError, ValueError, csv.Error):
            continue
        publish_manifest(directory, manifest)
        print('Manifiesto publicado:', manifest['timestamp'], manifest['counts'])
        break
    else:
        raise SystemExit('No existe una extracción completa y válida')
