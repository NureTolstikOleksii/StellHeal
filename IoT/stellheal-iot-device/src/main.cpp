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
#include "time.h"

// Піни
#define BUTTON_PIN 0
#define BUZZER_LED 15
#define RST_PIN 4
#define SS_PIN 5
#define HALL_SENSOR_PIN 34

Stepper drum(2048, 13, 12, 14, 27);
ThreeWire myWire(16, 17, 2);  
RtcDS1302<ThreeWire> Rtc(myWire);
Adafruit_SSD1306 display(128, 64, &Wire, -1);
MFRC522 rfid(SS_PIN, RST_PIN);
Servo loadServo;

unsigned long buttonPressStart = 0;
bool rfidAuthenticated = false;
bool isLidOpen = false;

// Змінні для керування інтервалом синхронізації
unsigned long lastSyncMillis = 0;
const unsigned long SYNC_INTERVAL = 7UL * 24 * 60 * 60 * 1000; // 1 тиждень

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

void setup() {
  Serial.begin(115200);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_LED, OUTPUT);
  pinMode(HALL_SENSOR_PIN, INPUT);
  
  loadServo.attach(25);
  loadServo.write(90);
  drum.setSpeed(10);
  
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  
  showMsg("STELLHEAL", "Calibration...");
  while(digitalRead(HALL_SENSOR_PIN) == HIGH) { 
    drum.step(1); delay(2); 
  }

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
  
  showMsg("SYSTEM READY", "Setup finished");
  delay(2000);
}

void loop() {
  // Перевірка часу для щотижневої синхронізації
  if (millis() - lastSyncMillis > SYNC_INTERVAL) {
    if (WiFi.status() == WL_CONNECTED) {
       syncRtcWithNtp();
       lastSyncMillis = millis();
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
  display.setCursor(20, 20);
  display.setTextSize(3);
  display.setTextColor(WHITE);
  
  display.printf("%02d:%02d", now.Hour(), now.Minute());
  display.display();
}

void checkRFID() {
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    rfidAuthenticated = true;
    triggerBuzzer();
    showMsg("AUTH OK", "Button Active");
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

