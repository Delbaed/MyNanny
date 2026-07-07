#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "driver/gpio.h"
#include "driver/uart.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "nvs_flash.h"

/*
 * One ESP32 WiFi CSI mover with onboarding.
 *
 * No second ESP32, no phone hotspot, no camera, no microphone.
 *
 * Onboarding:
 * 1. Learn the normal room/router-to-bot WiFi CSI baseline.
 * 2. Have the child move around alone so the bot learns a gait-like CSI pattern.
 * 3. In active mode, move only when the WiFi change looks like the enrolled
 *    child movement profile.
 *
 * Reality check: with one ESP32, this is not true identity recognition and it
 * cannot know direction. It learns a room-specific motion signature, not a
 * certified biometric gait model.
 */

#define WIFI_SSID "Dogpatch"
#define WIFI_PASS "Community25!"

#define CSI_BINS 16
#define ROOM_BASELINE_FRAMES 90
#define GAIT_ENROLL_FRAMES 140
#define MIN_GAIT_SAMPLES 4

// Motor-driver pins. Use a TB6612FNG/L298N/etc. Do not connect motors directly.
#define LEFT_A GPIO_NUM_4
#define LEFT_B GPIO_NUM_5
#define RIGHT_A GPIO_NUM_6
#define RIGHT_B GPIO_NUM_7

// Optional LED/buzzer pin.
#define ALERT_PIN GPIO_NUM_10

// Tune these by watching Serial Monitor.
#define CHANGE_THRESHOLD 0.006f
#define MOTION_THRESHOLD 0.004f
#define MIN_GAIT_SAMPLE_MOTION 0.003f
#define MIN_GAIT_SAMPLE_CHANGE 0.006f
#define TRIGGER_FRAMES 2

// Demo mode for the one-ESP32 prototype: after imprinting, react to any
// clear CSI movement instead of requiring a strict gait-shape match.
#define DEMO_FOLLOW_ANY_SIGNIFICANT 1

// Prototype fall alert: sudden CSI disturbance after child imprinting.
#define FALL_CHANGE_THRESHOLD 0.055f
#define FALL_MOTION_THRESHOLD 0.024f
#define FALL_TRIGGER_FRAMES 2

// Gait tolerances. Bigger means less strict matching.
#define GAIT_MOTION_FLOOR 0.018f
#define GAIT_CHANGE_FLOOR 0.026f
#define GAIT_TOLERANCE_MULTIPLIER 2.8f

// Movement is intentionally short to avoid reacting endlessly to its own motion.
#define MOVE_FORWARD_MS 360
#define TURN_MS 220
#define SETTLE_AFTER_MOVE_MS 1400

// Baseline slowly adapts only when the room looks stable.
#define BASELINE_ALPHA 0.012f

static const char *TAG = "ONBOARD_GAIT";
static const int WIFI_CONNECTED_BIT = BIT0;

typedef struct {
    float bins[CSI_BINS];
    int rssi;
    float motion;
    int64_t t_us;
} csi_feature_t;

typedef struct {
    int count;
    float mean;
    float m2;
} running_stats_t;

typedef enum {
    MODE_ROOM_BASELINE = 0,
    MODE_GAIT_ENROLL = 1,
    MODE_ACTIVE = 2,
} system_mode_t;

typedef enum {
    CMD_NONE = 0,
    CMD_FULL_ONBOARD,
    CMD_ROOM_RECALIBRATE,
    CMD_GAIT_RECALIBRATE,
    CMD_STATUS,
    CMD_TEST_FORWARD,
    CMD_TEST_LEFT,
    CMD_TEST_RIGHT,
    CMD_TEST_STOP,
} command_request_t;

static EventGroupHandle_t wifi_events;
static QueueHandle_t csi_queue;
static bool csi_ready = false;

static uint8_t ap_bssid[6];
static bool have_ap_bssid = false;

static float baseline[CSI_BINS];
static float previous_bins[CSI_BINS];
static float gait_centroid[CSI_BINS];

static bool have_previous = false;
static bool baseline_ready = false;
static bool gait_ready = false;
static bool require_gait_after_baseline = true;

