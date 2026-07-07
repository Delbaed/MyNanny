// Safe-Quack robot firmware (ESP32-C6).
//
// Connects to Wi-Fi, estimates the child's indoor position by trilaterating
// against fixed reference access points (see include/anchors.h), and pushes
// the result to Firebase Realtime Database so the Safe-Quack app can show it
// live.

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "anchors.h"

#if __has_include("secrets.h")
#include "secrets.h"
#else
#error "Copy include/secrets.h.example to include/secrets.h and fill in your Wi-Fi/Firebase credentials"
#endif

// Set to 1, re-flash, and open the serial monitor to calibrate anchors: walk
// to each anchor AP, stand exactly 1 metre away, and read off its BSSID +
// RSSI here instead of doing trilateration math by hand. Set back to 0 (the
// normal tracking mode) once include/anchors.h is filled in for real.
#define CALIBRATION_MODE 0

const int STATUS_LED_PIN = 1;
const unsigned long SCAN_INTERVAL_MS = 3000;

unsigned long lastScanAt = 0;

// No fuel-gauge wired up yet — wire a voltage divider to an ADC pin and
// replace this with a real reading. -1 means "unknown" to the app.
int readBatteryPercent() { return -1; }

// database.rules.json only allows writes from one pinned Firebase Auth
// identity. FIREBASE_REFRESH_TOKEN proves "I am that identity" but never
// goes over the wire itself — it's exchanged here for a short-lived ID
// token, which is what actually gets sent with each database write.
String cachedIdToken;
unsigned long idTokenExpiresAtMs = 0;

bool refreshIdToken() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin("https://securetoken.googleapis.com/v1/token?key=" + String(FIREBASE_API_KEY));
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");

  String body = "grant_type=refresh_token&refresh_token=" + String(FIREBASE_REFRESH_TOKEN);
  int status = http.POST(body);

  if (status != 200) {
    Serial.printf("Token refresh failed, HTTP %d\n", status);
    http.end();
    return false;
  }

  JsonDocument doc;
  deserializeJson(doc, http.getStream());
  http.end();

  cachedIdToken = doc["id_token"].as<String>();
  long expiresInSeconds = doc["expires_in"].as<String>().toInt();
  // Refresh a bit early so we're never caught with an expired token mid-push.
  idTokenExpiresAtMs = millis() + (expiresInSeconds > 60 ? (expiresInSeconds - 60) * 1000UL : 0);
  return cachedIdToken.length() > 0;
}

bool ensureFreshIdToken() {
  if (cachedIdToken.length() > 0 && millis() < idTokenExpiresAtMs) return true;
  return refreshIdToken();
}

float rssiToDistance(int rssi, int txPowerAt1m) {
  return pow(10.0f, (txPowerAt1m - rssi) / (10.0f * PATH_LOSS_EXPONENT));
}

// Least-squares trilateration, linearized relative to the last seen anchor.
// Needs at least 3 anchors in range; more improves accuracy.
bool trilaterate(const Anchor *seen[], const float distances[], int count, float &outX, float &outY) {
  if (count < 3) return false;

  const Anchor *ref = seen[count - 1];
  float refD = distances[count - 1];

  float ATA[2][2] = {{0, 0}, {0, 0}};
  float ATb[2] = {0, 0};

  for (int i = 0; i < count - 1; i++) {
    const Anchor *a = seen[i];
    float d = distances[i];
    float A0 = 2.0f * (a->x - ref->x);
    float A1 = 2.0f * (a->y - ref->y);
    float b = (refD * refD - d * d) - (ref->x * ref->x - a->x * a->x) - (ref->y * ref->y - a->y * a->y);

    ATA[0][0] += A0 * A0;
    ATA[0][1] += A0 * A1;
    ATA[1][0] += A1 * A0;
    ATA[1][1] += A1 * A1;
    ATb[0] += A0 * b;
    ATb[1] += A1 * b;
  }

  float det = ATA[0][0] * ATA[1][1] - ATA[0][1] * ATA[1][0];
  if (fabs(det) < 1e-6f) return false;

  outX = (ATb[0] * ATA[1][1] - ATb[1] * ATA[0][1]) / det;
  outY = (ATA[0][0] * ATb[1] - ATA[1][0] * ATb[0]) / det;
  return true;
}

