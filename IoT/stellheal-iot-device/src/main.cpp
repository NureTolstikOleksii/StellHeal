#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ThreeWire.h>
#include <RtcDS1302.h>
#include <U8g2lib.h>
#include <Wire.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <Stepper.h>
#include <HX711.h>
#include "time.h"

// ── Піни ─────────────────────────────────────────────────────────────────────
#define BUTTON_PIN      0
#define BUZZER_LED      15
#define RST_PIN         4
#define SS_PIN          5
#define HALL_SENSOR_PIN 34
#define LOADCELL_DT     32
#define LOADCELL_SCK    33

// ── Ноти ──────────────────────────────────────────────────────────────────────
#define NOTE_C4  262
#define NOTE_E4  330
#define NOTE_GS4 415
#define NOTE_A4  440
#define NOTE_B4  494
#define NOTE_C5  523
#define NOTE_D5  587
#define NOTE_DS5 622
#define NOTE_E5  659
const int BUZZER_PIN = BUZZER_LED;

// ── Пристрої ──────────────────────────────────────────────────────────────────
Stepper drum(2048, 13, 12, 14, 27);
ThreeWire myWire(16, 17, 2);
RtcDS1302<ThreeWire> Rtc(myWire);
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);
MFRC522 rfid(SS_PIN, RST_PIN);
Servo loadServo;
Servo unloadServo;
HX711 scale;
float calibration_factor = -7050.0;

// ── Позиції відсіків ──────────────────────────────────────────────────────────
const int COMPARTMENT_STEPS[9] = {
    0, 0, 256, 512, 768, 1024, 1280, 1536, 1792
};

// ── API ───────────────────────────────────────────────────────────────────────
const char* API_BASE         = "http://192.168.0.102:4200/api/device";
const char* API_BASE_NOTIFIC = "http://192.168.0.102:4200/api/notification";
const char* DEVICE_UID       = "esp32_container_1";
const char* DEVICE_SECRET    = "s3cr3t_container_1_2026";

// ── Глобальні змінні ──────────────────────────────────────────────────────────
String deviceToken           = "";
int    containerId           = 0;
int    currentCompartment    = 1;
int    lastOpenedCompartment = -1;
int    lastPrescriptionMedId = -1;

// Наступний прийом
String nextIntakeTimeUtc   = "";  // UTC "HH:mm" — для логів
String nextIntakeTimeLocal = "";  // Київ "HH:mm" — для відображення і порівняння
String nextIntakeMed       = "";
int    nextIntakeComp      = 0;

// Кнопка
unsigned long buttonPressStart = 0;
bool rfidAuthenticated = false;
bool isLidOpen         = false;

// Синхронізація часу
unsigned long lastSyncMillis       = 0;
const unsigned long SYNC_INTERVAL  = 7UL * 24 * 60 * 60 * 1000;

// Моніторинг ваги
bool          weightMonitoring          = false;
unsigned long weightMonitorStart        = 0;
float         weightAtStart             = 0.0;
const unsigned long WEIGHT_MONITOR_DURATION = 1 * 60 * 1000; // 1 хвилина
const float   WEIGHT_THRESHOLD          = 1.0;               // грами
bool          alertSent                 = false;

// ── Оголошення функцій ────────────────────────────────────────────────────────
void   showMsg(String l1, String l2);
void   showMsg(String l1, String l2, String l3);
void   syncRtcWithNtp();
void   displayClock();
void   checkRFID();
void   handleButtonLogic();
void   toggleLoadingMode();
void   triggerBuzzer();
void   shutdownDevice();
void   authenticateDevice();
void   sendHeartbeat();
bool   checkNextIntake();
void   confirmIntake(int prescriptionMedId);
void   rotateToCompartment(int target);
void   completeCommand(int id);
void   handleCommands();
void   sendRfidStatus(bool authenticated);
void   sendWeightAlert(int prescriptionMedId);
void   logDeviceEvent(String type, String code, String message);
void   sendIntakeReminder(int prescriptionMedId);
void   playBeethovenMelody();
String utcToLocalTime(int utcHour, int utcMin);

