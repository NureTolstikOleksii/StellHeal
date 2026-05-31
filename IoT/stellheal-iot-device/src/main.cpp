#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ThreeWire.h>  
#include <RtcDS1302.h>
#include <Adafruit_SSD1306.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <Stepper.h>
#include <HX711.h>
#include "time.h"

// Піни
#define BUTTON_PIN 0
#define BUZZER_LED 15
#define RST_PIN 4
#define SS_PIN 5
#define HALL_SENSOR_PIN 34
#define LOADCELL_DT 32
#define LOADCELL_SCK 33


Stepper drum(2048, 13, 12, 14, 27);
ThreeWire myWire(16, 17, 2);  
RtcDS1302<ThreeWire> Rtc(myWire);
Adafruit_SSD1306 display(128, 64, &Wire, -1);
MFRC522 rfid(SS_PIN, RST_PIN);
Servo loadServo;
Servo unloadServo;
HX711 scale;
float calibration_factor = -7050.0; 


const int COMPARTMENT_STEPS[9] = {
    0,    // [0] — не використовується
    0,    // [1] — відсік 1, позиція датчика Холла
    256,  // [2] — підберіть вручну
    512,  // [3]
    768,  // [4]
    1024, // [5]
    1280, // [6]
    1536, // [7]
    1792  // [8]
};

const char* API_BASE = "http://192.168.0.100:4200/api/device";
const char* API_BASE_NOTIFIC = "http://192.168.0.100:4200/api/notification";
const char* DEVICE_UID = "esp32_container_1";
const char* DEVICE_SECRET = "s3cr3t_container_1_2026";
int lastPrescriptionMedId = -1;


String deviceToken = "";
int containerId = 0;
int currentCompartment = 1; // де ми зараз (0–7)
const int STEPS_PER_COMPARTMENT = 256;
int lastOpenedCompartment = -1;

String nextIntakeTime = "";
String nextIntakeMed = ""; // поки немає назви в відповіді
int nextIntakeComp = 0;

unsigned long buttonPressStart = 0;
bool rfidAuthenticated = false;
bool isLidOpen = false;

// Змінні для керування інтервалом синхронізації
unsigned long lastSyncMillis = 0;
const unsigned long SYNC_INTERVAL = 7UL * 24 * 60 * 60 * 1000; // 1 тиждень

bool weightMonitoring = false;      // чи відстежуємо зараз
unsigned long weightMonitorStart = 0; // коли почали
float weightAtStart = 0.0;          // вага на початку
const unsigned long WEIGHT_MONITOR_DURATION = 1  * 60 * 1000; // 5 хвилин
const float WEIGHT_THRESHOLD = 1.0; // мінімальна зміна ваги (грами)
bool alertSent = false;  



// Оголошення функцій
void showMsg(String l1, String l2);
void showMsg(String l1, String l2, String l3);
void syncRtcWithNtp();
void displayClock();
void checkRFID();
void handleButtonLogic();
void toggleLoadingMode();
void triggerBuzzer();
void shutdownDevice();

// ДОДАЙ ЦЕ
void authenticateDevice();
void sendHeartbeat();
bool checkNextIntake();
void confirmIntake(int prescriptionMedId);
void rotateToCompartment(int target);
void completeCommand(int id);
void handleCommands();
void sendRfidStatus(bool authenticated);
void sendWeightAlert(int prescriptionMedId);
void logDeviceEvent(String type, String code, String message);
void playIntakeMelody();
void sendIntakeReminder(int prescriptionMedId);

void setup() {
  Serial.begin(115200);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_LED, OUTPUT);
  pinMode(HALL_SENSOR_PIN, INPUT);
  
  loadServo.attach(25);
  loadServo.write(90);
  unloadServo.attach(26);
  unloadServo.write(83);
  
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  
  drum.setSpeed(8); // повільніше для калібрування
  showMsg("STELLHEAL", "Calibration...");

  drum.step(50); // відступаємо від датчика
  delay(100);

  int hallStableCount = 0;
  while (hallStableCount < 5) {
      drum.step(1);
      delay(3);
      if (digitalRead(HALL_SENSOR_PIN) == LOW) {
          hallStableCount++;
      } else {
          hallStableCount = 0;
      }
  }

  drum.setSpeed(10);
  currentCompartment = 1;
  Serial.println("HOME POSITION SET");

  scale.begin(LOADCELL_DT, LOADCELL_SCK);
  scale.set_scale(calibration_factor);
  scale.tare();
  Serial.println("Scale ready");

  WiFiManager wm;
  showMsg("WIFI CONNECTING", "Connect to", "StellHeal_Setup");
  if(!wm.autoConnect("StellHeal_Setup")) {
    ESP.restart();
  }
  
  // Початкова синхронізація
  syncRtcWithNtp();
  lastSyncMillis = millis();

  SPI.begin();
  rfid.PCD_Init();
  Rtc.Begin();
  showMsg("AUTHENTIFICATION", "Device Authentication...");
  authenticateDevice();

  showMsg("SYSTEM READY", "Setup finished");
  delay(2000);

}