static int room_frames = 0;
static int gait_frames = 0;
static int gait_sample_count = 0;
static int active_child_like_frames = 0;
static int active_fall_like_frames = 0;
static int active_trigger_count = 0;
static int fall_alert_count = 0;
static int64_t ignore_until_us = 0;

static float gait_motion_mean = 0.0f;
static float gait_motion_std = 0.0f;
static float gait_change_mean = 0.0f;
static float gait_change_std = 0.0f;

static running_stats_t gait_motion_stats;
static running_stats_t gait_change_stats;

static system_mode_t mode = MODE_ROOM_BASELINE;
static volatile command_request_t pending_command = CMD_NONE;

static float max_float(float a, float b) {
    return a > b ? a : b;
}

static float vec_distance(const float *a, const float *b) {
    float total = 0.0f;
    for (int i = 0; i < CSI_BINS; i++) {
        float d = a[i] - b[i];
        total += d * d;
    }
    return sqrtf(total / CSI_BINS);
}

static void normalize(float *v) {
    float total = 0.0f;
    for (int i = 0; i < CSI_BINS; i++) {
        total += fabsf(v[i]);
    }
    if (total < 0.001f) {
        total = 0.001f;
    }
    for (int i = 0; i < CSI_BINS; i++) {
        v[i] /= total;
    }
}

static bool same_mac(const uint8_t *a, const uint8_t *b) {
    return memcmp(a, b, 6) == 0;
}

static void stats_reset(running_stats_t *stats) {
    stats->count = 0;
    stats->mean = 0.0f;
    stats->m2 = 0.0f;
}

static void stats_push(running_stats_t *stats, float value) {
    stats->count++;
    float delta = value - stats->mean;
    stats->mean += delta / stats->count;
    float delta2 = value - stats->mean;
    stats->m2 += delta * delta2;
}

static float stats_stddev(const running_stats_t *stats) {
    if (stats->count < 2) {
        return 0.0f;
    }
    return sqrtf(stats->m2 / (stats->count - 1));
}

static const char *mode_name(system_mode_t current_mode) {
    switch (current_mode) {
        case MODE_ROOM_BASELINE:
            return "room-baseline";
        case MODE_GAIT_ENROLL:
            return "gait-enroll";
        case MODE_ACTIVE:
            return "active";
        default:
            return "unknown";
    }
}

static void emit_appdata(const char *event) {
    printf(
        "APPDATA {\"event\":\"%s\",\"mode\":\"%s\",\"baselineReady\":%d,"
        "\"gaitReady\":%d,\"roomFrames\":%d,\"roomTotal\":%d,"
        "\"gaitFrames\":%d,\"gaitTotal\":%d,\"gaitSamples\":%d,"
        "\"activeTriggers\":%d,\"fallAlerts\":%d}\n",
        event,
        mode_name(mode),
        baseline_ready,
        gait_ready,
        room_frames,
        ROOM_BASELINE_FRAMES,
        gait_frames,
        GAIT_ENROLL_FRAMES,
        gait_sample_count,
        active_trigger_count,
        fall_alert_count
    );
}

static void motors_stop(void) {
    gpio_set_level(LEFT_A, 0);
    gpio_set_level(LEFT_B, 0);
    gpio_set_level(RIGHT_A, 0);
    gpio_set_level(RIGHT_B, 0);
}

static void motors_forward(void) {
    gpio_set_level(LEFT_A, 1);
    gpio_set_level(LEFT_B, 0);
    gpio_set_level(RIGHT_A, 1);
    gpio_set_level(RIGHT_B, 0);
}

static void motors_left(void) {
    gpio_set_level(LEFT_A, 0);
    gpio_set_level(LEFT_B, 1);
    gpio_set_level(RIGHT_A, 1);
    gpio_set_level(RIGHT_B, 0);
}

static void motors_right(void) {
    gpio_set_level(LEFT_A, 1);
    gpio_set_level(LEFT_B, 0);
    gpio_set_level(RIGHT_A, 0);
    gpio_set_level(RIGHT_B, 1);
}

static void run_for(void (*motion)(void), int ms) {
    motion();
    vTaskDelay(pdMS_TO_TICKS(ms));
    motors_stop();
}

