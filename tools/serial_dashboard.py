#!/usr/bin/env python3
import argparse
import json
import queue
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import serial


APPDATA_RE = re.compile(r"APPDATA\s+({.*})")
SERIAL_COMMANDS = {
    "full-onboard": "r",
    "room-baseline": "b",
    "gait-imprint": "g",
    "status": "s",
    "forward": "w",
    "left": "a",
    "right": "d",
    "stop": "x",
}

state_lock = threading.Lock()
command_queue = queue.Queue()
state = {
    "connected": False,
    "lastLine": "",
    "lastCommand": "",
    "lastUpdate": 0,
    "event": "waiting-for-esp32",
    "mode": "unknown",
    "baselineReady": 0,
    "gaitReady": 0,
    "roomFrames": 0,
    "roomTotal": 90,
    "gaitFrames": 0,
    "gaitTotal": 140,
    "gaitSamples": 0,
    "activeTriggers": 0,
}


def update_state(**items):
    with state_lock:
        state.update(items)
        state["lastUpdate"] = int(time.time())


def handle_serial_line(line):
    match = APPDATA_RE.search(line)
    if match:
        try:
            payload = json.loads(match.group(1))
            update_state(**payload, lastLine=line, connected=True)
        except json.JSONDecodeError:
            update_state(lastLine=line, connected=True)
    elif line:
        update_state(lastLine=line, connected=True)


def serial_worker(port, baud):
    while True:
        try:
            with serial.Serial(port, baud, timeout=0.25) as ser:
                update_state(connected=True, event="serial-connected")
                while True:
                    while not command_queue.empty():
                        command_name, command_char = command_queue.get_nowait()
                        ser.write(command_char.encode("ascii"))
                        ser.flush()
                        update_state(lastCommand=command_name, event=f"command-{command_name}")

                    raw = ser.readline()
                    if raw:
                        line = raw.decode("utf-8", errors="replace").strip()
                        handle_serial_line(line)
        except Exception as exc:
            update_state(connected=False, event=f"serial-error: {exc}")
            time.sleep(2)


def pct(value, total):
    try:
        total = max(1, int(total))
        return max(0, min(100, round((int(value) / total) * 100)))
    except Exception:
        return 0


