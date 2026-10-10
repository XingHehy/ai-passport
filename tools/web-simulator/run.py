#!/usr/bin/env python3
"""Serve only the generated preview; watch sources and rebuild on changes."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import threading
import time
from build import build, fingerprint, OUTPUT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-watch', action='store_true')
    args = parser.parse_args()
    state = {'id': build(), 'building': False, 'error': None}
    stop = threading.Event()

    class Handler(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.mjs': 'text/javascript'}

        def do_GET(self):
            if self.path == '/__simulator/status':
                body = json.dumps(state).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

        def end_headers(self):
            self.send_header('Cache-Control', 'no-store')
            super().end_headers()

        def log_message(self, format, *values):
            if self.path != '/__simulator/status': super().log_message(format, *values)

    def watch():
        attempted = state['id']
        while not stop.wait(1):
            try:
                current = fingerprint()
                if current == attempted: continue
                attempted = current
                state.update(building=True, error=None)
                print('Source change detected; rebuilding...', flush=True)
                state['id'] = build()
            except Exception as error:
                state['error'] = str(error)
                print('Build failed: ' + str(error), flush=True)
            finally:
                state['building'] = False

    # Bind only loopback, and never serve the source checkout or firmware/debug bundles.
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(OUTPUT)))
    if not args.no_watch: threading.Thread(target=watch, daemon=True).start()
    print(f'Local: http://127.0.0.1:{args.port}/', flush=True)
    print('Watching shared UI sources; Ctrl+C to stop.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        server.server_close()


if __name__ == '__main__':
    main()