static void pulse_alert(int count) {
    for (int i = 0; i < count; i++) {
        gpio_set_level(ALERT_PIN, 1);
        vTaskDelay(pdMS_TO_TICKS(80));
        gpio_set_level(ALERT_PIN, 0);
        vTaskDelay(pdMS_TO_TICKS(80));
    }
}

static void update_baseline_slowly(const float *bins) {
    for (int i = 0; i < CSI_BINS; i++) {
        baseline[i] = (baseline[i] * (1.0f - BASELINE_ALPHA)) + (bins[i] * BASELINE_ALPHA);
    }
    normalize(baseline);
}

static void start_room_onboarding(bool also_relearn_gait) {
    motors_stop();
    memset(baseline, 0, sizeof(baseline));
    room_frames = 0;
    active_child_like_frames = 0;
    active_fall_like_frames = 0;
    active_trigger_count = 0;
    fall_alert_count = 0;
    baseline_ready = false;
    require_gait_after_baseline = also_relearn_gait;
    mode = MODE_ROOM_BASELINE;
    ignore_until_us = 0;
    ESP_LOGI(TAG, "ONBOARDING 1/2: keep robot still; learning normal room WiFi baseline");
    emit_appdata("room-baseline-start");
}

static void start_gait_onboarding(void) {
    motors_stop();
    memset(gait_centroid, 0, sizeof(gait_centroid));
    stats_reset(&gait_motion_stats);
    stats_reset(&gait_change_stats);
    gait_frames = 0;
    gait_sample_count = 0;
    active_child_like_frames = 0;
    active_fall_like_frames = 0;
    gait_ready = false;
    mode = MODE_GAIT_ENROLL;
    ignore_until_us = 0;
    ESP_LOGI(TAG, "ONBOARDING 2/2: have the child move/walk alone near the bot");
    ESP_LOGI(TAG, "Collecting gait-like WiFi CSI movement profile");
    emit_appdata("gait-enroll-start");
}

static void enter_active_mode(void) {
    motors_stop();
    mode = MODE_ACTIVE;
    active_child_like_frames = 0;
    active_fall_like_frames = 0;
    ignore_until_us = esp_timer_get_time() + 800000;
    ESP_LOGI(TAG,
             "ACTIVE: gait motion mean=%.3f std=%.3f, change mean=%.3f std=%.3f",
             gait_motion_mean,
             gait_motion_std,
             gait_change_mean,
             gait_change_std);
    emit_appdata("active-start");
    pulse_alert(2);
}

static void print_status(void) {
    ESP_LOGI(TAG,
             "status mode=%s baseline=%d gait=%d roomFrames=%d gaitFrames=%d gaitSamples=%d",
             mode_name(mode),
             baseline_ready,
             gait_ready,
             room_frames,
             gait_frames,
             gait_sample_count);
    emit_appdata("status");
    ESP_LOGI(TAG,
             "gaitProfile motion=%.3f+/-%.3f change=%.3f+/-%.3f",
             gait_motion_mean,
             gait_motion_std,
             gait_change_mean,
             gait_change_std);
}

static void handle_pending_command(void) {
    command_request_t command = pending_command;
    if (command == CMD_NONE) {
        return;
    }
    pending_command = CMD_NONE;

    if (command == CMD_STATUS) {
        print_status();
    } else if (command == CMD_FULL_ONBOARD) {
        gait_ready = false;
        start_room_onboarding(true);
    } else if (command == CMD_ROOM_RECALIBRATE) {
        start_room_onboarding(false);
    } else if (command == CMD_GAIT_RECALIBRATE) {
        if (!baseline_ready) {
            ESP_LOGW(TAG, "No room baseline yet; doing full onboarding first");
            start_room_onboarding(true);
        } else {
            start_gait_onboarding();
        }
    } else if (command == CMD_TEST_FORWARD) {
        ESP_LOGI(TAG, "Motor test: forward");
        run_for(motors_forward, MOVE_FORWARD_MS);
        ignore_until_us = esp_timer_get_time() + ((int64_t)SETTLE_AFTER_MOVE_MS * 1000);
    } else if (command == CMD_TEST_LEFT) {
        ESP_LOGI(TAG, "Motor test: left");
        run_for(motors_left, TURN_MS);
        ignore_until_us = esp_timer_get_time() + ((int64_t)SETTLE_AFTER_MOVE_MS * 1000);
    } else if (command == CMD_TEST_RIGHT) {
        ESP_LOGI(TAG, "Motor test: right");
        run_for(motors_right, TURN_MS);
        ignore_until_us = esp_timer_get_time() + ((int64_t)SETTLE_AFTER_MOVE_MS * 1000);
    } else if (command == CMD_TEST_STOP) {
        ESP_LOGI(TAG, "Motor test: stop");
        motors_stop();
    }
}