// ── UTC → локальний час Київ (DST через TZ змінну ESP32) ─────────────────────
String utcToLocalTime(int utcHour, int utcMin) {
    time_t now_epoch;
    time(&now_epoch);
    struct tm utcInfo, localInfo;
    gmtime_r(&now_epoch, &utcInfo);
    localtime_r(&now_epoch, &localInfo);

    int offsetHours = localInfo.tm_hour - utcInfo.tm_hour;
    if (offsetHours < -12) offsetHours += 24;
    if (offsetHours >  12) offsetHours -= 24;

    int localHour = (utcHour + offsetHours + 24) % 24;
    char buf[6];
    sprintf(buf, "%02d:%02d", localHour, utcMin);
    return String(buf);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);

    pinMode(BUTTON_PIN,      INPUT_PULLUP);
    pinMode(BUZZER_LED,      OUTPUT);
    pinMode(HALL_SENSOR_PIN, INPUT);

    loadServo.attach(25);   loadServo.write(90);
    unloadServo.attach(26); unloadServo.write(83);

    u8g2.begin();
    u8g2.enableUTF8Print();

    drum.setSpeed(8);
    showMsg("STELLHEAL", "Калібрування...");

    // Калібрування барабана по датчику Холла
    drum.step(50);
    delay(100);

    int hallStableCount = 0;
    while (hallStableCount < 5) {
        drum.step(1);
        delay(3);
        if (digitalRead(HALL_SENSOR_PIN) == LOW) hallStableCount++;
        else                                      hallStableCount = 0;
    }

    drum.setSpeed(10);
    currentCompartment = 1;
    Serial.println("HOME POSITION SET");

    scale.begin(LOADCELL_DT, LOADCELL_SCK);
    scale.set_scale(calibration_factor);
    scale.tare();
    Serial.println("Scale ready");

    WiFiManager wm;
    showMsg("WiFi", "StellHeal_Setup");
    if (!wm.autoConnect("StellHeal_Setup")) ESP.restart();

    // TZ для України: UTC+2 зима / UTC+3 літо (DST автоматично)
    syncRtcWithNtp();
    lastSyncMillis = millis();

    SPI.begin();
    rfid.PCD_Init();
    Rtc.Begin();

    showMsg("Авторизація", "Підключення...");
    authenticateDevice();

    showMsg("ГОТОВО", "Система готова");
    delay(2000);
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
    // Повторна авторизація якщо токен відсутній
    static unsigned long lastAuthTry = 0;
    if (deviceToken == "" && millis() - lastAuthTry > 5000) {
        authenticateDevice();
        lastAuthTry = millis();
    }

    // Перепідключення WiFi
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi втрачено, перепідключення...");
        WiFi.reconnect();
    }

    // Heartbeat кожну хвилину
    static unsigned long lastHeartbeat = 0;
    if (millis() - lastHeartbeat > 60000) {
        sendHeartbeat();
        lastHeartbeat = millis();
    }

    // Перевірка наступного прийому кожні 10 секунд
    static unsigned long lastCheck = 0;
    if (millis() - lastCheck > 10000) {
        checkNextIntake();
        lastCheck = millis();
    }

    // Команди від веб-інтерфейсу кожні 3 секунди
    static unsigned long lastCommands = 0;
    if (millis() - lastCommands > 3000) {
        handleCommands();
        lastCommands = millis();
    }

    // Щотижнева синхронізація NTP
    if (millis() - lastSyncMillis > SYNC_INTERVAL && WiFi.status() == WL_CONNECTED) {
        syncRtcWithNtp();
        lastSyncMillis = millis();
    }

    // ── Моніторинг ваги після видачі ─────────────────────────────────────────
    // confirmIntake викликається ТІЛЬКИ тут — після підтвердження вагою
    if (weightMonitoring) {
    float currentWeight = scale.get_units(3);
    float weightDiff    = weightAtStart - currentWeight;
    Serial.printf("Вага: %.2f г, різниця: %.2f г\n", currentWeight, weightDiff);

    if (weightDiff >= WEIGHT_THRESHOLD) {
      Serial.println("Таблетки взято — підтверджуємо прийом");
      confirmIntake(lastPrescriptionMedId);
      lastOpenedCompartment = -1;  // ← скидаємо
      weightMonitoring      = false;
      alertSent             = false;
      showMsg("ДОБРЕ!", "Таблетки взято");
      delay(1000);

      } else if (millis() - weightMonitorStart > WEIGHT_MONITOR_DURATION && !alertSent) {
          Serial.println("Таблетки НЕ взято — надсилаємо алерт");
          sendWeightAlert(lastPrescriptionMedId);
          lastOpenedCompartment = -1;  // ← скидаємо
          alertSent             = true;
          weightMonitoring      = false;
      }
    }

    if (!rfidAuthenticated) {
        displayClock();
        checkRFID();
    } else {
        handleButtonLogic();
    }
}