bool locateChild(float &outX, float &outY, int &outAnchorsSeen) {
  int n = WiFi.scanNetworks();

  const Anchor *seen[ANCHOR_COUNT];
  float distances[ANCHOR_COUNT];
  int count = 0;

  for (int i = 0; i < n && count < (int)ANCHOR_COUNT; i++) {
    String bssid = WiFi.BSSIDstr(i);
    for (size_t a = 0; a < ANCHOR_COUNT; a++) {
      if (bssid.equalsIgnoreCase(ANCHORS[a].bssid)) {
        seen[count] = &ANCHORS[a];
        distances[count] = rssiToDistance(WiFi.RSSI(i), ANCHORS[a].txPowerAt1m);
        count++;
        break;
      }
    }
  }

  WiFi.scanDelete();
  outAnchorsSeen = count;
  return trilaterate(seen, distances, count, outX, outY);
}

void pushLocation(bool located, float x, float y, int anchorsSeen) {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!ensureFreshIdToken()) {
    Serial.println("Skipping push: no valid auth token");
    return;
  }

  HTTPClient http;
  String url = "https://" + String(FIREBASE_HOST) + "/robots/" + DEVICE_ID + "/location.json?auth=" + cachedIdToken;

  JsonDocument doc;
  doc["online"] = true;
  doc["located"] = located;
  if (located) {
    doc["x"] = x;
    doc["y"] = y;
  } else {
    doc["x"] = nullptr;
    doc["y"] = nullptr;
  }
  doc["anchorsSeen"] = anchorsSeen;
  doc["batteryPercent"] = readBatteryPercent();
  // Ask the Firebase server to fill in its own wall-clock time, since the
  // phone app can't otherwise compare this device's millis() to Date.now().
  doc["updatedAt"][".sv"] = "timestamp";

  String body;
  serializeJson(doc, body);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.PUT(body);
  http.end();
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected, IP: ");
  Serial.println(WiFi.localIP());
}

#if CALIBRATION_MODE

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  delay(500);
  Serial.println("\nCalibration mode: stand 1m from the AP you're calibrating and read its line below.");
}

void loop() {
  int n = WiFi.scanNetworks();

  // Sort strongest-first so the AP you're standing next to is easy to spot.
  int order[64];
  int count = n < 64 ? n : 64;
  for (int i = 0; i < count; i++) order[i] = i;
  for (int i = 0; i < count; i++) {
    for (int j = i + 1; j < count; j++) {
      if (WiFi.RSSI(order[j]) > WiFi.RSSI(order[i])) {
        int tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
      }
    }
  }

  Serial.println("---");
  for (int i = 0; i < count; i++) {
    int idx = order[i];
    Serial.printf("SSID=%-20s BSSID=%s RSSI=%d\n", WiFi.SSID(idx).c_str(), WiFi.BSSIDstr(idx).c_str(), WiFi.RSSI(idx));
  }
  WiFi.scanDelete();

  delay(2000);
}

#else

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED_PIN, OUTPUT);
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (millis() - lastScanAt >= SCAN_INTERVAL_MS) {
    lastScanAt = millis();

    float x, y;
    int anchorsSeen;
    bool located = locateChild(x, y, anchorsSeen);

    digitalWrite(STATUS_LED_PIN, HIGH);
    pushLocation(located, x, y, anchorsSeen);
    digitalWrite(STATUS_LED_PIN, LOW);

    Serial.printf("located=%d anchorsSeen=%d x=%.2f y=%.2f\n", located, anchorsSeen, x, y);
  }
}

#endif