static void csi_rx_cb(void *ctx, wifi_csi_info_t *info) {
    if (!info || !info->buf || info->len < 4) {
        return;
    }
    if (have_ap_bssid && !same_mac(info->mac, ap_bssid)) {
        return;
    }

    csi_feature_t f = {0};
    f.rssi = info->rx_ctrl.rssi;
    f.t_us = esp_timer_get_time();

    int start = info->first_word_invalid ? 4 : 0;
    int pair_index = 0;
    for (int i = start; i + 1 < info->len; i += 2) {
        int8_t imag = info->buf[i];
        int8_t real = info->buf[i + 1];
        float mag = sqrtf((float)(real * real) + (float)(imag * imag));
        f.bins[pair_index % CSI_BINS] += mag;
        pair_index++;
    }
    normalize(f.bins);

    if (have_previous) {
        f.motion = vec_distance(f.bins, previous_bins);
    }
    memcpy(previous_bins, f.bins, sizeof(previous_bins));
    have_previous = true;

    xQueueSend(csi_queue, &f, 0);
}

static bool enable_csi(void) {
    wifi_ap_record_t ap_info = {0};
    ESP_ERROR_CHECK(esp_wifi_sta_get_ap_info(&ap_info));
    memcpy(ap_bssid, ap_info.bssid, sizeof(ap_bssid));
    have_ap_bssid = true;

    ESP_LOGI(TAG,
             "Monitoring AP %s BSSID %02X:%02X:%02X:%02X:%02X:%02X channel=%d rssi=%d",
             ap_info.ssid,
             ap_bssid[0], ap_bssid[1], ap_bssid[2],
             ap_bssid[3], ap_bssid[4], ap_bssid[5],
             ap_info.primary,
             ap_info.rssi);

    wifi_csi_config_t csi_config = {
#if CONFIG_SOC_WIFI_HE_SUPPORT
        .enable = 1,
        .acquire_csi_legacy = 1,
        .acquire_csi_ht20 = 1,
        .acquire_csi_ht40 = 0,
        .acquire_csi_su = 0,
        .acquire_csi_mu = 0,
        .acquire_csi_dcm = 0,
        .acquire_csi_beamformed = 0,
        .acquire_csi_he_stbc = ESP_CSI_ACQUIRE_STBC_HELTF1,
        .val_scale_cfg = 0,
        .dump_ack_en = 0,
#else
        .lltf_en = true,
        .htltf_en = true,
        .stbc_htltf2_en = true,
        .ltf_merge_en = true,
        .channel_filter_en = false,
        .manu_scale = false,
        .shift = 0,
#endif
    };

    esp_err_t err = esp_wifi_set_promiscuous(true);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Could not enable promiscuous mode: %s", esp_err_to_name(err));
        return false;
    }

    err = esp_wifi_set_csi_rx_cb(csi_rx_cb, NULL);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Could not set CSI callback: %s", esp_err_to_name(err));
        return false;
    }

    err = esp_wifi_set_csi_config(&csi_config);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "CSI config rejected (%s); trying driver defaults", esp_err_to_name(err));
    }

    err = esp_wifi_set_csi(true);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Could not enable CSI: %s", esp_err_to_name(err));
        return false;
    }

    ESP_LOGI(TAG, "CSI enabled");
    return true;
}