// ── Синхронізація RTC з NTP ───────────────────────────────────────────────────
void syncRtcWithNtp() {
    showMsg("Синхронізація", "Часу...");

    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    // TZ Україна: EET (UTC+2 зима) / EEST (UTC+3 літо)
    // M3.5.0/3 = остання неділя березня о 3:00 → літній час
    // M10.5.0/4 = остання неділя жовтня о 4:00 → зимовий час
    setenv("TZ", "EET-2EEST,M3.5.0/3,M10.5.0/4", 1);
    tzset();

    struct tm timeinfo;
    int retry = 0;
    while (!getLocalTime(&timeinfo) && retry < 15) {
        delay(500);
        retry++;
    }

    if (retry < 15) {
        // RTC зберігає ЛОКАЛЬНИЙ київський час
        Rtc.SetDateTime(RtcDateTime(
            timeinfo.tm_year + 1900,
            timeinfo.tm_mon + 1,
            timeinfo.tm_mday,
            timeinfo.tm_hour,
            timeinfo.tm_min,
            timeinfo.tm_sec
        ));
        Serial.printf("RTC (Київ): %02d:%02d:%02d\n",
            timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
    } else {
        showMsg("Помилка", "NTP недоступний");
    }
}

// ── Дисплей ───────────────────────────────────────────────────────────────────
void displayClock() {
    static unsigned long lastDisplayUpdate = 0;
    if (millis() - lastDisplayUpdate < 1000) return;
    lastDisplayUpdate = millis();

    RtcDateTime now = Rtc.GetDateTime();
    u8g2.clearBuffer();

    if (nextIntakeTimeLocal != "") {
        // Режим з наступним прийомом
        u8g2.setFont(u8g2_font_logisoso16_tr);
        char timeBuf[6];
        sprintf(timeBuf, "%02d:%02d", now.Hour(), now.Minute());
        u8g2.drawStr(34, 16, timeBuf);

        u8g2.drawHLine(0, 19, 128);

        u8g2.setFont(u8g2_font_unifont_t_cyrillic);

        u8g2.setCursor(0, 32);
        u8g2.print("Ліки: ");
        u8g2.print(nextIntakeMed.substring(0, 10).c_str());

        u8g2.setCursor(0, 44);
        u8g2.print("О: ");
        u8g2.print(nextIntakeTimeLocal.c_str());
        u8g2.print(" відс.");
        u8g2.print(nextIntakeComp);

        // Відлік до прийому
        int nowMinutes    = now.Hour() * 60 + now.Minute();
        int intakeHour    = nextIntakeTimeLocal.substring(0, 2).toInt();
        int intakeMin     = nextIntakeTimeLocal.substring(3, 5).toInt();
        int intakeMinutes = intakeHour * 60 + intakeMin;
        int diff          = intakeMinutes - nowMinutes;
        if (diff < 0) diff += 24 * 60;

        u8g2.setCursor(0, 56);
        u8g2.print("Через: ");
        if (diff / 60 > 0) { u8g2.print(diff / 60); u8g2.print("г "); }
        u8g2.print(diff % 60);
        u8g2.print(" хв");

    } else {
        // Великий годинник
        u8g2.setFont(u8g2_font_logisoso32_tr);
        char timeBuf[6];
        sprintf(timeBuf, "%02d:%02d", now.Hour(), now.Minute());
        u8g2.drawStr(14, 42, timeBuf);

        u8g2.setFont(u8g2_font_unifont_t_cyrillic);
        u8g2.setCursor(4, 60);
        u8g2.print("Немає прийомів");
    }

    u8g2.sendBuffer();
}

// ── showMsg ───────────────────────────────────────────────────────────────────
void showMsg(String l1, String l2) { showMsg(l1, l2, ""); }

void showMsg(String l1, String l2, String l3) {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_unifont_t_cyrillic);
    u8g2.setCursor(0, 14); u8g2.print(l1.c_str());
    u8g2.setCursor(0, 36); u8g2.print(l2.c_str());
    if (l3 != "") { u8g2.setCursor(0, 56); u8g2.print(l3.c_str()); }
    u8g2.sendBuffer();
}

