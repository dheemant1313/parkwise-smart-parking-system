# Parkwise Facility Operator Runbook & Incident Response Playbook

## 1. Daily Operations Checklist
Every facility supervisor and booth attendant must verify the following items at shift commencement (06:00, 14:00, 22:00):

| Step | Action | Tool / Screen | Expected Normal State |
| :--- | :--- | :--- | :--- |
| **1** | Verify Gate Controller Heartbeats | `/operator/launch` -> Gate Telemetry | Status: `OPERATIONAL_READY`, Latency `< 50ms` |
| **2** | Check ANPR Camera Video Feed | Gate Booth Monitor | Stream FPS `>= 25 FPS`, Optical Lens Clean |
| **3** | Review Unresolved Review Queue | `/gate/terminal` -> Manual Review | Zero pending ANPR mismatch tasks |
| **4** | Check Barrier Emergency Manual Release | Physical Boom Barrier Enclosure | Manual bypass key present and tested |
| **5** | Verify Offline Cache Synchronization | `/operator/launch` -> Sync Status | Last sync `< 5 minutes` ago |

---

## 2. Incident Response Playbooks

### Scenario A: Network Connectivity Loss (Offline Operation Mode)
- **Symptom**: Cloud connectivity drops; API latency flags `TIMEOUT`.
- **Automatic Fallback**:
  1. Gate Lane Controllers automatically transition to **Local SQLite Cached Mode**.
  2. Vehicles presenting valid, time-bounded HMAC-SHA256 signed QR passes are granted entry/exit immediately via offline cryptographic verification.
  3. Barrier opens within `< 800ms` without cloud roundtrip.
  4. Access events are stored in local SQLite journal with millisecond timestamps.
- **Operator Action**:
  - Keep lanes in standard automated flow.
  - Do NOT manually open barriers for untrusted vehicles without checking QR pass timestamp.
  - When network restores, the Gate Terminal will automatically drain the offline journal to cloud (`POST /api/v1/gate/sync-offline-events`).

---

### Scenario B: ANPR License Plate Misread / Damaged Number Plate
- **Symptom**: Vehicle arrives at entry lane; ANPR camera confidence score `< 85%` or unrecognized character.
- **Automatic Behavior**:
  1. Barrier remains safely closed.
  2. Gate terminal alerts booth operator with snapshot of vehicle front plate.
- **Operator Action**:
  1. Request driver to present the digital QR pass from their Parkwise mobile application.
  2. Scan QR pass on the booth barcode reader.
  3. If plate has muddy character, operator types correct plate into the Manual Verification task (`/gate/terminal`).
  4. System logs `MANUAL_OVERRIDE_AUTHORIZED` with operator ID and audit rationale.

---

### Scenario C: Overstay or Unpaid Exit Dispute
- **Symptom**: Driver attempts exit past booking end time or with unpaid additional surcharge.
- **Automatic Behavior**:
  1. Exit barrier denies exit with status `DENIED_UNPAID`.
  2. Gate terminal displays exact overstay duration and calculated surcharge.
- **Operator Action**:
  1. Instruct driver to tap "Pay Exit Fee" on their Parkwise mobile app (instant UPI / Fastag).
  2. Alternatively, collect cash/card at booth and issue manual receipt via `/operator/reconciliation`.
  3. Once payment reflects `CAPTURED`, exit barrier opens automatically.

---

### Scenario D: Boom Barrier Mechanical Jam or Power Failure
- **Symptom**: Relay triggers but barrier does not mechanically actuate.
- **Operator Action**:
  1. Insert mechanical cabinet key and disengage electro-magnetic clutch.
  2. Manually raise barrier arm to 90 degrees vertical and secure with safety pin.
  3. Switch lane in software console to `MANUAL_BOOTH_MODE`.
  4. Route traffic to secondary lane if available and contact maintenance technician (SLA: 2 hours).

---

## 3. Escalation Matrix
- **Level 1**: Booth Attendant (Immediate - QR scan, visual plate check)
- **Level 2**: Facility Operations Manager (+91-9811002233 - Tariffs, refunds, disputes)
- **Level 3**: Parkwise Platform Infrastructure NOC (`noc@parkwise.in` - 24/7 cloud, database, payment webhook alerts)