void loop() {
  
  static unsigned long lastAuthTry = 0;

  if (deviceToken == "" && millis() - lastAuthTry > 5000) {
    Serial.println("Retry auth...");
    authenticateDevice();
    lastAuthTry = millis();
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost → reconnecting...");
    WiFi.reconnect();
  }
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 60000) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }

  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 10000) {
    checkNextIntake();
    lastCheck = millis();
  }

  static unsigned long lastCommands = 0;
  if (millis() - lastCommands > 3000) { // кожні 3 секунди
      handleCommands();
      lastCommands = millis();
  }
  // Перевірка часу для щотижневої синхронізації
  if (millis() - lastSyncMillis > SYNC_INTERVAL) {
    if (WiFi.status() == WL_CONNECTED) {
       syncRtcWithNtp();
       lastSyncMillis = millis();
    }
  }

  // Моніторинг ваги після вивантаження
  if (weightMonitoring) {
      float currentWeight = scale.get_units(3);
      float weightDiff = weightAtStart - currentWeight;
      
      Serial.printf("Weight: %.2f g, diff: %.2f g\n", currentWeight, weightDiff);

      if (weightDiff >= WEIGHT_THRESHOLD) {
          // Вага зменшилась — пацієнт забрав таблетки
          Serial.println("Pills taken ✅");
          weightMonitoring = false;
          alertSent = false;
          showMsg("GOOD!", "Pills taken");
          delay(1000);

      } else if (millis() - weightMonitorStart > WEIGHT_MONITOR_DURATION && !alertSent) {
          Serial.println("Pills NOT taken! Sending alert...");
          sendWeightAlert(lastPrescriptionMedId); // ← правильний id
          alertSent = true;
          weightMonitoring = false;
      }
  }

  if (!rfidAuthenticated) {
    displayClock();
    checkRFID();        
  } else {
    handleButtonLogic(); 
  }
}

void syncRtcWithNtp() {
  showMsg("Syncing", "Time...");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  setenv("TZ", "EET-2EEST,M3.5.0/3,M10.5.0/4", 1);
  tzset();

  struct tm timeinfo;
  int retry = 0;

  while (!getLocalTime(&timeinfo) && retry < 15) {
    delay(500);
    retry++;
  }

  if (retry < 15) {
    Serial.println(&timeinfo, "%Y-%m-%d %H:%M:%S");

    Rtc.SetDateTime(RtcDateTime(
      timeinfo.tm_year + 1900,
      timeinfo.tm_mon + 1,
      timeinfo.tm_mday,
      timeinfo.tm_hour,
      timeinfo.tm_min,
      timeinfo.tm_sec
    ));
  } else {
    showMsg("Time error", "NTP failed");
  }
}

void displayClock() {
  static unsigned long lastDisplayUpdate = 0;
  if (millis() - lastDisplayUpdate < 1000) return;
  lastDisplayUpdate = millis();

  RtcDateTime now = Rtc.GetDateTime();

  display.clearDisplay();
  display.setTextColor(WHITE);

  if (nextIntakeTime != "") {
    // Режим з наступним прийомом — все розміром 1
    
    // Поточний час — розмір 2
    display.setTextSize(2);
    display.setCursor(25, 0);
    display.printf("%02d:%02d", now.Hour(), now.Minute());

    // Назва препарату
    display.setTextSize(1);
    display.setCursor(0, 20);
    display.print("Med: ");
    display.print(nextIntakeMed.substring(0, 12));

    // Час прийому
    display.setCursor(0, 32);
    display.print("At:  ");
    display.print(nextIntakeTime);
    display.print(" comp.");
    display.print(nextIntakeComp);

    // Відлік
    int nowMinutes = now.Hour() * 60 + now.Minute();
    int intakeHour = nextIntakeTime.substring(0, 2).toInt();
    int intakeMin = nextIntakeTime.substring(3, 5).toInt();
    int intakeMinutes = intakeHour * 60 + intakeMin;
    int diff = intakeMinutes - nowMinutes;
    if (diff < 0) diff += 24 * 60;
    int diffH = diff / 60;
    int diffM = diff % 60;

    display.setCursor(0, 44);
    display.print("In:  ");
    if (diffH > 0) {
      display.print(diffH);
      display.print("h ");
    }
    display.print(diffM);
    display.print(" min");

    // Розділювач
    display.drawLine(0, 17, 128, 17, WHITE);

  } else {
    // Немає прийомів — великий годинник
    display.setTextSize(3);
    display.setCursor(20, 20);
    display.printf("%02d:%02d", now.Hour(), now.Minute());

    display.setTextSize(1);
    display.setCursor(20, 52);
    display.print("No intakes today");
  }

  display.display();
}

