#pragma once

// Fixed reference Wi-Fi access points used to estimate the robot's position
// indoors via RSSI trilateration. There is no GPS on this hardware, so the
// "map" is a small local coordinate system (metres) you define yourself by
// measuring where each anchor AP physically sits in the home.
//
// To calibrate:
//   1. Place 3+ Wi-Fi APs (or extra routers in AP mode) at known positions.
//   2. Measure and fill in x/y (metres, any consistent origin you like).
//   3. Fill in bssid (run a Wi-Fi scan sketch once to read it).
//   4. txPowerAt1m is the RSSI (dBm) that AP reads at exactly 1 metre away —
//      measure it once with a phone or the ESP32 scan output.

struct Anchor {
  const char *bssid;
  float x;
  float y;
  int txPowerAt1m;
};

// Path-loss exponent for the log-distance model. 2.0 = free space, higher
// (2.5-4.0) for indoor environments with walls/furniture. Tune by comparing
// estimated vs. measured distances during calibration.
constexpr float PATH_LOSS_EXPONENT = 2.7f;

static const Anchor ANCHORS[] = {
    {"AA:AA:AA:AA:AA:01", 0.0f, 0.0f, -40},
    {"AA:AA:AA:AA:AA:02", 5.0f, 0.0f, -40},
    {"AA:AA:AA:AA:AA:03", 0.0f, 5.0f, -40},
};
constexpr size_t ANCHOR_COUNT = sizeof(ANCHORS) / sizeof(ANCHORS[0]);
