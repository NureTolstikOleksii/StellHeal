from machine import Pin, I2C, PWM
import ssd1306
import ujson 
import urequests
import network
import time
import utime
import ntptime

BASE_URL = "https://healthyhelperback.onrender.com"

# іd контейнеру
container_id = 1

# Прапори для стану пристрою
device_on = False
wifi_connected = False
time_synced = False
taken = False
med_schedule = []
inventory_info = []
patient_id = 0
servo_number = 0
id_inventory = 0

# Ініціалізація OLED-дисплея
i2c = I2C(0, scl=Pin(22), sda=Pin(21))
oled_width = 128
oled_height = 64
oled = ssd1306.SSD1306_I2C(oled_width, oled_height, i2c)

# Ініціалізація сервоприводу, кнопки, лампочки, спікеру і сенсору
servo1 = PWM(Pin(15), freq=50)
servo2 = PWM(Pin(2), freq=50)
servo3 = PWM(Pin(0), freq=50)
servo4 = PWM(Pin(4), freq=50)
servo5 = PWM(Pin(16), freq=50)
servo6 = PWM(Pin(17), freq=50)
servo7 = PWM(Pin(26), freq=50)
servo8 = PWM(Pin(14), freq=50)
servo9 = PWM(Pin(27), freq=50)
button = Pin(18, Pin.IN, Pin.PULL_UP)
led = Pin(19, Pin.OUT)
buzzer = PWM(Pin(12)) 
buzzer.duty_u16(0)
sensor = Pin(13, Pin.IN)

# Функція підключення до Wi-Fi
def wifi_connect():
    global wifi_connected
    sta_if = network.WLAN(network.STA_IF)
    if not sta_if.isconnected():
        display_message("Connecting to WiFi")
        sta_if.active(True)
        sta_if.connect('Wokwi-GUEST', '')
        timeout = 15
        while not sta_if.isconnected() and timeout > 0:
            display_message(f"Connecting... {20 - timeout}s")
            time.sleep(1)
            timeout -= 1
    if sta_if.isconnected():
        display_message("WiFi Connected!")
        wifi_connected = True
    else:
        display_message("WiFi Failed")

# Функція базера
def buzz_on(frequency=1000, duration=1, repeats=3):
    for _ in range(repeats):
        buzzer.freq(frequency)
        buzzer.duty_u16(32768)   # Встановлюємо середню гучність (32768 = 50% від 65535)
        time.sleep(duration)
        buzzer.duty_u16(0)
        time.sleep(0.5)    

# Функція для керування сервоприводом
def move_servo(servo_number, angle):
    duty = int((angle / 180) * 102 + 26)
    if servo_number == 1:
        servo1.duty(duty)
    elif servo_number == 2:
        servo2.duty(duty)
    elif servo_number == 3:
        servo3.duty(duty)
    elif servo_number == 4:
        servo4.duty(duty)
    elif servo_number == 5:
        servo5.duty(duty)
    elif servo_number == 6:
        servo6.duty(duty)
    elif servo_number == 7:
        servo7.duty(duty)    
    elif servo_number == 8:
        servo8.duty(duty)
    elif servo_number == 9:
        servo9.duty(duty)
    else:
        print(f"Error: Invalid servo_number {servo_number}.")

def display_message(line1="", line2="", line3="", line4=""):
    oled.fill(0)
    if line1:
        oled.text(line1, 0, 0)
    if line2:
        oled.text(line2, 0, 14)
    if line3:
        oled.text(line3, 0, 28)
    if line4:
        oled.text(line4, 0, 42)
    oled.show()

# Функція синхронізації часу
def sync_time():
    global time_synced
    try:
        display_message("Syncing time...")
        ntptime.settime()
        time_synced = True
        display_message("Time synced!")
    except Exception as e:
        display_message("Time sync failed!")

# Функція для оновлення екрану з часом
def update_display(medication):
    if med_schedule and len(med_schedule) >= 3:
        time_left = calculate_remaining_time(med_schedule[2])
        intake_time = med_schedule[2]
        compartment = med_schedule[3] 

        if medication and time_left != "0h 0m":
            display_message(f"Next: {medication}", f"At: {intake_time}", f"In: {time_left}", f"Comp: {compartment}")
        elif medication and time_left == "0h 0m":
            display_message(f"Take {medication}", "Now!")
        else:
            display_message("No meds", "for today")
    else:
        display_message("No medications", "for today!")

