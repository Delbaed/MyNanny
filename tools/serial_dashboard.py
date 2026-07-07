#!/usr/bin/env python3
import argparse
import json
import queue
import re
import threading
import time
from urllib.parse import urlparse
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
    "fallAlerts": 0,
    "location": {
        "enabled": False,
        "lat": None,
        "lon": None,
        "accuracy": None,
        "homeLat": None,
        "homeLon": None,
        "safeRadiusM": 25,
        "distanceFromHomeM": None,
        "insideSafeZone": None,
        "updatedAt": 0,
        "status": "not-started",
    },
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


def robot_location_payload(snapshot):
    location = snapshot.get("location") or {}
    room_total = max(1, int(snapshot.get("roomTotal") or 90))
    gait_total = max(1, int(snapshot.get("gaitTotal") or 140))
    room_frames = int(snapshot.get("roomFrames") or 0)
    gait_frames = int(snapshot.get("gaitFrames") or 0)

    # The one-ESP32 CSI prototype does not know true x/y position. These
    # coordinates keep the existing app UI alive while surfacing real state.
    x = 2.5
    y = 2.5
    if location.get("distanceFromHomeM") is not None:
        try:
            x = min(5.0, max(0.0, 2.5 + (float(location["distanceFromHomeM"]) / 10.0)))
        except (TypeError, ValueError):
            x = 2.5

    return {
        "online": bool(snapshot.get("connected")),
        "located": bool(snapshot.get("connected")),
        "x": x,
        "y": y,
        "anchorsSeen": 1 if snapshot.get("connected") else 0,
        "batteryPercent": -1,
        "updatedAt": int(snapshot.get("lastUpdate") or time.time()) * 1000,
        "mode": snapshot.get("mode", "unknown"),
        "event": snapshot.get("event", ""),
        "roomFrames": room_frames,
        "roomTotal": room_total,
        "gaitFrames": gait_frames,
        "gaitTotal": gait_total,
        "gaitSamples": int(snapshot.get("gaitSamples") or 0),
        "activeTriggers": int(snapshot.get("activeTriggers") or 0),
        "fallAlerts": int(snapshot.get("fallAlerts") or 0),
        "lastLine": snapshot.get("lastLine", ""),
    }


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
    .pill.alerting {
      color: var(--red);
      border-color: #f0b5ae;
      background: #fff4f2;
    }
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
    .location-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 10px;
    }
    .location-readout {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fbfcfe;
      min-height: 72px;
    }
    .fall-panel {
      border-color: #f0b5ae;
      background: #fffafa;
    }
    .fall-panel.active {
      border-color: var(--red);
      box-shadow: 0 0 0 3px rgba(180, 35, 24, 0.12), var(--shadow);
    }
    .alert-text {
      color: var(--red);
    }
    .field {
      display: grid;
      gap: 6px;
      margin-top: 10px;
    }
    input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 7px;
      padding: 10px 11px;
      font: inherit;
    }
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
              <div class="label">Fall alerts</div>
              <div id="fallAlerts" class="value alert-text">0</div>
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
        <div id="fallPanel" class="panel fall-panel">
          <div class="label">Parent alert</div>
          <div id="fallStatus" class="value" style="font-size:18px">No fall alert</div>
          <div class="location-grid">
            <div class="location-readout">
              <div class="label">Gait samples</div>
              <div id="samples" class="value" style="font-size:16px">0</div>
            </div>
            <div class="location-readout">
              <div class="label">Browser notifications</div>
              <div id="notifyStatus" class="value" style="font-size:16px">Off</div>
            </div>
          </div>
          <div class="actions" style="margin-top:10px">
            <button id="enableAlerts" class="primary">Enable parent alerts</button>
            <button id="testParentAlert">Test alert</button>
          </div>
        </div>

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
          <div class="label">GPS safe zone</div>
          <div id="gpsStatus" class="value" style="font-size:18px">Not started</div>
          <div class="location-grid">
            <div class="location-readout">
              <div class="label">Coordinates</div>
              <div id="gpsCoords" class="value" style="font-size:16px">--</div>
            </div>
            <div class="location-readout">
              <div class="label">Home distance</div>
              <div id="gpsDistance" class="value" style="font-size:16px">--</div>
            </div>
          </div>
          <div class="field">
            <label class="label" for="safeRadius">Safe radius, meters</label>
            <input id="safeRadius" type="number" min="5" max="500" step="5" value="25">
          </div>
          <div class="actions" style="margin-top:10px">
            <button id="startGps" class="primary">Start GPS</button>
            <button id="setHome">Set home here</button>
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
    const LOCATION_STORAGE_KEY = "mynanny.homeLocation";
    let lastFallAlerts = 0;
    let parentAlertsEnabled = false;
    let latestPosition = null;
    let gpsWatchId = null;

    function percent(value, total) {
      const safeTotal = Math.max(1, Number(total || 1));
      return Math.max(0, Math.min(100, Math.round((Number(value || 0) / safeTotal) * 100)));
    }

    function setText(id, value) {
      $(id).textContent = value == null ? "" : String(value);
    }

    function formatCoord(value) {
      return Number.isFinite(value) ? value.toFixed(6) : "--";
    }

    function distanceMeters(aLat, aLon, bLat, bLon) {
      if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return null;
      const earthRadiusM = 6371000;
      const toRad = (deg) => deg * Math.PI / 180;
      const dLat = toRad(bLat - aLat);
      const dLon = toRad(bLon - aLon);
      const lat1 = toRad(aLat);
      const lat2 = toRad(bLat);
      const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
    }

    function savedHome() {
      try {
        const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }

    function saveHome(lat, lon) {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ lat, lon }));
    }

    async function postLocation(status, position) {
      const home = savedHome();
      const safeRadiusM = Math.max(5, Number($("safeRadius").value || 25));
      const lat = position ? position.coords.latitude : null;
      const lon = position ? position.coords.longitude : null;
      const accuracy = position ? position.coords.accuracy : null;
      const distance = distanceMeters(lat, lon, Number(home.lat), Number(home.lon));

      await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: Boolean(position),
          lat,
          lon,
          accuracy,
          homeLat: Number.isFinite(Number(home.lat)) ? Number(home.lat) : null,
          homeLon: Number.isFinite(Number(home.lon)) ? Number(home.lon) : null,
          safeRadiusM,
          distanceFromHomeM: distance,
          insideSafeZone: distance == null ? null : distance <= safeRadiusM,
          status
        })
      });
    }

    function renderLocation(location) {
      const loc = location || {};
      const lat = Number(loc.lat);
      const lon = Number(loc.lon);
      const accuracy = Number(loc.accuracy);
      const distance = Number(loc.distanceFromHomeM);
      const radius = Number(loc.safeRadiusM || $("safeRadius").value || 25);
      const hasCoords = loc.lat != null && loc.lon != null && Number.isFinite(lat) && Number.isFinite(lon);
      const hasDistance = loc.distanceFromHomeM != null && Number.isFinite(distance);

      if (Number.isFinite(radius)) $("safeRadius").value = String(Math.round(radius));
      setText("gpsCoords", hasCoords ? `${formatCoord(lat)}, ${formatCoord(lon)}` : "--");
      setText("gpsDistance", hasDistance ? `${Math.round(distance)} m / ${Math.round(radius)} m` : "--");

      if (loc.insideSafeZone === true) {
        setText("gpsStatus", `Inside safe zone${Number.isFinite(accuracy) ? " | +/- " + Math.round(accuracy) + " m" : ""}`);
      } else if (loc.insideSafeZone === false) {
        setText("gpsStatus", `Outside safe zone${Number.isFinite(accuracy) ? " | +/- " + Math.round(accuracy) + " m" : ""}`);
      } else {
        setText("gpsStatus", loc.status || "Not started");
      }
    }

    function notificationPermission() {
      if (!("Notification" in window)) return "unsupported";
      return Notification.permission;
    }

    function updateNotifyStatus() {
      const permission = notificationPermission();
      if (permission === "granted" && parentAlertsEnabled) {
        setText("notifyStatus", "On");
      } else if (permission === "denied") {
        setText("notifyStatus", "Blocked");
      } else if (permission === "unsupported") {
        setText("notifyStatus", "Unsupported");
      } else {
        setText("notifyStatus", "Off");
      }
    }

    function sendParentNotification(message) {
      if (notificationPermission() === "granted" && parentAlertsEnabled) {
        new Notification("MyNanny fall alert", { body: message });
      }
    }

    function renderFallAlert(data) {
      const fallAlerts = Number(data.fallAlerts || 0);
      const isNewAlert = fallAlerts > lastFallAlerts;
      const currentlyAlerting = data.event === "fall-alert" || fallAlerts > 0;

      setText("fallAlerts", fallAlerts);
      $("fallPanel").classList.toggle("active", currentlyAlerting);
      setText("fallStatus", currentlyAlerting ? "Possible fall detected" : "No fall alert");

      if (isNewAlert || data.event === "fall-alert") {
        sendParentNotification("Possible fall detected from the imprinted child movement pattern.");
      }
      lastFallAlerts = Math.max(lastFallAlerts, fallAlerts);
      updateNotifyStatus();
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
      renderLocation(data.location);
      renderFallAlert(data);
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

    $("enableAlerts").addEventListener("click", async () => {
      if (!("Notification" in window)) {
        parentAlertsEnabled = false;
        updateNotifyStatus();
        return;
      }
      const permission = await Notification.requestPermission();
      parentAlertsEnabled = permission === "granted";
      updateNotifyStatus();
    });

    $("testParentAlert").addEventListener("click", () => {
      parentAlertsEnabled = notificationPermission() === "granted" || parentAlertsEnabled;
      sendParentNotification("Test alert from MyNanny.");
      setText("fallStatus", "Test alert sent");
      updateNotifyStatus();
    });

    $("startGps").addEventListener("click", async () => {
      if (!navigator.geolocation) {
        await postLocation("gps-unavailable", null);
        await refresh();
        return;
      }

      $("startGps").disabled = true;
      gpsWatchId = navigator.geolocation.watchPosition(
        async (position) => {
          latestPosition = position;
          await postLocation("gps-active", position);
          await refresh();
          $("startGps").disabled = false;
        },
        async (error) => {
          await postLocation("gps-error: " + error.message, null);
          await refresh();
          $("startGps").disabled = false;
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
      );
    });

    $("setHome").addEventListener("click", async () => {
      if (!latestPosition) return;
      saveHome(latestPosition.coords.latitude, latestPosition.coords.longitude);
      await postLocation("home-set", latestPosition);
      await refresh();
    });

    $("safeRadius").addEventListener("change", async () => {
      if (latestPosition) {
        await postLocation("safe-radius-updated", latestPosition);
        await refresh();
      }
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

        path = urlparse(self.path).path

        if path == "/api/robot-location":
            self.send_json(200, robot_location_payload(snapshot))
            return

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
        if self.path == "/api/location":
            self.handle_location_post()
            return

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

    def handle_location_post(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            self.send_json(400, {"ok": False, "error": "invalid json"})
            return

        def number_or_none(name):
            value = payload.get(name)
            if value is None:
                return None
            try:
                return float(value)
            except (TypeError, ValueError):
                return None

        location = {
            "enabled": bool(payload.get("enabled")),
            "lat": number_or_none("lat"),
            "lon": number_or_none("lon"),
            "accuracy": number_or_none("accuracy"),
            "homeLat": number_or_none("homeLat"),
            "homeLon": number_or_none("homeLon"),
            "safeRadiusM": number_or_none("safeRadiusM") or 25,
            "distanceFromHomeM": number_or_none("distanceFromHomeM"),
            "insideSafeZone": payload.get("insideSafeZone"),
            "updatedAt": int(time.time()),
            "status": str(payload.get("status", "gps-updated")),
        }
        update_state(location=location)
        self.send_json(200, {"ok": True, "location": location})

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

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