static void wifi_event_handler(void *arg, esp_event_base_t base, int32_t id, void *data) {
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGW(TAG, "WiFi disconnected; reconnecting");
        have_ap_bssid = false;
        xEventGroupClearBits(wifi_events, WIFI_CONNECTED_BIT);
        motors_stop();
        esp_wifi_connect();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        xEventGroupSetBits(wifi_events, WIFI_CONNECTED_BIT);
    }
}

static void init_nvs(void) {
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ESP_ERROR_CHECK(nvs_flash_init());
        return;
    }
    ESP_ERROR_CHECK(err);
}

static void init_outputs(void) {
    gpio_config_t out = {
        .pin_bit_mask = (1ULL << LEFT_A) | (1ULL << LEFT_B) |
                        (1ULL << RIGHT_A) | (1ULL << RIGHT_B) |
                        (1ULL << ALERT_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = false,
        .pull_down_en = false,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_ERROR_CHECK(gpio_config(&out));
    motors_stop();
    gpio_set_level(ALERT_PIN, 0);
}

static void init_wifi(void) {
    wifi_events = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));

    ESP_ERROR_CHECK(esp_event_handler_register(
        WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(
        IP_EVENT, IP_EVENT_STA_GOT_IP, wifi_event_handler, NULL));

    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASS,
        },
    };

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_NONE));
    ESP_ERROR_CHECK(esp_wifi_start());

    EventBits_t bits = xEventGroupWaitBits(
        wifi_events,
        WIFI_CONNECTED_BIT,
        pdFALSE,
        pdTRUE,
        pdMS_TO_TICKS(20000));

    if (bits & WIFI_CONNECTED_BIT) {
        csi_ready = enable_csi();
    } else {
        ESP_LOGW(TAG, "WiFi did not connect in 20 seconds; serial motor commands still work.");
        ESP_LOGW(TAG, "Edit WIFI_SSID and WIFI_PASS, then flash again for CSI following.");
    }
}

static bool looks_like_enrolled_gait(float baseline_distance, float motion, const float *bins) {
    if (!gait_ready) {
        return baseline_distance > CHANGE_THRESHOLD || motion > MOTION_THRESHOLD;
    }

    float motion_tolerance = max_float(GAIT_MOTION_FLOOR, gait_motion_std * GAIT_TOLERANCE_MULTIPLIER);
    float change_tolerance = max_float(GAIT_CHANGE_FLOOR, gait_change_std * GAIT_TOLERANCE_MULTIPLIER);
    float shape_distance = vec_distance(bins, gait_centroid);
    float shape_tolerance = CHANGE_THRESHOLD + change_tolerance;

    bool motion_match = fabsf(motion - gait_motion_mean) <= motion_tolerance;
    bool change_match = fabsf(baseline_distance - gait_change_mean) <= change_tolerance;
    bool shape_match = shape_distance <= shape_tolerance;

    return (motion_match && change_match) || shape_match;
}

static bool looks_like_possible_fall(float baseline_distance, float motion) {
    if (!gait_ready) {
        return false;
    }

    float learned_change_limit = gait_change_mean + max_float(FALL_CHANGE_THRESHOLD, gait_change_std * 3.2f);
    float learned_motion_limit = gait_motion_mean + max_float(FALL_MOTION_THRESHOLD, gait_motion_std * 3.2f);

    return baseline_distance > learned_change_limit || motion > learned_motion_limit;
}

static void send_fall_alert(void) {
    fall_alert_count++;
    active_fall_like_frames = 0;
    motors_stop();
    ESP_LOGW(TAG, "POSSIBLE FALL ALERT: sudden enrolled-area CSI disturbance detected");
    emit_appdata("fall-alert");
    pulse_alert(4);
    ignore_until_us = esp_timer_get_time() + ((int64_t)SETTLE_AFTER_MOVE_MS * 2500);
}

