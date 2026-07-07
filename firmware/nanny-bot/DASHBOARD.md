# MyNanny Serial Dashboard

The ESP32 firmware prints live onboarding and movement data as `APPDATA` JSON lines over USB serial.

Run the local dashboard from the repo root:

```powershell
C:\Espressif\tools\python\v5.4.2\venv\Scripts\python.exe tools\serial_dashboard.py --port COM11
```

Then open:

```text
http://127.0.0.1:8080
```

Keep the Windows hotspot named `Dogpatch` running on 2.4 GHz. The ESP32 connects to that WiFi, CSI is enabled in the firmware, and the dashboard reads the ESP32's USB serial data.

Opening the serial connection can restart the ESP32, so onboarding may begin again when the dashboard starts.
