# ParkWise Smart Parking System

Smart parking management and reservation web application.

---

## Enterprise AI Smart Parking Ecosystem for India (`PARKWISE v2.4`)

**Parkwise** is a full-stack enterprise smart parking platform connecting **Drivers**, **Parking Operators**, **Boom-Barrier Gate Systems (ANPR + QR + FASTag)**, and **Platform Administrators** across Indian metropolitan hubs (New Delhi, Mumbai, Bengaluru, Gurugram, Hyderabad).

### Core Applications Included
1. **Public Marketing Website (`/`)** — Apple/Tesla-inspired minimalist design, interactive **Three.js / React Three Fiber 3D Smart Parking Deck**, live metro telemetry, and Operator ROI calculator.
2. **Driver Booking Application (`/driver`)** — 2D & 3D bay selection, Indian RTO license plate validation, dynamic AI pricing + 18% GST calculation, Razorpay/FASTag checkout, double-booking conflict protection, and cryptographic `HMAC-SHA256` QR Gate Pass.
3. **Parking Operator Dashboard (`/operator`)** — Stripe-grade analytics with **Recharts** 12-hour AI occupancy & surge curves, live IoT bay status switches, and dynamic tariff multiplier controls.
4. **Gate Management Application (`/gate`)** — Optical ANPR camera simulation, cryptographic `HMAC-SHA256` QR pass verification, forged-QR attack detection, boom-barrier control, and real-time entry/exit audit logs.
5. **Platform Administrator Dashboard (`/admin`)** — Multi-city national GMV command center, Role-Based Access Control (`RBAC`), operator KYC verification registry, integration transparency matrix, and immutable security audit logs.

---

### Technology Stack
- **Frontend**: Next.js 14 (App Router), React 18, Strict TypeScript, Tailwind CSS, Three.js / React Three Fiber / Drei, Recharts, Lucide Icons.
- **Backend**: Python FastAPI, SQLAlchemy 2.0 ORM, Pydantic v2, PyJWT + PBKDF2-HMAC-SHA256 RBAC, WebSockets (`/ws/telemetry`).
- **Database & Concurrency**: PostgreSQL (with zero-config SQLite transactional fallback for local dev) + Redis / Mutex Slot Locks.
- **Payments & AI**: Razorpay Order & HMAC Signature Verification + GradientBoosting / Temporal Demand AI Forecasting Engine.
- **Deployment**: Docker & `docker-compose.yml`.

---

### Quick Start

#### 1. Start the FastAPI Enterprise Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- API Docs (Swagger UI): `http://localhost:8000/docs`
- Health & Integration Status: `http://localhost:8000/api/v1/health`

#### 2. Start the Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```
- Open `http://localhost:3000`

#### 3. Run Automated Tests & Type Checks
```bash
# Backend integration tests
cd backend && pytest -v

# Frontend strict TypeScript check & production build
cd frontend && npm run typecheck && npm run build
```
