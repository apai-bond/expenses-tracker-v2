"""Run a local test web server for Pocket Budget.

Open http://localhost:8000 on the computer after starting this file.
"""

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

HOST = "0.0.0.0"
PORT = 8000


def main() -> None:
    project_folder = Path(__file__).resolve().parent
    os.chdir(project_folder)

    server = ThreadingHTTPServer((HOST, PORT), SimpleHTTPRequestHandler)
    print(f"Pocket Budget is running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop the server.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
