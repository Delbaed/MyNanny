# Hardware Wiring For Your Build

From the photo, you have:

- ESP32-C6 dev board on a breadboard
- L298N-style red motor driver module
- two yellow TT DC motors with wheels
- battery holder for the motors
- jumper wires
- a few small blue servo motors, which this code does not use

## Power

Keep the ESP32-C6 powered from USB while testing.

Wire the motor battery pack to the L298N:

| Battery / L298N | Connect To |
|---|---|
| battery `+` | L298N `+12V` / `VIN` motor power screw terminal |
| battery `-` | L298N `GND` screw terminal |
| ESP32-C6 `GND` | same L298N `GND` terminal |

The shared ground is required. Without it, the ESP32 control pins and motor
driver do not agree on what HIGH/LOW means.

Do not connect the motors directly to ESP32-C6 pins.

## Motors

| Motor | L298N Output |
|---|---|
| left TT motor wires | `OUT1` and `OUT2` |
| right TT motor wires | `OUT3` and `OUT4` |

If a wheel spins backward during the motor test, swap that motor's two wires.

## ESP32-C6 To L298N Control Pins

The current code uses four direction pins:

| ESP32-C6 Pin | L298N Pin |
|---|---|
| `GPIO4` | `IN1` |
| `GPIO5` | `IN2` |
| `GPIO6` | `IN3` |
| `GPIO7` | `IN4` |

If your L298N has `ENA` and `ENB` jumpers, leave the jumpers installed. If the
jumpers are missing, the motors may not spin. Put the jumpers back on, or wire
`ENA` and `ENB` to `5V` on the L298N logic side.

## Serial Motor Test

After flashing, open Serial Monitor and type:

```text
w
```

Both wheels should move forward briefly.

```text
a
```

Robot should turn left briefly.

```text
d
```

Robot should turn right briefly.

```text
x
```

Stop motors.

If forward makes one wheel go backward, swap that motor's wires on the L298N
output terminal. If both wheels go backward, swap both motors or reverse the
motor pin definitions in `main/main.c`.

## What To Ignore For Now

The small blue servo motors in the photo are not needed for this version. Leave
them disconnected until the two-wheel robot movement is working.