APP_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MyNanny Control</title>
  <style>
    :root {
      --ink: #16202a;
      --muted: #637083;
      --line: #d8dee8;
      --panel: #ffffff;
      --bg: #f5f7fa;
      --blue: #1f6feb;
      --green: #168a53;
      --amber: #a45708;
      --red: #b42318;
      --shadow: 0 10px 28px rgba(22, 32, 42, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Segoe UI, Arial, sans-serif;
      background: var(--bg);
      color: var(--ink);
    }
    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 24px 18px 34px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.1;
      letter-spacing: 0;
    }
    .sub {
      margin-top: 6px;
      color: var(--muted);
      font-size: 14px;
    }
    .pill {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 8px 12px;
      background: var(--panel);
      font-weight: 700;
      white-space: nowrap;
    }
    .pill.connected { color: var(--green); }
    .pill.waiting { color: var(--amber); }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
      gap: 14px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      padding: 16px;
    }
    .hero {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      min-height: 96px;
      background: #fbfcfe;
    }
    .label {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 7px;
    }
    .value {
      font-size: 24px;
      line-height: 1.15;
      font-weight: 750;
      overflow-wrap: anywhere;
    }
    .phase {
      font-size: 38px;
      line-height: 1;
      font-weight: 800;
      margin: 6px 0 10px;
    }
    .bar {
      height: 12px;
      background: #e8edf4;
      border-radius: 999px;
      overflow: hidden;
    }
    .fill {
      height: 100%;
      width: 0%;
      background: var(--blue);
      transition: width 180ms ease;
    }
    .rows {
      display: grid;
      gap: 10px;
    }
    .row {
      display: grid;
      grid-template-columns: 130px 1fr 56px;
      gap: 10px;
      align-items: center;
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    button {
      border: 1px solid var(--line);
      background: #ffffff;
      color: var(--ink);
      border-radius: 7px;
      padding: 10px 11px;
      font-weight: 700;
      cursor: pointer;
      min-height: 42px;
    }
    button.primary {
      background: var(--blue);
      color: white;
      border-color: var(--blue);
    }
    button.danger {
      color: var(--red);
      border-color: #f0b5ae;
    }
    button:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    .movement {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 10px;
    }
    .movement button:nth-child(1) { grid-column: 2; }
    .movement button:nth-child(2) { grid-column: 1; }
    .movement button:nth-child(3) { grid-column: 2; }
    .movement button:nth-child(4) { grid-column: 3; }
    code {
      display: block;
      background: #111827;
      color: #f9fafb;
      border-radius: 8px;
      padding: 12px;
      min-height: 74px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 12px;
    }
    .stack { display: grid; gap: 14px; }
    @media (max-width: 820px) {
      .layout, .hero { grid-template-columns: 1fr; }
      header { align-items: flex-start; flex-direction: column; }
      .row { grid-template-columns: 112px 1fr 48px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>MyNanny Control</h1>
        <div class="sub">Live ESP32 WiFi CSI onboarding, imprinting, and movement checks</div>
      </div>
      <div id="connection" class="pill waiting">Waiting</div>
    </header>

    <section class="layout">
      <div class="stack">
        <div class="panel">
          <div class="label">Current phase</div>
          <div id="phase" class="phase">unknown</div>
          <div class="hero">
            <div class="metric">
              <div class="label">Last event</div>
              <div id="event" class="value">waiting</div>
            </div>
            <div class="metric">
              <div class="label">Movement triggers</div>
              <div id="triggers" class="value">0</div>
            </div>
            <div class="metric">
              <div class="label">Gait samples</div>
              <div id="samples" class="value">0</div>
            </div>
          </div>
          <div class="rows">
            <div class="row">
              <div class="label">Room baseline</div>
              <div class="bar"><div id="roomFill" class="fill"></div></div>
              <strong id="roomPct">0%</strong>
            </div>
            <div class="row">
              <div class="label">Child imprint</div>
              <div class="bar"><div id="gaitFill" class="fill"></div></div>
              <strong id="gaitPct">0%</strong>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="label">Serial stream</div>
          <code id="serialLine"></code>
        </div>
      </div>

      <aside class="stack">
        <div class="panel">
          <div class="label">Onboarding</div>
          <div class="actions">
            <button class="primary" data-command="full-onboard">Start full imprint</button>
            <button data-command="status">Refresh status</button>
            <button data-command="room-baseline">Room only</button>
            <button data-command="gait-imprint">Child imprint</button>
          </div>
        </div>

        <div class="panel">
          <div class="label">Motor test</div>
          <div class="movement">
            <button data-command="forward">Forward</button>
            <button data-command="left">Left</button>
            <button class="danger" data-command="stop">Stop</button>
            <button data-command="right">Right</button>
          </div>
        </div>

        <div class="panel">
          <div class="label">Connection</div>
          <div id="details" class="value" style="font-size:16px">Starting...</div>
        </div>
      </aside>
    </section>
  </main>

  <script>
    const $ = (id) => document.getElementById(id);

    function percent(value, total) {
      const safeTotal = Math.max(1, Number(total || 1));
      return Math.max(0, Math.min(100, Math.round((Number(value || 0) / safeTotal) * 100)));
    }

    function setText(id, value) {
      $(id).textContent = value == null ? "" : String(value);
    }

    function render(data) {
      const connected = Boolean(data.connected);
      const roomPct = percent(data.roomFrames, data.roomTotal);
      const gaitPct = percent(data.gaitFrames, data.gaitTotal);
      const age = data.lastUpdate ? Math.max(0, Math.round(Date.now() / 1000 - data.lastUpdate)) : 0;

      $("connection").className = connected ? "pill connected" : "pill waiting";
      $("connection").textContent = connected ? "ESP32 connected" : "Waiting for ESP32";
      setText("phase", data.mode || "unknown");
      setText("event", data.event || "waiting");
      setText("triggers", data.activeTriggers || 0);
      setText("samples", data.gaitSamples || 0);
      setText("roomPct", roomPct + "%");
      setText("gaitPct", gaitPct + "%");
      $("roomFill").style.width = roomPct + "%";
      $("gaitFill").style.width = gaitPct + "%";
      setText("serialLine", data.lastLine || "");
      setText("details", "Last update " + age + "s ago" + (data.lastCommand ? " | last command: " + data.lastCommand : ""));
    }

    async function refresh() {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        render(await response.json());
      } catch (error) {
        render({ connected: false, event: "dashboard-offline", lastLine: String(error) });
      }
    }

    async function sendCommand(command, button) {
      button.disabled = true;
      try {
        await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command })
        });
        await refresh();
      } finally {
        setTimeout(() => { button.disabled = false; }, 500);
      }
    }

    document.querySelectorAll("[data-command]").forEach((button) => {
      button.addEventListener("click", () => sendCommand(button.dataset.command, button));
    });

    refresh();
    setInterval(refresh, 1000);
  </script>
</body>
</html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        with state_lock:
            snapshot = dict(state)

        if self.path == "/api/state":
            self.send_json(200, snapshot)
            return

        body = APP_HTML.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/api/command":
            self.send_json(404, {"ok": False, "error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            command = str(payload.get("command", ""))
        except Exception:
            self.send_json(400, {"ok": False, "error": "invalid json"})
            return

        command_char = SERIAL_COMMANDS.get(command)
        if not command_char:
            self.send_json(400, {"ok": False, "error": "unknown command"})
            return

        command_queue.put((command, command_char))
        update_state(lastCommand=command)
        self.send_json(200, {"ok": True, "command": command})

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        return


def main():
    parser = argparse.ArgumentParser(description="MyNanny ESP32 app dashboard")
    parser.add_argument("--port", default="COM11")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--http-port", type=int, default=8080)
    args = parser.parse_args()

    thread = threading.Thread(target=serial_worker, args=(args.port, args.baud), daemon=True)
    thread.start()

    server = ThreadingHTTPServer((args.host, args.http_port), Handler)
    print(f"MyNanny app: http://{args.host}:{args.http_port}")
    print(f"Reading ESP32 serial on {args.port} at {args.baud} baud")
    server.serve_forever()


if __name__ == "__main__":
    main()
