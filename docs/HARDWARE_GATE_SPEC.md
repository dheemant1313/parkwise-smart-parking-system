# Parkwise Hardware Integration Specification (Boom Barrier & Gate Controller)

## 1. Hardware Architecture Overview
The Parkwise Edge Gate Controller operates on dedicated industrial hardware installed inside the entrance/exit toll booth enclosure.

```
+--------------------------------------------------------------------------------+
|                        PARKWISE INDUSTRIAL GATE CONTROLLER                     |
|                                                                                |
|  [RTSP ANPR Camera] ----(PoE RJ-45)----> [Industrial IPC / Raspberry Pi 4]     |
|  [Fastag UHF RFID]  ----(Wiegand/RS485)-> [Digital GPIO / Optocoupler Board]   |
|  [Inductive Loop]   ----(Dry Contact)--> [Relay Module (NO/NC 24V DC)]         |
|                                                  |                             |
|                                                  v                             |
|                                     [Boom Barrier Motor Controller]           |
+--------------------------------------------------------------------------------+
```

---

## 2. Recommended Controller Compute Hardware
| Component | Minimum Specification | Industrial Recommended |
| :--- | :--- | :--- |
| **Compute Board** | Raspberry Pi 4 Model B (4GB RAM) | Advantech UNO-2271G / IPC-610 Industrial IPC |
| **Processor** | Quad-core ARM Cortex-A72 @ 1.5GHz | Intel Celeron J1900 / Core i3 Fanless |
| **Operating System** | Ubuntu Server 22.04 LTS (64-bit) | Yocto Linux / Ubuntu Core Embedded |
| **Storage** | 32GB Class 10 High-Endurance MicroSD | 128GB M.2 SATA Industrial SSD (-20°C to 70°C) |
| **Network Interfaces** | Dual Gigabit Ethernet (1 LAN, 1 Camera) | Dual Intel i210 GbE PoE+ ports |
| **Power Supply** | 5V / 3A USB-C with UPS Battery Backup | 9-36V DC Wide Input with DIN-Rail Mount |

---

## 3. Barrier Relay Interface & GPIO Pinout
Control of the motorized boom barrier (Magnetic Autocontrol, FAAC, BFT, or Came) is executed via a 2-channel dry-contact relay module:

### Pinout Mapping (Raspberry Pi 4 Header)
- **Pin 2 (5V DC)** -> VCC (Relay Board)
- **Pin 6 (GND)** -> GND (Relay Board)
- **Pin 11 (GPIO 17)** -> Relay 1 IN (`BARRIER_OPEN` Trigger, 500ms pulsed contact)
- **Pin 13 (GPIO 27)** -> Relay 2 IN (`BARRIER_CLOSE_LOCK` Safety Override)
- **Pin 16 (GPIO 23)** -> Input 1 (`INDUCTIVE_LOOP_PRESENCE` Vehicle Detector)
- **Pin 18 (GPIO 24)** -> Input 2 (`ARM_POSITION_FEEDBACK` Limit Switch)

```python
# Standard GPIO Barrier Open Pulse Driver (app/gate/relay_driver.py)
import time
try:
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(17, GPIO.OUT, initial=GPIO.LOW)

    def trigger_barrier_open(pulse_duration_sec: float = 0.5):
        """Sends a momentary dry-contact closure pulse to the barrier logic board."""
        GPIO.output(17, GPIO.HIGH)
        time.sleep(pulse_duration_sec)
        GPIO.output(17, GPIO.LOW)
except ImportError:
    def trigger_barrier_open(pulse_duration_sec: float = 0.5):
        # Simulated edge environment fallback
        print(f"[EDGE RELAY SIM] Pulsed GPIO 17 HIGH for {pulse_duration_sec}s -> Barrier opened.")
```

---

## 4. Optical ANPR Camera Specifications
- **Sensor**: 1/2.8" Progressive Scan CMOS, minimum 2 Megapixels (1080p @ 30 FPS).
- **Illumination**: Integrated Infrared (850nm) + White Light LED array with Auto-Strobe.
- **Optics**: 2.8mm - 12mm Motorized Varifocal Lens with Auto-Focus.
- **Vehicle Speed**: Verified capture up to 40 km/h in entrance deceleration lane.
- **Protocols**: RTSP (`rtsp://username:password@camera_ip:554/stream1`), ONVIF Profile S/G.
- **Operating Temperature**: -30°C to +65°C, IP67 weatherproof enclosure.

---

## 5. UHF RFID Fastag Reader Specifications
- **Frequency**: EPC Class 1 Gen 2 / ISO 18000-6C (865 MHz - 867 MHz for India).
- **Antenna**: 9 dBi Circularly Polarized Directional Antenna.
- **Read Range**: 3 to 8 meters calibrated directly over windshield target area.
- **Interface**: RS-485 or TCP/IP direct socket outputting 24-character EPC tags.