# Підрахунок часу що залишився
def calculate_remaining_time(target_time_str, timezone_offset=3):
    current_epoch = time.time() + timezone_offset * 3600
    current_time = time.localtime(current_epoch)

    current_hours = current_time[3]
    current_minutes = current_time[4]
    current_seconds = current_time[5]

    # Розбиваємо цільовий час
    target_hours, target_minutes = map(int, target_time_str.split(":"))

    # Обчислюємо час у секундах
    current_total_seconds = current_hours * 3600 + current_minutes * 60 + current_seconds
    target_total_seconds = target_hours * 3600 + target_minutes * 60

    remaining_seconds = target_total_seconds - current_total_seconds

    if remaining_seconds < 0:
        remaining_seconds += 24 * 3600

    hours = remaining_seconds // 3600
    minutes = (remaining_seconds % 3600) // 60
    seconds = remaining_seconds % 60

    return f"{hours}h {minutes}m {seconds}s"


""" Зв язок з Back-end частиною """

# отримання пацієнта за контейнером
def fetch_patient_id(container_id):
    url = f"{BASE_URL}/containers/{container_id}/getPatientId"
    try:
        print(">>> Fetching patient ID...")
        response = urequests.get(url)
        response_data = ujson.loads(response.content.decode('utf-8'))
        response.close()

        if "id_patient" in response_data:
            return response_data["id_patient"]
        else:
            display_message("No patient found for this container")
            print("!!! No patient found for this container")
            return None
    except Exception as e:
        print("!!! Failed to fetch patient ID:", e)
        return None

# оновлення статусу контейнера
def send_container_status(status, container_id):
    url = f"{BASE_URL}/containers/update-status"
    payload = {
        "containerId": container_id,
        "status": status
    }
    headers = {"Content-Type": "application/json"}

    try:
        print(f">>> Sending container status: {status}")
        response = urequests.post(url, json=payload, headers=headers)
        response.close()
    except Exception as e:
        print("!!! Failed to send status update:", e)

# отримання наступного прийому
def fetch_next_intake(container_id):
    global med_schedule
    url = f"{BASE_URL}/containers/next-intake"
    payload = { "containerId": container_id }
    headers = {"Content-Type": "application/json"}

    try:
        print(">>> Getting the next assignment...")
        response = urequests.post(url, json=payload, headers=headers)

        if response.status_code != 200:
            print("!!! Error:", response.status_code)
            med_schedule.clear()
            return

        data = ujson.loads(response.content.decode('utf-8'))
        response.close()

        if "message" in data:
            print(">>> No upcoming appointments!")
            med_schedule.clear()
            return

        intake_iso = data.get('intake_time')
        if not intake_iso:
            print("intake_time not found!")
            med_schedule.clear()
            return

        year = int(intake_iso[0:4])
        month = int(intake_iso[5:7])
        day = int(intake_iso[8:10])
        hour = int(intake_iso[11:13])
        minute = int(intake_iso[14:16])

        comp_time = time.mktime((year, month, day, hour, minute, 0, 0, 0))

        current_time = time.time()
        if comp_time < current_time:
            print("The reception time has already passed!")
            med_schedule.clear()
            return

        med_schedule[:] = [
            data["prescription_med_id"],
            data["medication"],
            f"{hour:02d}:{minute:02d}",
            data["compartment_number"],
            data["compartment_id"]
        ]

        print(f">>> Next appointment: ID={med_schedule[0]}, Name={med_schedule[1]}, Time={med_schedule[2]}, Compartment={med_schedule[3]}, Compartment_id={med_schedule[4]}" )

    except Exception as e:
        print("!!! Error:", e)
        med_schedule.clear()

# оновленння статусу прийняття
def update_intake_status(prescription_med_id, status):
    try:
        url = f"{BASE_URL}/containers/update-intake"
        headers = {"Content-Type": "application/json"}
        payload = ujson.dumps({
            "prescription_med_id": prescription_med_id,
            "status": status
        })
        response = urequests.patch(url, data=payload, headers=headers)
        if response.status_code == 200:
            print(">>> Reception status updated successfully")
        else:
            print("!!! Update error:", response.status_code, response.text)

        response.close()
    except Exception as e:
        print("!!! Exception while updating status:", e)