static void movement_burst(int trigger_count) {
    ESP_LOGW(TAG, "Enrolled child-like WiFi movement detected; moving briefly");
    pulse_alert(1);

    // One ESP32 cannot estimate direction. This small search pattern keeps the
    // motion gentle while still reacting to the learned movement profile.
    if (trigger_count % 3 == 0) {
        run_for(motors_left, TURN_MS);
        run_for(motors_forward, MOVE_FORWARD_MS);
    } else if (trigger_count % 3 == 1) {
        run_for(motors_right, TURN_MS);
        run_for(motors_forward, MOVE_FORWARD_MS);
    } else {
        run_for(motors_forward, MOVE_FORWARD_MS);
    }

    ignore_until_us = esp_timer_get_time() + ((int64_t)SETTLE_AFTER_MOVE_MS * 1000);
}

static void learn_room_baseline(const csi_feature_t *f) {
    motors_stop();
    for (int i = 0; i < CSI_BINS; i++) {
        baseline[i] += f->bins[i];
    }
    room_frames++;
    ESP_LOGI(TAG, "Onboarding room baseline %d/%d", room_frames, ROOM_BASELINE_FRAMES);
    emit_appdata("room-baseline-progress");

    if (room_frames >= ROOM_BASELINE_FRAMES) {
        for (int i = 0; i < CSI_BINS; i++) {
            baseline[i] /= ROOM_BASELINE_FRAMES;
        }
        normalize(baseline);
        baseline_ready = true;
        ESP_LOGI(TAG, "Room baseline learned in RAM");
        emit_appdata("room-baseline-complete");

        if (require_gait_after_baseline || !gait_ready) {
            start_gait_onboarding();
        } else {
            enter_active_mode();
        }
    }
}

static void learn_gait_profile(const csi_feature_t *f) {
    motors_stop();
    float baseline_distance = vec_distance(f->bins, baseline);
    bool useful_motion = f->motion > MIN_GAIT_SAMPLE_MOTION ||
                         baseline_distance > MIN_GAIT_SAMPLE_CHANGE;

    gait_frames++;
    if (useful_motion) {
        stats_push(&gait_motion_stats, f->motion);
        stats_push(&gait_change_stats, baseline_distance);
        for (int i = 0; i < CSI_BINS; i++) {
            gait_centroid[i] += f->bins[i];
        }
        gait_sample_count++;
    }

    ESP_LOGI(TAG,
             "Onboarding gait frame=%d/%d samples=%d motion=%.3f change=%.3f",
             gait_frames,
             GAIT_ENROLL_FRAMES,
             gait_sample_count,
             f->motion,
             baseline_distance);
    emit_appdata("gait-enroll-progress");

    if (gait_frames >= GAIT_ENROLL_FRAMES) {
        if (gait_sample_count < MIN_GAIT_SAMPLES) {
            ESP_LOGW(TAG, "Not enough child movement samples yet; keep the child moving alone");
            gait_frames = 0;
            return;
        }

        for (int i = 0; i < CSI_BINS; i++) {
            gait_centroid[i] /= gait_sample_count;
        }
        normalize(gait_centroid);

        gait_motion_mean = gait_motion_stats.mean;
        gait_motion_std = stats_stddev(&gait_motion_stats);
        gait_change_mean = gait_change_stats.mean;
        gait_change_std = stats_stddev(&gait_change_stats);
        gait_ready = true;

        ESP_LOGI(TAG, "Child movement/gait profile learned in RAM");
        emit_appdata("gait-enroll-complete");
        enter_active_mode();
    }
}

static void active_follow_logic(const csi_feature_t *f) {
    int64_t now_us = esp_timer_get_time();
    if (now_us < ignore_until_us) {
        motors_stop();
        return;
    }

    float baseline_distance = vec_distance(f->bins, baseline);
    bool significant_change = baseline_distance > CHANGE_THRESHOLD || f->motion > MOTION_THRESHOLD;
    bool gait_like = significant_change && (
#if DEMO_FOLLOW_ANY_SIGNIFICANT
        true
#else
        looks_like_enrolled_gait(
        baseline_distance,
        f->motion,
        f->bins
        )
#endif
    );
    bool fall_like = significant_change && looks_like_possible_fall(baseline_distance, f->motion);

    if (fall_like) {
        active_fall_like_frames++;
    } else if (active_fall_like_frames > 0) {
        active_fall_like_frames--;
    }

    if (gait_like) {
        active_child_like_frames++;
    } else {
        if (active_child_like_frames > 0) {
            active_child_like_frames--;
        }
        if (!significant_change) {
            update_baseline_slowly(f->bins);
        }
    }

    ESP_LOGI(TAG,
             "active rssi=%d change=%.3f motion=%.3f significant=%d gaitLike=%d fallLike=%d frames=%d fallFrames=%d",
             f->rssi,
             baseline_distance,
             f->motion,
             significant_change,
             gait_like,
             fall_like,
             active_child_like_frames,
             active_fall_like_frames);

    if (active_fall_like_frames >= FALL_TRIGGER_FRAMES) {
        send_fall_alert();
        return;
    }

    if (active_child_like_frames >= TRIGGER_FRAMES) {
        active_child_like_frames = 0;
        active_trigger_count++;
        emit_appdata("movement-trigger");
        movement_burst(active_trigger_count);
    } else {
        motors_stop();
    }
}