// ── RFID ──────────────────────────────────────────────────────────────────────
void checkRFID() {
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
        rfidAuthenticated = true;
        triggerBuzzer();
        showMsg("Авторизовано", "Кнопка активна");
        sendRfidStatus(true);
        logDeviceEvent("info", "RFID_AUTH", "Медсестра авторизувалась через RFID");
        delay(1000);
    }
}

// ── Кнопка ────────────────────────────────────────────────────────────────────
void handleButtonLogic() {
    static bool buzzerTriggered = false;
    if (digitalRead(BUTTON_PIN) == LOW) {
        if (buttonPressStart == 0) buttonPressStart = millis();
        unsigned long duration = millis() - buttonPressStart;
        if (duration >= 10000) {
            if (!buzzerTriggered) { triggerBuzzer(); buzzerTriggered = true; }
            showMsg("ДІЯ:", "Відпустіть → вимкн.");
        } else if (duration >= 5000) {
            if (!buzzerTriggered) { triggerBuzzer(); buzzerTriggered = true; }
            showMsg("ДІЯ:", "Скинути WiFi");
        }
    } else {
        if (buttonPressStart > 0) {
            unsigned long d = millis() - buttonPressStart;
            buttonPressStart = 0; buzzerTriggered = false;
            if      (d >= 10000)           shutdownDevice();
            else if (d >= 5000) {
                showMsg("СКИДАННЯ", "WiFi...");
                WiFiManager wm; wm.resetSettings(); ESP.restart();
            } else if (d > 50 && d < 3000) toggleLoadingMode();
        }
    }
}

void toggleLoadingMode() {
    if (!isLidOpen) {
        showMsg("ЗАПОВНЕННЯ", "Відкрито");
        loadServo.write(0);
        isLidOpen = true;
    } else {
        showMsg("ВИХІД", "Закриваємо...");
        loadServo.write(90);
        isLidOpen = false;
        delay(1000);
        rfidAuthenticated = false;
    }
}

// ── Утиліти ───────────────────────────────────────────────────────────────────
void triggerBuzzer() {
    digitalWrite(BUZZER_LED, HIGH); delay(200); digitalWrite(BUZZER_LED, LOW);
}

