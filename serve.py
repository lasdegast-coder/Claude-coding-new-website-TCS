#!/usr/bin/env python3
"""Minimal static file server that serves an explicit directory with no-cache
headers (so refreshes always load the latest HTML/CSS/JS during development).

Avoids `python -m http.server` which calls os.getcwd() at startup
(blocked in some sandboxed environments)."""
import http.server
import socketserver

DIRECTORY = "/Users/joukenabuurs/Documents/Claude coding"
PORT = 8123


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Never cache during development so edits show up on a normal reload.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Serving {DIRECTORY} at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