static void gait_mover_task(void *arg) {
    int no_csi_frames = 0;

    while (true) {
        handle_pending_command();

        csi_feature_t f;
        if (!xQueueReceive(csi_queue, &f, pdMS_TO_TICKS(1000))) {
            no_csi_frames++;
            if (no_csi_frames >= 5) {
                ESP_LOGW(TAG, "No CSI frames. Move closer to router or create WiFi traffic.");
                no_csi_frames = 0;
            }
            motors_stop();
            continue;
        }
        no_csi_frames = 0;

        if (mode == MODE_ROOM_BASELINE) {
            learn_room_baseline(&f);
        } else if (mode == MODE_GAIT_ENROLL) {
            learn_gait_profile(&f);
        } else {
            active_follow_logic(&f);
        }
    }
}

static void serial_command_task(void *arg) {
    ESP_LOGI(TAG, "Serial commands: r=full onboarding, b=room baseline, g=gait recal, s=status");
    ESP_LOGI(TAG, "Motor tests: w=forward, a=left, d=right, x=stop");

    while (true) {
        uint8_t ch = 0;
        int len = uart_read_bytes(UART_NUM_0, &ch, 1, pdMS_TO_TICKS(250));
        if (len <= 0) {
            continue;
        }

        if (ch == 'r' || ch == 'R') {
            pending_command = CMD_FULL_ONBOARD;
        } else if (ch == 'b' || ch == 'B') {
            pending_command = CMD_ROOM_RECALIBRATE;
        } else if (ch == 'g' || ch == 'G') {
            pending_command = CMD_GAIT_RECALIBRATE;
        } else if (ch == 's' || ch == 'S') {
            pending_command = CMD_STATUS;
        } else if (ch == 'w' || ch == 'W') {
            pending_command = CMD_TEST_FORWARD;
        } else if (ch == 'a' || ch == 'A') {
            pending_command = CMD_TEST_LEFT;
        } else if (ch == 'd' || ch == 'D') {
            pending_command = CMD_TEST_RIGHT;
        } else if (ch == 'x' || ch == 'X') {
            pending_command = CMD_TEST_STOP;
        }
    }
}

static void init_serial_commands(void) {
    esp_err_t err = uart_driver_install(UART_NUM_0, 1024, 0, 0, NULL, 0);
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        ESP_LOGW(TAG, "UART command setup failed: %s", esp_err_to_name(err));
    }
}

void app_main(void) {
    init_nvs();
    init_outputs();
    init_serial_commands();

    csi_queue = xQueueCreate(32, sizeof(csi_feature_t));
    if (!csi_queue) {
        ESP_LOGE(TAG, "Could not create CSI queue");
        return;
    }

    ESP_LOGI(TAG, "One ESP32-C6 onboarding gait mover");
    ESP_LOGI(TAG, "This learns room CSI, then child-only movement CSI, then reacts.");

    xTaskCreate(serial_command_task, "serial_command_task", 4096, NULL, 3, NULL);

    init_wifi();

    if (csi_ready) {
        start_room_onboarding(true);
        xTaskCreate(gait_mover_task, "gait_mover_task", 8192, NULL, 5, NULL);
    } else {
        ESP_LOGW(TAG, "CSI task not started because WiFi is not connected.");
    }
}