void shutdownDevice() {
    showMsg("ВИМКНЕННЯ", "Сплячий режим...");
    delay(800);
    u8g2.clearBuffer(); u8g2.sendBuffer();
    u8g2.setPowerSave(1);
    digitalWrite(BUZZER_LED, LOW);
    pinMode(BUZZER_LED, INPUT);
    pinMode(BUTTON_PIN,  INPUT);
    delay(200);
    esp_sleep_enable_ext0_wakeup(GPIO_NUM_0, 0);
    esp_deep_sleep_start();
}

// ── Автентифікація ────────────────────────────────────────────────────────────
void authenticateDevice() {
    if (WiFi.status() != WL_CONNECTED) return;
    WiFiClient client; HTTPClient http;
    http.begin(client, String(API_BASE) + "/auth");
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["device_uid"] = DEVICE_UID;
    doc["secret"]     = DEVICE_SECRET;
    String body; serializeJson(doc, body);

    int code = http.POST(body);
    Serial.printf("AUTH: %d\n", code);

    if (code == 200) {
        String response = http.getString();
        StaticJsonDocument<300> res;
        deserializeJson(res, response);
        deviceToken = res["token"].as<String>();
        containerId = res["container_id"];
        Serial.printf("Авторизовано, container_id=%d\n", containerId);
    } else {
        Serial.println("Авторизація не вдалась");
    }
    http.end();
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
void sendHeartbeat() {
    if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;
    WiFiClient client; HTTPClient http;
    http.begin(client, String(API_BASE) + "/heartbeat");
    http.addHeader("Authorization", "Bearer " + deviceToken);
    int code = http.POST("");
    Serial.printf("HEARTBEAT: %d\n", code);
    http.end();
}

// ── Наступний прийом ──────────────────────────────────────────────────────────
// Бекенд повертає ліки що вже в контейнері (compartment_medications: { some: {} })
// і ще не прийняті (intake_status: null), відсортовані по intake_at
bool checkNextIntake() {
    if (WiFi.status() != WL_CONNECTED || deviceToken == "") return false;
    WiFiClient client; HTTPClient http;
    http.begin(client, String(API_BASE) + "/next-intake");
    http.addHeader("Authorization", "Bearer " + deviceToken);

    int code = http.GET();
    Serial.printf("NEXT INTAKE: %d\n", code);
    if (code != 200) { http.end(); return false; }

    String response = http.getString();
    Serial.println(response);

    StaticJsonDocument<400> doc;
    if (deserializeJson(doc, response)) {
        Serial.println("JSON parse error");
        http.end();
        return false;
    }

    // Немає прийомів в контейнері
    if (doc.containsKey("message")) {
        nextIntakeTimeUtc   = "";
        nextIntakeTimeLocal = "";
        nextIntakeComp      = 0;
        nextIntakeMed       = "";
        http.end();
        return false;
    }

    if (!doc.containsKey("intake_at") || !doc.containsKey("compartment_number")) {
        Serial.println("Невірні поля відповіді");
        http.end();
        return false;
    }

    int prescriptionMedId = doc["prescription_med_id"];
    nextIntakeComp        = doc["compartment_number"];
    nextIntakeMed         = doc["medication_name"] | "Невідомо";

    // intake_at — UTC ISO: "2026-06-02T21:00:00.000Z"
    String intakeTimeFull = doc["intake_at"].as<String>();
    int utcHour = intakeTimeFull.substring(11, 13).toInt();
    int utcMin  = intakeTimeFull.substring(14, 16).toInt();

    nextIntakeTimeUtc   = intakeTimeFull.substring(11, 16); // UTC для логів
    nextIntakeTimeLocal = utcToLocalTime(utcHour, utcMin);  // Київ для відображення і порівняння

    Serial.printf("UTC: %s | Київ: %s | відсік: %d | ліки: %s\n",
        nextIntakeTimeUtc.c_str(), nextIntakeTimeLocal.c_str(),
        nextIntakeComp, nextIntakeMed.c_str());

    // Порівнюємо ЛОКАЛЬНИЙ час прийому з ЛОКАЛЬНИМ часом RTC
    RtcDateTime now = Rtc.GetDateTime();
    char currentTime[6];
    sprintf(currentTime, "%02d:%02d", now.Hour(), now.Minute());
    Serial.printf("RTC (Київ): %s\n", currentTime);

    int nowMinutes    = now.Hour() * 60 + now.Minute();
    int intakeHour    = nextIntakeTimeLocal.substring(0, 2).toInt();
    int intakeMin     = nextIntakeTimeLocal.substring(3, 5).toInt();
    int intakeMinutes = intakeHour * 60 + intakeMin;
    int diff          = abs(nowMinutes - intakeMinutes);
    if (diff > 12 * 60) diff = 24 * 60 - diff; // через північ

    if (diff <= 1) {
      if (nextIntakeComp != lastOpenedCompartment) {
        Serial.println("ЧАС СПІВПАВ - ВІДКРИВАЄМО ВІДСІК");
        logDeviceEvent("info", "INTAKE_TRIGGERED",
            "Відкриття відсіку " + String(nextIntakeComp) +
            " о " + nextIntakeTimeLocal);

        lastPrescriptionMedId = prescriptionMedId;

        // 1. Повертаємо барабан
        rotateToCompartment(nextIntakeComp);

        // 2. Відкриваємо відсік видачі
        unloadServo.write(20);
        delay(3000);
        // 3. Закриваємо відсік видачі
        unloadServo.write(83);
        delay(1000);

        // 4. Грати мелодію (серво від'єднані всередині)
        playBeethovenMelody();

        lastOpenedCompartment = nextIntakeComp;

        // 5. Надсилаємо нагадування (НЕ confirmIntake — чекаємо на вагу)
        sendIntakeReminder(prescriptionMedId);

        // 6. Починаємо моніторинг ваги
        weightAtStart        = scale.get_units(5);
        weightMonitorStart   = millis();
        weightMonitoring     = true;
        alertSent            = false;
        Serial.printf("Моніторинг ваги розпочато, початкова: %.2f г\n", weightAtStart);
      }
    }

    http.end();
    return true;
}

// ── Підтвердження прийому (викликається ТІЛЬКИ після підтвердження вагою) ────
void confirmIntake(int prescriptionMedId) {
    if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;
    WiFiClient client; HTTPClient http;
    http.begin(client, String(API_BASE) + "/intake");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + deviceToken);

    StaticJsonDocument<200> doc;
    doc["prescription_med_id"] = prescriptionMedId;
    String body; serializeJson(doc, body);

    int code = http.POST(body);
    Serial.printf("CONFIRM INTAKE: %d\n", code);

    if (code == 200) {
        Serial.println("Прийом підтверджено на сервері");
        logDeviceEvent("info", "INTAKE_CONFIRMED",
            "Прийом підтверджено вагою, med_id=" + String(prescriptionMedId));
    }
    http.end();
}

