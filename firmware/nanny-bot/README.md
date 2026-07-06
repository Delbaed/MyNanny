# One-ESP32 Onboarding Gait Mover

This version adds onboarding and recalibration.

It still uses:

- one ESP32 on the robot
- no child phone hotspot
- no second ESP32
- no camera
- no microphone

The bot learns:

1. the normal room WiFi CSI baseline
2. the child's movement/gait-like WiFi CSI pattern while the child moves alone
3. active mode, where the bot moves only when changes look like the enrolled pattern

The learned profile is RAM-only. It is not saved to NVS or flash.

## Important Limit

This is not true identity recognition. With one ESP32 and no wearable signal,
the bot cannot prove a movement came from the child. It learns a room-specific
WiFi disturbance pattern that can look like the child's movement.

For a school/demo prototype, that is a reasonable WiFi-only onboarding flow. For
real safety, use more anchors/tags and adult supervision.

## Use in VS Code ESP-IDF

Open this folder:

```text
outputs/one-esp32-onboarding-gait-mover
```

Edit WiFi credentials in `main/main.c`:

```c
#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASS "YOUR_WIFI_PASSWORD"
```

Build and flash:

```powershell
idf.py set-target esp32
idf.py build flash monitor
```

Here, `flash` means uploading the firmware to the ESP32. The learned child
movement profile is still RAM-only and is not written to NVS or stored data.

## Onboarding Flow

When it starts:

1. Keep the robot still while it learns the room baseline.
2. When Serial Monitor says `ONBOARDING 2/2`, have the child walk/move around
   alone near the bot.
3. When it says `ACTIVE`, the profile is learned in RAM and the bot reacts to
   similar movement patterns.

After reset or power loss, the profile is gone and onboarding starts again.

## Recalibration Commands

In Serial Monitor, type:

```text
r
```

Full onboarding again: room baseline plus child gait.

```text
b
```

Recalibrate room baseline only. Use this if furniture moved or the router moved.

```text
g
```

Recalibrate child movement/gait only.

```text
s
```

Print current status.

## Motor Pins

Use a motor driver such as TB6612FNG or L298N.

For the parts in your photo, use this wiring guide:

[HARDWARE.md](HARDWARE.md)

Default pins:

- `GPIO25`, `GPIO26`: left motor direction
- `GPIO27`, `GPIO14`: right motor direction
- `GPIO13`: optional LED/buzzer

Do not connect motors directly to ESP32 GPIO pins.

## Motor Test Commands

Before testing the WiFi logic, use Serial Monitor:

```text
w = forward
a = turn left
d = turn right
x = stop
```

If a wheel spins the wrong way, swap that motor's two wires on the L298N output.

## Tuning

Watch Serial Monitor:

```text
active rssi=-54 change=0.071 motion=0.045 significant=1 gaitLike=1 frames=3
```

If it reacts too easily, raise:

```c
#define CHANGE_THRESHOLD 0.060f
#define MOTION_THRESHOLD 0.038f
#define TRIGGER_FRAMES 4
```

If it ignores the child, lower those thresholds or increase:

```c
#define GAIT_TOLERANCE_MULTIPLIER 2.8f
```

If it keeps reacting to its own motor movement, increase:

```c
#define SETTLE_AFTER_MOVE_MS 1400
```