void checkRFID() {
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    rfidAuthenticated = true;
    triggerBuzzer();
    showMsg("AUTH OK", "Button Active");
    sendRfidStatus(true);
    logDeviceEvent("info", "RFID_AUTH", "Nurse authenticated via RFID"); // ← додайте
    delay(1000);
  }
}

void handleButtonLogic() {
  static bool buzzerTriggered = false;
  if (digitalRead(BUTTON_PIN) == LOW) {
    if (buttonPressStart == 0) buttonPressStart = millis();
    unsigned long duration = millis() - buttonPressStart;
    
    if (duration >= 10000) {
      if (!buzzerTriggered) { triggerBuzzer(); buzzerTriggered = true; }
      showMsg("ACTION:", "RELEASE TO OFF");
    }
    else if (duration >= 5000) {
      if (!buzzerTriggered) { triggerBuzzer(); buzzerTriggered = true; }
      showMsg("ACTION:", "RESET WIFI");
    }
  } else {
    if (buttonPressStart > 0) {
      unsigned long finalDuration = millis() - buttonPressStart;
      buttonPressStart = 0;
      buzzerTriggered = false;
      
      if (finalDuration >= 10000) {
        shutdownDevice();
      } else if (finalDuration >= 5000) {
        showMsg("RESET", "WiFi...");
        WiFiManager wm; wm.resetSettings(); ESP.restart();
      } else if (finalDuration > 50 && finalDuration < 3000) {
        toggleLoadingMode();
      }
    }
  }
}

void toggleLoadingMode() {
  if (!isLidOpen) {
    showMsg("FILLING", "Fill compartment");
    loadServo.write(0);
    isLidOpen = true;
  } else {
    showMsg("EXIT", "Closing...");
    loadServo.write(90);
    isLidOpen = false;
    delay(1000);
    rfidAuthenticated = false;
  }
}

void triggerBuzzer() {
  digitalWrite(BUZZER_LED, HIGH);
  delay(200);
  digitalWrite(BUZZER_LED, LOW);
}

void showMsg(String l1, String l2) {
  showMsg(l1, l2, "");
}

void showMsg(String l1, String l2, String l3) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setCursor(0, 0);
  display.println(l1);
  
  display.setCursor(0, 20);
  display.setTextSize(2);
  display.println(l2);
  
  if (l3 != "") {
    display.setCursor(0, 50);
    display.setTextSize(1);
    display.println(l3);
  }
  display.display();
}

void shutdownDevice() {
  showMsg("SHUTDOWN", "Sleeping...");
  delay(800);

  // 1. Вимкнути дисплей
  display.clearDisplay();
  display.display();
  display.ssd1306_command(SSD1306_DISPLAYOFF);

  // 2. Вимкнути бузер
  digitalWrite(BUZZER_LED, LOW);

  // 3. Перевести піни в безпечний стан (мінімум споживання)
  pinMode(BUZZER_LED, INPUT);
  pinMode(BUTTON_PIN, INPUT);


  // 4. Невелика затримка перед сном
  delay(200);

  // 5. Налаштування пробудження (по кнопці)
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_0, 0);

  // 6. Сон
  esp_deep_sleep_start();
}


// авторизація пристрою 
void authenticateDevice() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  
  HTTPClient http;
  http.begin(client, String(API_BASE) + "/auth");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["device_uid"] = DEVICE_UID;
  doc["secret"] = DEVICE_SECRET;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);

  Serial.printf("AUTH CODE: %d\n", code);

  if (code > 0) {
    String response = http.getString();
    Serial.println(response);

    if (code == 200) {
      StaticJsonDocument<300> res;
      deserializeJson(res, response);

      deviceToken = res["token"].as<String>();
      containerId = res["containerId"];

      Serial.println("Device authenticated");
    }
  } else {
    Serial.println("HTTP ERROR");
  }

  http.end();
}

