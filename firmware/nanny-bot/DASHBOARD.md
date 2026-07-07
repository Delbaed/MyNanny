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

## Battery / Untethered Mode

After this firmware is flashed once over USB, the rover can run from battery without staying plugged into the laptop.

The ESP32 hosts its own WiFi API while connected to `Dogpatch`, and advertises
itself via mDNS so you don't need to look up its IP address:

```text
http://mynanny.local/api/robot-location
http://mynanny.local/api/command
```

(If mDNS doesn't resolve on a given phone/network — this can happen on some
Android setups — find the ESP32's actual IP from the Serial Monitor at boot
and set `EXPO_PUBLIC_ROBOT_API_URL` in `app/.env` to
`http://<that-ip>/api/robot-location` instead.)

The app first tries the local USB bridge, then `mynanny.local`, then falls
back to Firebase if `main/secrets.h` is configured. The USB serial bridge is
now only for debugging; movement, imprinting, and fall detection run
directly on the ESP32.

Keep the Windows hotspot named `Dogpatch` running on 2.4 GHz. The ESP32 connects to that WiFi, CSI is enabled in the firmware, and the app can read the ESP32 over WiFi when the rover is running from battery.

Opening the serial connection can restart the ESP32, so onboarding may begin again when the dashboard starts.
