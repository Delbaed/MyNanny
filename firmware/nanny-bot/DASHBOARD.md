# MyNanny Control App

The ESP32 firmware prints live onboarding and movement data as `APPDATA` JSON lines over USB serial. The local app reads those lines and can also send serial commands back to the ESP32.

Run the local dashboard from the repo root:

```powershell
C:\Espressif\tools\python\v5.4.2\venv\Scripts\python.exe tools\serial_dashboard.py --port COM11
```

Then open:

```text
http://127.0.0.1:8080
```

The app shows live room baseline progress, child imprint progress, active movement triggers, possible fall alerts, serial logs, and a browser-based GPS safe-zone panel. It also has buttons for full imprinting, status refresh, room-only baseline, child imprint, and basic motor tests.

Fall alerts are prototype WiFi CSI disturbance alerts. They trigger when the imprinted active-mode profile sees a sudden large CSI change. They are not medical-grade fall detection and should not be used as the only child-safety system.

The GPS panel uses the browser/device location from the laptop or phone running the app. The ESP32 does not have true GPS unless a GPS module is added.

Keep the Windows hotspot named `Dogpatch` running on 2.4 GHz. The ESP32 connects to that WiFi, CSI is enabled in the firmware, and the app reads the ESP32's USB serial data.

Opening the serial connection can restart the ESP32, so onboarding may begin again when the dashboard starts.
