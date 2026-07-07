#!/usr/bin/env python3
import argparse
import html
import json
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import serial


APPDATA_RE = re.compile(r"APPDATA\s+({.*})")

state_lock = threading.Lock()
state = {
    "connected": False,
    "lastLine": "",
    "lastUpdate": 0,
    "event": "waiting-for-esp32",
    "mode": "unknown",
    "baselineReady": 0,
    "gaitReady": 0,
    "roomFrames": 0,
    "roomTotal": 180,
    "gaitFrames": 0,
    "gaitTotal": 260,
    "gaitSamples": 0,
    "activeTriggers": 0,
}


def update_state(**items):
    with state_lock:
        state.update(items)
        state["lastUpdate"] = int(time.time())


def serial_reader(port, baud):
    while True:
        try:
            with serial.Serial(port, baud, timeout=1) as ser:
                update_state(connected=True, event="serial-connected")
                while True:
                    raw = ser.readline()
                    if not raw:
                        continue
                    line = raw.decode("utf-8", errors="replace").strip()
                    match = APPDATA_RE.search(line)
                    if match:
                        try:
                            payload = json.loads(match.group(1))
                            update_state(**payload, lastLine=line, connected=True)
                        except json.JSONDecodeError:
                            update_state(lastLine=line)
                    elif line:
                        update_state(lastLine=line, connected=True)
        except Exception as exc:
            update_state(connected=False, event=f"serial-error: {exc}")
            time.sleep(2)


def pct(value, total):
    try:
        total = max(1, int(total))
        return max(0, min(100, round((int(value) / total) * 100)))
    except Exception:
        return 0


def render_html(snapshot):
    room_pct = pct(snapshot.get("roomFrames", 0), snapshot.get("roomTotal", 180))
    gait_pct = pct(snapshot.get("gaitFrames", 0), snapshot.get("gaitTotal", 260))
    age = int(time.time()) - int(snapshot.get("lastUpdate") or 0)
    connected = bool(snapshot.get("connected"))
    status = "Connected" if connected else "Waiting for ESP32"

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="1">
  <title>MyNanny CSI Dashboard</title>
  <style>
    body {{
      margin: 0;
      font-family: Segoe UI, Arial, sans-serif;
      background: #f6f7f9;
      color: #16202a;
    }}
    main {{
      max-width: 940px;
      margin: 0 auto;
      padding: 28px 18px;
    }}
    header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
    }}
    h1 {{
      font-size: 28px;
      margin: 0;
      font-weight: 700;
    }}
    .status {{
      padding: 8px 12px;
      border-radius: 6px;
      background: {"#d7f5e5" if connected else "#ffe7d6"};
      color: {"#0b6b3a" if connected else "#8a3b00"};
      font-weight: 700;
      white-space: nowrap;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }}
    .card {{
      background: white;
      border: 1px solid #d9dee5;
      border-radius: 8px;
      padding: 16px;
    }}
    .label {{
      color: #5d6b7a;
      font-size: 13px;
      margin-bottom: 6px;
    }}
    .value {{
      font-size: 24px;
      font-weight: 700;
    }}
    .bar {{
      height: 12px;
      background: #e6eaf0;
      border-radius: 999px;
      overflow: hidden;
      margin-top: 12px;
    }}
    .fill {{
      height: 100%;
      background: #246bfe;
      width: 0%;
    }}
    code {{
      display: block;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      background: #111827;
      color: #f9fafb;
      border-radius: 8px;
      padding: 12px;
      min-height: 48px;
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>MyNanny CSI Dashboard</h1>
      <div class="status">{html.escape(status)}</div>
    </header>

    <section class="grid">
      <div class="card">
        <div class="label">Current mode</div>
        <div class="value">{html.escape(str(snapshot.get("mode", "unknown")))}</div>
      </div>
      <div class="card">
        <div class="label">Last event</div>
        <div class="value">{html.escape(str(snapshot.get("event", "")))}</div>
      </div>
      <div class="card">
        <div class="label">Room baseline</div>
        <div class="value">{room_pct}%</div>
        <div class="bar"><div class="fill" style="width:{room_pct}%"></div></div>
      </div>
      <div class="card">
        <div class="label">Gait enrollment</div>
        <div class="value">{gait_pct}%</div>
        <div class="bar"><div class="fill" style="width:{gait_pct}%"></div></div>
      </div>
      <div class="card">
        <div class="label">Gait samples</div>
        <div class="value">{int(snapshot.get("gaitSamples", 0))}</div>
      </div>
      <div class="card">
        <div class="label">Movement triggers</div>
        <div class="value">{int(snapshot.get("activeTriggers", 0))}</div>
      </div>
    </section>

    <section class="card" style="margin-top:14px">
      <div class="label">Last serial line, updated {age}s ago</div>
      <code>{html.escape(str(snapshot.get("lastLine", "")))}</code>
    </section>
  </main>
</body>
</html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        with state_lock:
            snapshot = dict(state)

        if self.path == "/api/state":
            body = json.dumps(snapshot).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        body = render_html(snapshot).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        return


def main():
    parser = argparse.ArgumentParser(description="MyNanny ESP32 serial dashboard")
    parser.add_argument("--port", default="COM11")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--http-port", type=int, default=8080)
    args = parser.parse_args()

    thread = threading.Thread(target=serial_reader, args=(args.port, args.baud), daemon=True)
    thread.start()

    server = ThreadingHTTPServer((args.host, args.http_port), Handler)
    print(f"Dashboard: http://{args.host}:{args.http_port}")
    print(f"Reading ESP32 serial on {args.port} at {args.baud} baud")
    server.serve_forever()


if __name__ == "__main__":
    main()