// ── Ротація барабана ──────────────────────────────────────────────────────────
void rotateToCompartment(int target) {
    if (target < 1 || target > 8 || target == currentCompartment) return;

    Serial.println("Повернення на HOME...");
    drum.step(20);
    delay(50);

    int hallStableCount = 0, steps = 0;
    while (hallStableCount < 5 && steps < 2500) {
        drum.step(1); delay(2); steps++;
        if (digitalRead(HALL_SENSOR_PIN) == LOW) hallStableCount++;
        else                                      hallStableCount = 0;
    }

    if (steps >= 2500) {
        Serial.println("Датчик Холла не знайдено!");
        logDeviceEvent("error", "MOTOR_ERROR", "Датчик Холла не знайдено під час калібрування");
        return;
    }

    currentCompartment = 1;
    if (target == 1) return;

    int stepsToMove = COMPARTMENT_STEPS[target];
    Serial.printf("Переміщення до відсіку %d (%d кроків)\n", target, stepsToMove);
    drum.step(stepsToMove);
    currentCompartment = target;

    logDeviceEvent("info", "MOTOR_OK", "Обертання до відсіку " + String(target));
}

// ── Команди від веб-інтерфейсу ───────────────────────────────────────────────
void handleCommands() {
    if (WiFi.status() != WL_CONNECTED || deviceToken == "" || !rfidAuthenticated) return;

    WiFiClient client; HTTPClient http;
    http.begin(client, String(API_BASE) + "/commands");
    http.addHeader("Authorization", "Bearer " + deviceToken);

    int code = http.GET();
    if (code != 200) { http.end(); return; }

    String response = http.getString();
    StaticJsonDocument<512> doc;
    deserializeJson(doc, response);

    bool executed = false;
    for (JsonObject cmd : doc.as<JsonArray>()) {
        if (executed) break;
        int    id      = cmd["id"];
        String command = cmd["command"];

        if (command == "rotate_to") {
            int comp = cmd["payload"]["compartment"];
            rotateToCompartment(comp);
            completeCommand(id);
            executed = true;

        } else if (command == "open_lid") {
            if (rfidAuthenticated) {
                showMsg("ЗАПОВНЕННЯ", "Відкрито");
                loadServo.write(0);
                isLidOpen = true;
            }
            completeCommand(id);
            executed = true;

        } else if (command == "close_lid") {
            showMsg("ГОТОВО", "Заповнення завершено");
            loadServo.write(90);
            isLidOpen         = false;
            rfidAuthenticated = false;
            sendRfidStatus(false);
            triggerBuzzer(); delay(200); triggerBuzzer();
            delay(2000);
            completeCommand(id);
            executed = true;
        }
    }
    http.end();
}