// ввімкнення пристрою
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;

  WiFiClient client;
  HTTPClient http;
  http.begin(client, String(API_BASE) + "/heartbeat");
  http.addHeader("Authorization", "Bearer " + deviceToken);

  int code = http.POST("");
  Serial.printf("HEARTBEAT CODE: %d\n", code);

  http.end();
}

// отриманння наступного прийому
bool checkNextIntake() {
  if (WiFi.status() != WL_CONNECTED || deviceToken == "") return false;

  WiFiClient client;
  HTTPClient http;
  http.begin(client, String(API_BASE) + "/next-intake");
  http.addHeader("Authorization", "Bearer " + deviceToken);

  int code = http.GET();
  Serial.printf("NEXT INTAKE CODE: %d\n", code);

  if (code == 200) {
    String response = http.getString();
    Serial.println(response);

    StaticJsonDocument<400> doc;
    DeserializationError error = deserializeJson(doc, response);
    if (error) {
      Serial.println("JSON parse error");
      http.end();
      return false;
    }

    if (doc.containsKey("message")) {
        Serial.println("No pending intakes");
        nextIntakeTime = "";
        nextIntakeComp = 0;
        nextIntakeMed = ""; // ← просто очищаємо
        http.end();
        return false;
    }
    
    if (doc.containsKey("medication_name")) {
        nextIntakeMed = doc["medication_name"].as<String>();
    } else {
        nextIntakeMed = "Unknown";
    }

    if (!doc.containsKey("intake_time") || !doc.containsKey("compartment_number")) {
      Serial.println("Invalid response fields");
      http.end();
      return false;
    }

    int prescriptionMedId = doc["prescription_med_id"];
    nextIntakeComp = doc["compartment_number"];

    String intakeTimeFull = doc["intake_time"].as<String>();
    nextIntakeTime = intakeTimeFull.substring(11, 16); // "23:30"

    Serial.printf("Next intake: %s, comp: %d\n", nextIntakeTime.c_str(), nextIntakeComp);

    RtcDateTime now = Rtc.GetDateTime();
    char currentTime[6];
    sprintf(currentTime, "%02d:%02d", now.Hour(), now.Minute());

    Serial.printf("Current time: %s\n", currentTime);

    if (nextIntakeTime == String(currentTime)) {
      if (nextIntakeComp != lastOpenedCompartment) {
        Serial.println("TIME MATCH → OPENING COMPARTMENT");

        lastPrescriptionMedId = prescriptionMedId;
        rotateToCompartment(nextIntakeComp);

        unloadServo.write(20);
        delay(3000);
        unloadServo.write(83);

        playIntakeMelody(); // ← замість triggerBuzzer()
        lastOpenedCompartment = nextIntakeComp;
        confirmIntake(prescriptionMedId);
        sendIntakeReminder(prescriptionMedId);
        
        weightAtStart = scale.get_units(5);
        weightMonitorStart = millis();
        weightMonitoring = true;
        alertSent = false;
        Serial.printf("Weight monitoring started, initial: %.2f g\n", weightAtStart);
      }
    }

    http.end();
    return true;
  }

  http.end();
  return false;
}

// підтвердження прийому
void confirmIntake(int prescriptionMedId) {
  if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;

  WiFiClient client;
  HTTPClient http;
  http.begin(client, String(API_BASE) + "/intake");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + deviceToken);

  StaticJsonDocument<200> doc;
  doc["prescription_med_id"] = prescriptionMedId; // ← було compartmentId

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("CONFIRM INTAKE CODE: %d\n", code);

  if (code == 200) {
    Serial.println("Intake confirmed");
  }

  http.end();
}

void rotateToCompartment(int target) {
  if (target < 1 || target > 8) return;
  if (target == currentCompartment) return;

  Serial.println("Returning to HOME...");
  
  drum.step(20);
  delay(50);
  
  int hallStableCount = 0;
  int steps = 0;
  while (hallStableCount < 5 && steps < 2500) {
    drum.step(1);
    delay(2);
    steps++;
    if (digitalRead(HALL_SENSOR_PIN) == LOW) {
        hallStableCount++;
    } else {
        hallStableCount = 0;
    }
  }

  // ← Логуємо помилку якщо датчик не знайдено
  if (steps >= 2500) {
    Serial.println("Hall sensor not found!");
    logDeviceEvent("error", "MOTOR_ERROR", "Hall sensor not found during calibration");
    return; // ← виходимо щоб не крутити далі з неправильної позиції
  }
  
  currentCompartment = 1;

  if (target == 1) return;

  int stepsToMove = COMPARTMENT_STEPS[target];
  Serial.printf("Moving to compartment %d (%d steps)\n", target, stepsToMove);

  drum.step(stepsToMove);
  currentCompartment = target;

  // ← Логуємо успішну прокрутку
  logDeviceEvent("info", "MOTOR_OK", "Rotated to compartment " + String(target));
}