# відправити повідомлення про пропуск дози
def send_notification(container_id, prescription_med_id):
    try:
        url = f"{BASE_URL}/containers/send-missed-notification"
        headers = {"Content-Type": "application/json"}
        payload = {
            "container_id": container_id,
            "prescription_med_id": prescription_med_id
        }

        response = urequests.post(url, headers=headers, data=ujson.dumps(payload))
        print(">>> Notification sent:", response.status_code)
        response.close()
    except Exception as e:
        print("!!! Failed to send notification:", e)

# відправити повідомлення про відкриття контейнера
def send_open_notification(container_id, prescription_med_id):
    try:
        url = f"{BASE_URL}/containers/send-open-notification"
        headers = {"Content-Type": "application/json"}
        payload = {
            "container_id": container_id,
            "prescription_med_id": prescription_med_id
        }

        response = urequests.post(url, headers=headers, data=ujson.dumps(payload))
        print(">>> Open notification sent:", response.status_code)
        response.close()
    except Exception as e:
        print("!!! Failed to send open notification:", e)

# очистити відсік
def clear_compartment(compartment_id):
    try:
        url = f"{BASE_URL}/containers/clear-compartment"
        headers = {"Content-Type": "application/json"}
        payload = {
            "compartment_id": compartment_id
        }

        response = urequests.post(url, headers=headers, data=ujson.dumps(payload))
        print(">>> Clear response:", response.status_code)
        response.close()
    except Exception as e:
        print("!!! Failed to clear compartment:", e)

# Основний цикл
while True:
    if button.value() == 0:
        if not device_on:  # Якщо пристрій вимкнено
            device_on = True
            led.value(1)
            display_message("Device ON...")
            time.sleep(3)
            wifi_connect()
            if wifi_connected:      
                sync_time()
                send_container_status("active", container_id)
                patient_id = fetch_patient_id(container_id)
                if patient_id:
                    fetch_next_intake(container_id)
                    if med_schedule:                          
                        display_message("Schedule loaded", f"Patient: {patient_id}")
                        time.sleep(2) 
                    else:
                        display_message("No fillings", "compartments")
                        time.sleep(2)
                else:
                    display_message("No patient", "found")
            else:
                display_message("No WiFi")
        else:  # Якщо пристрій увімкнено
            device_on = False
            led.value(0)
            send_container_status("unactive", container_id)
            display_message("Device OFF")
            time.sleep(2)
            display_message("")

    if device_on and wifi_connected and time_synced and med_schedule:
        time_left = calculate_remaining_time(med_schedule[2])
        medication = med_schedule[1]

        if time_left == "0h 0m 0s":
            display_message(f"Take {medication}", "Now!")
            buzz_on(repeats=3)
            move_servo(med_schedule[3], 0)
            send_open_notification(container_id, med_schedule[0])

            start_time = time.time()
            while sensor.value() == 0:
                display_message(f"Take {medication}", "Waiting...")
                time.sleep(0.1)

                # Якщо минуло більше 5 хвилин
                if time.time() - start_time > 60:
                    print(">>> 5 minutes passed. Sending missed dose notification.")
                    move_servo(med_schedule[3], 90)
                    send_notification(container_id, med_schedule[0])
                    update_intake_status(med_schedule[0], False)
                    fetch_next_intake(container_id)
                    if med_schedule:
                        display_message("Schedule loaded", f"Patient: {patient_id}")
                        time.sleep(2) 
                    else:
                        display_message("No fillings", "compartments")
                        time.sleep(2)
                    break

            # Перевіряємо, чи ліки справді взяті
            if sensor.value() == 1:
                display_message(f"{medication} taken!", "Thank you!")
                move_servo(med_schedule[3], 90)
                update_intake_status(med_schedule[0], True)
                clear_compartment(med_schedule[4])
                fetch_next_intake(container_id)
                if med_schedule:
                    display_message("Schedule loaded", f"Patient: {patient_id}")
                    time.sleep(2) 
                else:
                    display_message("No fillings", "compartments")
                    time.sleep(2)
        
        update_display(medication)
    else:
        time.sleep(0.1)