void completeCommand(int id) {
    WiFiClient client; HTTPClient http;
    http.begin(client, String(API_BASE) + "/commands/" + String(id) + "/done");
    http.addHeader("Authorization", "Bearer " + deviceToken);
    http.POST(""); http.end();
}

// ── RFID статус ───────────────────────────────────────────────────────────────
void sendRfidStatus(bool authenticated) {
    if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;
    WiFiClient client; HTTPClient http;
    http.begin(client, String(API_BASE) + "/rfid-status");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + deviceToken);

    StaticJsonDocument<100> doc;
    doc["authenticated"] = authenticated;
    String body; serializeJson(doc, body);
    http.POST(body); http.end();
}

// ── Алерт про пропущений прийом ───────────────────────────────────────────────
void sendWeightAlert(int prescriptionMedId) {
    if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;
    WiFiClient client; HTTPClient http;
    http.begin(client, String(API_BASE_NOTIFIC) + "/weight-alert");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + deviceToken);

    StaticJsonDocument<200> doc;
    doc["prescription_med_id"] = prescriptionMedId;
    doc["message"]             = "Пацієнт не забрав таблетки протягом відведеного часу";
    String body; serializeJson(doc, body);

    int code = http.POST(body);
    Serial.printf("WEIGHT ALERT: %d\n", code);

    if (code == 200) {
        logDeviceEvent("warning", "PILL_NOT_TAKEN",
            "Пацієнт не взяв таблетки, med_id=" + String(prescriptionMedId));
        showMsg("УВАГА!", "Таблетки не взято!");
        delay(2000);
    }
    http.end();
}

// ── Нагадування про прийом ────────────────────────────────────────────────────
void sendIntakeReminder(int prescriptionMedId) {
    if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;
    WiFiClient client; HTTPClient http;
    http.begin(client, String(API_BASE_NOTIFIC) + "/intake-reminder");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + deviceToken);

    StaticJsonDocument<200> doc;
    doc["prescription_med_id"] = prescriptionMedId;
    String body; serializeJson(doc, body);

    int code = http.POST(body);
    Serial.printf("INTAKE REMINDER: %d\n", code);
    http.end();
}