// отримання та обробка команд
void handleCommands() {
  if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;
  if (!rfidAuthenticated) return;

  WiFiClient client;
  HTTPClient http;
  http.begin(client, String(API_BASE) + "/commands");
  http.addHeader("Authorization", "Bearer " + deviceToken);

  int code = http.GET();

  if (code == 200) {
    String response = http.getString();

    StaticJsonDocument<512> doc;
    deserializeJson(doc, response);

    bool executed = false;

    for (JsonObject cmd : doc.as<JsonArray>()) {
      if (executed) break;

      int id = cmd["id"];
      String command = cmd["command"];

      if (command == "rotate_to") {
        int comp = cmd["payload"]["compartment"];

        // ← ПРИБРАТИ рекалібрування звідси, воно вже в rotateToCompartment
        rotateToCompartment(comp);
        completeCommand(id);
        executed = true;

      } else if (command == "open_lid") {
        if (rfidAuthenticated) {
          showMsg("FILLING", "Fill compartment");
          loadServo.write(0);
          isLidOpen = true;
        }
        completeCommand(id);
        executed = true;

      } else if (command == "close_lid") {
        showMsg("DONE", "Filling complete!");
        loadServo.write(90);
        isLidOpen = false;
        rfidAuthenticated = false;
        sendRfidStatus(false);
        triggerBuzzer();
        delay(200);
        triggerBuzzer();
        delay(2000);
        completeCommand(id);
        executed = true;
      }
    }
  }

  http.end();
}

// завершення заповнення
void completeCommand(int id) {
  WiFiClient client;
  HTTPClient http;

  http.begin(client, String(API_BASE) + "/commands/" + String(id) + "/done");
  http.addHeader("Authorization", "Bearer " + deviceToken);

  http.POST("");
  http.end();
}

// розблокування для заповнення
void sendRfidStatus(bool authenticated) {
  if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;

  WiFiClient client;
  HTTPClient http;
  http.begin(client, String(API_BASE) + "/rfid-status");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + deviceToken);

  StaticJsonDocument<100> doc;
  doc["authenticated"] = authenticated;

  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}

// відправленння сповіщення про пропуск
void sendWeightAlert(int prescriptionMedId) {
  if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;

  WiFiClient client;
  HTTPClient http;
  http.begin(client, String(API_BASE_NOTIFIC) + "/weight-alert");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + deviceToken);

  StaticJsonDocument<200> doc;
  doc["prescription_med_id"] = prescriptionMedId;
  doc["message"] = "Пацієнт не забрав таблетки протягом 5 хвилин";

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("WEIGHT ALERT CODE: %d\n", code);

  if (code == 200) {
      Serial.println("Weight alert sent!");
      logDeviceEvent("warning", "PILL_NOT_TAKEN", "Patient did not take pills");
      showMsg("ALERT!", "Take pills!");
      delay(2000);
  }

  http.end();
}

void logDeviceEvent(String type, String code, String message) {
  if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;

  WiFiClient client;
  HTTPClient http;
  http.begin(client, String(API_BASE) + "/event");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + deviceToken);

  StaticJsonDocument<300> doc;
  doc["type"] = type;
  doc["code"] = code;
  doc["message"] = message;

  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}

void playIntakeMelody() {
    // Три зростаючих сигнали
    for (int i = 0; i < 3; i++) {
        digitalWrite(BUZZER_LED, HIGH);
        delay(100 + i * 100); // 100, 200, 300 мс
        digitalWrite(BUZZER_LED, LOW);
        delay(100);
    }
    // Довгий фінальний сигнал
    digitalWrite(BUZZER_LED, HIGH);
    delay(600);
    digitalWrite(BUZZER_LED, LOW);
}

void sendIntakeReminder(int prescriptionMedId) {
    if (WiFi.status() != WL_CONNECTED || deviceToken == "") return;

    WiFiClient client;
    HTTPClient http;
    http.begin(client, String(API_BASE_NOTIFIC) + "/intake-reminder");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + deviceToken);

    StaticJsonDocument<200> doc;
    doc["prescription_med_id"] = prescriptionMedId;

    String body;
    serializeJson(doc, body);

    int code = http.POST(body);
    Serial.printf("INTAKE REMINDER CODE: %d\n", code);

    http.end();
}