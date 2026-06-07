#include <Arduino.h>
#include <unity.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

// ══════════════════════════════════════════════════════════════════════════════
// ── Pure functions extracted from main.cpp for testing ────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── utcToLocalTime (simplified — uses fixed offset for testing) ───────────────
String utcToLocalTimeWithOffset(int utcHour, int utcMin, int offsetHours) {
    int localHour = (utcHour + offsetHours + 24) % 24;
    char buf[6];
    sprintf(buf, "%02d:%02d", localHour, utcMin);
    return String(buf);
}

// ── Compartment steps ─────────────────────────────────────────────────────────
const int COMPARTMENT_STEPS[9] = {
    0, 0, 256, 512, 768, 1024, 1280, 1536, 1792
};

// ── Time format helper ────────────────────────────────────────────────────────
String formatTime(int hour, int minute) {
    char buf[6];
    sprintf(buf, "%02d:%02d", hour, minute);
    return String(buf);
}

// ── Parse UTC time from ISO string ────────────────────────────────────────────
// "2026-06-01T10:30:00.000Z" → hour=10, min=30
bool parseUtcTime(const String& isoString, int& hour, int& minute) {
    if (isoString.length() < 16) return false;
    hour   = isoString.substring(11, 13).toInt();
    minute = isoString.substring(14, 16).toInt();
    return true;
}

// ── Minutes difference (handles midnight wraparound) ─────────────────────────python -m platformio test -e esp32dev
int minutesDiff(int nowMinutes, int intakeMinutes) {
    int diff = abs(nowMinutes - intakeMinutes);
    if (diff > 12 * 60) diff = 24 * 60 - diff;
    return diff;
}