// ── Логування подій пристрою ──────────────────────────────────────────────────
void logDeviceEvent(String type, String code, String message) {
    if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;
    WiFiClient client; HTTPClient http;
    http.begin(client, String(API_BASE) + "/event");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + deviceToken);

    StaticJsonDocument<300> doc;
    doc["type"]    = type;
    doc["code"]    = code;
    doc["message"] = message;
    String body; serializeJson(doc, body);
    http.POST(body); http.end();
}

// ── Мелодія Бетховена "До Елізи" ─────────────────────────────────────────────
// detach/attach серво щоб tone() не конфліктував з PWM
void playBeethovenMelody() {
    // Від'єднуємо серво перед tone()
    loadServo.detach();
    unloadServo.detach();

    int melody[] = {
        // ── Головна тема ──────────────────────────────────────────────────────
        NOTE_E5, NOTE_DS5, NOTE_E5, NOTE_DS5, NOTE_E5, NOTE_B4, NOTE_D5, NOTE_C5, NOTE_A4,
        0,
        // ── Відповідь A ───────────────────────────────────────────────────────
        NOTE_C4, NOTE_E4, NOTE_A4, NOTE_B4,
        0,
        NOTE_E4, NOTE_GS4, NOTE_B4, NOTE_C5,
        0,
        // ── Повтор головної теми ──────────────────────────────────────────────
        NOTE_E5, NOTE_DS5, NOTE_E5, NOTE_DS5, NOTE_E5, NOTE_B4, NOTE_D5, NOTE_C5, NOTE_A4,
        0,
        NOTE_C4, NOTE_E4, NOTE_A4, NOTE_B4,
        0,
        NOTE_E4, NOTE_C5, NOTE_B4, NOTE_A4,
        0,
        // ── Розвиток ──────────────────────────────────────────────────────────
        NOTE_B4, NOTE_C5, NOTE_D5,
        NOTE_E5,
        NOTE_C5, NOTE_D5, NOTE_E5,
        NOTE_B4,
        NOTE_C5, NOTE_D5, NOTE_E5, NOTE_C5,
        NOTE_A4,
        0,
        // ── Заключна тема ─────────────────────────────────────────────────────
        NOTE_E5, NOTE_DS5, NOTE_E5, NOTE_DS5, NOTE_E5, NOTE_B4, NOTE_D5, NOTE_C5, NOTE_A4,
        0,
        NOTE_C4, NOTE_E4, NOTE_A4, NOTE_B4,
        0,
        NOTE_E4, NOTE_C5, NOTE_B4, NOTE_A4,
    };

    int noteDurations[] = {
        // Головна тема
        150, 150, 150, 150, 150, 150, 150, 150, 400,
        100,
        // Відповідь A
        150, 150, 150, 400,
        100,
        150, 150, 150, 400,
        100,
        // Повтор головної теми
        150, 150, 150, 150, 150, 150, 150, 150, 400,
        100,
        150, 150, 150, 400,
        100,
        150, 150, 150, 600,
        150,
        // Розвиток
        150, 150, 150,
        300,
        150, 150, 150,
        300,
        150, 150, 150, 150,
        400,
        200,
        // Заключна тема
        150, 150, 150, 150, 150, 150, 150, 150, 400,
        100,
        150, 150, 150, 400,
        100,
        150, 150, 150, 700,
    };

    int numNotes = sizeof(melody) / sizeof(melody[0]);

    for (int i = 0; i < numNotes; i++) {
        if (melody[i] == 0) {
            noTone(BUZZER_PIN);
            delay(noteDurations[i]);
        } else {
            tone(BUZZER_PIN, melody[i], noteDurations[i]);
            delay((int)(noteDurations[i] * 1.25));
            noTone(BUZZER_PIN);
        }
    }

    noTone(BUZZER_PIN);

    // Підключаємо серво назад в закриті позиції
    loadServo.attach(25);
    loadServo.write(90);
    unloadServo.attach(26);
    unloadServo.write(83);
}