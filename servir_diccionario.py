"""Local HTTP server exposing only the dictionary's public artifacts."""
import argparse
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
PUBLIC_FILES = {
    'index.html', 'diccionario_viewer.html', 'diccionario_viewer.js',
    'assets/styles.css', 'assets/script_fixed.js', 'assets/dictionary_core.js', 'assets/dictionary_details.css',
    'data/manifest.json', 'assets/ape-logo.svg', 'assets/ape_brand.css',
    'mer.html', 'assets/mer.css', 'assets/mer.js', 'assets/mer_model.js',
    'assets/vendor/cytoscape.min.js', 'assets/vendor/elk.bundled.js',
}


class DictionaryHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        requested = unquote(urlsplit(self.path).path).lstrip('/') or 'index.html'
        allowed = requested in PUBLIC_FILES or re.fullmatch(
            r'data/(tablas|columnas|restricciones|indices|resumen)_[a-z][a-z0-9_]*_\d{8}_\d{6}\.csv', requested
        )
        target = (ROOT / requested).resolve()
        if not allowed or not target.is_relative_to(ROOT) or not target.is_file():
            self.send_error(404, 'Archivo no disponible')
            return None
        # Normalization prevents redirects/listings for directory and encoded paths.
        self.path = '/' + requested
        return super().send_head()

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy',
                         "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; "
                         "style-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; "
                         "font-src 'self' https://cdnjs.cloudflare.com data:; img-src 'self' data:; "
                         "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        super().end_headers()

    def log_message(self, format, *args):
        # Log only status, without retaining potentially sensitive URL parameters.
        if len(args) >= 2:
            print('HTTP', args[1])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), DictionaryHandler)
    print(f'Diccionario disponible en http://127.0.0.1:{args.port}/diccionario_viewer.html')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