// ── Compartment number validation ─────────────────────────────────────────────
bool isValidCompartment(int compartment) {
    return compartment >= 1 && compartment <= 8;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Tests: utcToLocalTime ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

void test_utcToLocalTime_UTC3_morning() {
    // 10:00 UTC + 3 = 13:00 Kyiv
    String result = utcToLocalTimeWithOffset(10, 0, 3);
    TEST_ASSERT_EQUAL_STRING("13:00", result.c_str());
}

void test_utcToLocalTime_UTC3_evening() {
    // 20:00 UTC + 3 = 23:00 Kyiv
    String result = utcToLocalTimeWithOffset(20, 0, 3);
    TEST_ASSERT_EQUAL_STRING("23:00", result.c_str());
}

void test_utcToLocalTime_midnight_wrap() {
    // 23:00 UTC + 3 = 02:00 next day Kyiv
    String result = utcToLocalTimeWithOffset(23, 0, 3);
    TEST_ASSERT_EQUAL_STRING("02:00", result.c_str());
}

void test_utcToLocalTime_midnight_utc() {
    // 00:00 UTC + 3 = 03:00 Kyiv
    String result = utcToLocalTimeWithOffset(0, 0, 3);
    TEST_ASSERT_EQUAL_STRING("03:00", result.c_str());
}

void test_utcToLocalTime_preserves_minutes() {
    // 10:30 UTC + 3 = 13:30 Kyiv
    String result = utcToLocalTimeWithOffset(10, 30, 3);
    TEST_ASSERT_EQUAL_STRING("13:30", result.c_str());
}

void test_utcToLocalTime_UTC2_winter() {
    // 10:00 UTC + 2 = 12:00 Kyiv winter
    String result = utcToLocalTimeWithOffset(10, 0, 2);
    TEST_ASSERT_EQUAL_STRING("12:00", result.c_str());
}

void test_utcToLocalTime_zero_offset() {
    // 10:00 UTC + 0 = 10:00
    String result = utcToLocalTimeWithOffset(10, 30, 0);
    TEST_ASSERT_EQUAL_STRING("10:30", result.c_str());
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Tests: formatTime ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

void test_formatTime_pads_single_digits() {
    String result = formatTime(8, 5);
    TEST_ASSERT_EQUAL_STRING("08:05", result.c_str());
}

void test_formatTime_midnight() {
    String result = formatTime(0, 0);
    TEST_ASSERT_EQUAL_STRING("00:00", result.c_str());
}

void test_formatTime_end_of_day() {
    String result = formatTime(23, 59);
    TEST_ASSERT_EQUAL_STRING("23:59", result.c_str());
}

void test_formatTime_noon() {
    String result = formatTime(12, 0);
    TEST_ASSERT_EQUAL_STRING("12:00", result.c_str());
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Tests: parseUtcTime ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

void test_parseUtcTime_valid_iso() {
    int hour = 0, min = 0;
    bool ok = parseUtcTime("2026-06-01T10:30:00.000Z", hour, min);
    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL(10, hour);
    TEST_ASSERT_EQUAL(30, min);
}

void test_parseUtcTime_midnight() {
    int hour = 0, min = 0;
    bool ok = parseUtcTime("2026-06-01T00:00:00.000Z", hour, min);
    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL(0, hour);
    TEST_ASSERT_EQUAL(0, min);
}

void test_parseUtcTime_end_of_day() {
    int hour = 0, min = 0;
    bool ok = parseUtcTime("2026-06-01T23:59:00.000Z", hour, min);
    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL(23, hour);
    TEST_ASSERT_EQUAL(59, min);
}

void test_parseUtcTime_invalid_short_string() {
    int hour = 0, min = 0;
    bool ok = parseUtcTime("2026", hour, min);
    TEST_ASSERT_FALSE(ok);
}

void test_parseUtcTime_empty_string() {
    int hour = 0, min = 0;
    bool ok = parseUtcTime("", hour, min);
    TEST_ASSERT_FALSE(ok);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Tests: minutesDiff ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

void test_minutesDiff_same_time() {
    TEST_ASSERT_EQUAL(0, minutesDiff(600, 600));
}

void test_minutesDiff_one_minute() {
    TEST_ASSERT_EQUAL(1, minutesDiff(600, 601));
}

void test_minutesDiff_midnight_wraparound() {
    // 23:59 vs 00:01 — diff should be 2, not 1438
    int now    = 23 * 60 + 59; // 1439
    int intake = 0  * 60 + 1;  // 1
    TEST_ASSERT_EQUAL(2, minutesDiff(now, intake));
}

void test_minutesDiff_intake_is_ready() {
    // diff <= 1 means intake time
    int now    = 10 * 60 + 30; // 630
    int intake = 10 * 60 + 30; // 630
    TEST_ASSERT_TRUE(minutesDiff(now, intake) <= 1);
}

void test_minutesDiff_not_ready() {
    // diff > 1 means not yet
    int now    = 10 * 60;      // 600
    int intake = 10 * 60 + 30; // 630
    TEST_ASSERT_TRUE(minutesDiff(now, intake) > 1);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Tests: isValidCompartment ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

void test_compartment_1_is_valid() {
    TEST_ASSERT_TRUE(isValidCompartment(1));
}

void test_compartment_8_is_valid() {
    TEST_ASSERT_TRUE(isValidCompartment(8));
}

void test_compartment_0_is_invalid() {
    TEST_ASSERT_FALSE(isValidCompartment(0));
}

void test_compartment_9_is_invalid() {
    TEST_ASSERT_FALSE(isValidCompartment(9));
}

void test_compartment_negative_is_invalid() {
    TEST_ASSERT_FALSE(isValidCompartment(-1));
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Tests: COMPARTMENT_STEPS ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

void test_compartment_steps_comp1_is_zero() {
    TEST_ASSERT_EQUAL(0, COMPARTMENT_STEPS[1]);
}

void test_compartment_steps_comp2() {
    TEST_ASSERT_EQUAL(256, COMPARTMENT_STEPS[2]);
}

void test_compartment_steps_comp8() {
    TEST_ASSERT_EQUAL(1792, COMPARTMENT_STEPS[8]);
}

void test_compartment_steps_increments_by_256() {
    for (int i = 3; i <= 8; i++) {
        TEST_ASSERT_EQUAL(256, COMPARTMENT_STEPS[i] - COMPARTMENT_STEPS[i - 1]);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Setup & Loop ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

void setup() {
    delay(2000);
    UNITY_BEGIN();

    // utcToLocalTime
    RUN_TEST(test_utcToLocalTime_UTC3_morning);
    RUN_TEST(test_utcToLocalTime_UTC3_evening);
    RUN_TEST(test_utcToLocalTime_midnight_wrap);
    RUN_TEST(test_utcToLocalTime_midnight_utc);
    RUN_TEST(test_utcToLocalTime_preserves_minutes);
    RUN_TEST(test_utcToLocalTime_UTC2_winter);
    RUN_TEST(test_utcToLocalTime_zero_offset);

    // formatTime
    RUN_TEST(test_formatTime_pads_single_digits);
    RUN_TEST(test_formatTime_midnight);
    RUN_TEST(test_formatTime_end_of_day);
    RUN_TEST(test_formatTime_noon);

    // parseUtcTime
    RUN_TEST(test_parseUtcTime_valid_iso);
    RUN_TEST(test_parseUtcTime_midnight);
    RUN_TEST(test_parseUtcTime_end_of_day);
    RUN_TEST(test_parseUtcTime_invalid_short_string);
    RUN_TEST(test_parseUtcTime_empty_string);

    // minutesDiff
    RUN_TEST(test_minutesDiff_same_time);
    RUN_TEST(test_minutesDiff_one_minute);
    RUN_TEST(test_minutesDiff_midnight_wraparound);
    RUN_TEST(test_minutesDiff_intake_is_ready);
    RUN_TEST(test_minutesDiff_not_ready);

    // isValidCompartment
    RUN_TEST(test_compartment_1_is_valid);
    RUN_TEST(test_compartment_8_is_valid);
    RUN_TEST(test_compartment_0_is_invalid);
    RUN_TEST(test_compartment_9_is_invalid);
    RUN_TEST(test_compartment_negative_is_invalid);

    // COMPARTMENT_STEPS
    RUN_TEST(test_compartment_steps_comp1_is_zero);
    RUN_TEST(test_compartment_steps_comp2);
    RUN_TEST(test_compartment_steps_comp8);
    RUN_TEST(test_compartment_steps_increments_by_256);

    UNITY_END();
}

void loop() {}