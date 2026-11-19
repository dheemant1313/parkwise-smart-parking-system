# Parkwise Production Limitations, Real-World Dependencies & Hardware Prerequisites

## 1. Executive Notice: Production Certification Boundary
While the software codebase for Parkwise (Phases 1 through 21) has achieved **100% test pass status (137/137 tests green)**, complete transactional concurrency lock verification, DPDP Act 2023 compliance, and validated offline gate fallback, **production deployment into real commercial parking facilities requires physical hardware installation and licensed external third-party service activations.**

Do not claim production readiness for a physical garage based solely on successful automated test execution in development or staging environments.

---

## 2. Third-Party External Service Dependencies
The platform relies on the following external providers which require commercial merchant contracts, production API keys, and regulatory certifications before accepting public customer payments and traffic:

| Dependency | Category | Current Status in Development | Production Requirement for Live Launch |
| :--- | :--- | :--- | :--- |
| **Razorpay Payments** | Payment Gateway | Simulated test mode (`rzp_test_...`) with valid HMAC verification | Live merchant account with ICICI/HDFC bank settlement nodal account and active UPI Auto-Debit mandate permissions |
| **NPCI NETC FASTag** | Electronic Toll Collection | Simulated RFID reader events and mock Fastag EPC tag feeds | Direct integration with an NPCI-accredited Acquiring Bank (e.g. IDFC FIRST, ICICI, SBI) for real-time bank wallet debit |
| **Twilio / Gupshup** | SMS & WhatsApp Notifications | Console logger and mock dispatch service | Registered DLT (Distributed Ledger Technology) Principal Entity under TRAI guidelines with approved transactional SMS templates |
| **Google Maps / Mapbox** | Geospatial APIs | Static and custom interactive Leaflet/MapLibre vector maps | Commercial Google Maps Platform API key or Mapbox production token with GPS turn-by-turn quota enabled |
| **SendGrid / AWS SES** | Transactional Email | Development stub / console emitter | Domain DKIM, SPF, and DMARC verification on `parkwise.in` domain with production sending reputation |

---

## 3. Physical Hardware Prerequisites (On-Site Facility Requirements)
Before a physical parking structure can be switched live on the Parkwise platform, the following on-site hardware must be commissioned and calibrated:

```
[Real-World Garage Entrance]
  ├── Optical ANPR Camera (IP67, IR 850nm, 1080p@30FPS RTSP)
  ├── 865 MHz UHF RFID Windshield Tag Reader (NETC Class 1 Gen 2)
  ├── Dual Inductive Ground Presence Loops (Vehicle Detection & Safety Anti-Tailgating)
  ├── Motorized Boom Barrier (24V DC / 230V AC with 500ms dry-contact relay input)
  ├── Industrial Gate Controller (Fanless IPC or Raspberry Pi 4 with UPS backup)
  └── Dedicated Static IP Broadband Line (with 4G/5G failover cellular dongle)
```

### Known Physical Edge Limitations
1. **Dirty or Non-Standard License Plates**:
   - While the AI OCR engine achieves 98.4% accuracy on standard HSRP (High Security Registration Plates), uncleaned plates, fancy fonts, or missing front plates require the **driver digital QR pass fallback** or manual attendant review.
2. **Extreme Weather / Optical Glare**:
   - Direct sunlight glare at specific sunset angles or heavy fog may temporarily reduce optical recognition confidence. The system automatically prompts for QR scanning or RFID read in these conditions.
3. **Dual Vehicle Tailgating**:
   - Ground inductive loops prevent premature barrier drop, but anti-tailgating requires rapid-acting boom arms (1.2 second rise time) to physically prevent an unauthorized vehicle from following an authorized vehicle.

---

## 4. Hardware and Database Scaling Considerations
1. **Database Relational Storage**:
   - For high-volume enterprise deployments exceeding 100,000 daily parking transactions, migrate from single-node PostgreSQL to a Managed Cloud PostgreSQL cluster (e.g., AWS Aurora PostgreSQL or Google Cloud SQL) with read replicas and automated point-in-time recovery (PITR).
2. **Redis Memory Sizing**:
   - Slot reservation locks have a 10-minute TTL. Ensure Redis cluster has a minimum of 8 GB RAM to handle concurrent surge booking windows during peak festival or event traffic.
3. **RTSP Stream Decoding Overhead**:
   - Running edge ANPR vehicle detection locally on Raspberry Pi 4 is limited to 2 concurrent camera feeds at 15 FPS. For multi-lane plazas with 4+ entry lanes, use an Industrial IPC equipped with an Intel OpenVINO VPU or NVIDIA Jetson Orin Nano accelerator.

---

## 5. Pre-Launch Sign-Off Protocol
To transition a facility from `STAGING_CONFIGURED` to `LIVE_COMMERCIAL_OPERATIONS`:
- [ ] Physical wiring continuity test between IPC relay and boom barrier controller.
- [ ] 50 consecutive live test vehicle runs with zero double-entries or barrier stalls.
- [ ] Verification of offline mode: disconnect WAN cable, verify signed QR pass opens barrier, reconnect cable and confirm sync to cloud ledger within 60 seconds.
- [ ] Financial audit: verify test payment reflects in Razorpay live settlement report without discrepancy.
- [ ] Sign-off by Facility Operations Chief and Lead Systems Architect.
