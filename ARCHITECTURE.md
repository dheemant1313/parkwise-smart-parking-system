# PARKWISE — System Architecture & Engineering Specification

## 1. Executive Summary
**Parkwise** is an enterprise-grade, AI-powered smart parking ecosystem engineered for Indian metropolitan infrastructure (New Delhi, Mumbai, Bengaluru, Gurugram, Hyderabad). It connects **Drivers**, **Commercial Parking Operators**, **Automated Boom-Barrier Gate Terminals (ANPR + QR + FASTag)**, and **Platform Administrators** across a unified real-time transactional ledger.

## 2. Core Applications
1. **Public Marketing Website (`/`)**:
   - Apple-inspired minimalist light theme (`#FFFFFF`, `#F8FAFC`), Electric Blue primary accent (`#0052FF`), and Stripe-grade SaaS layout.
   - Interactive Three.js / React Three Fiber 3D Smart Parking Deck Digital Twin.
   - Live metropolitan bay availability and interactive Operator ROI & Dynamic Yield simulator.
2. **Driver Booking Application (`/driver`)**:
   - Multi-city facility selector, 2D Bay Matrix & 3D Spatial Deck switcher, floor selector, Indian vehicle RTO license plate validation (`^[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4}$`), transparent GST (18%) + surge pricing breakdown, Razorpay/FASTag checkout, and cryptographically signed `HMAC-SHA256` QR Gate Pass.
3. **Parking Operator Dashboard (`/operator`)**:
   - Recharts 12-hour AI occupancy forecast and dynamic surge multiplier charts, live bay status override matrix (`AVAILABLE`, `RESERVED`, `OCCUPIED`, `MAINTENANCE`), and dynamic tariff controls.
4. **Gate Management Application (`/gate`)**:
   - Simulated edge optical ANPR camera feed, cryptographic `HMAC-SHA256` QR signature verifier, tampered-signature security rejection test, boom-barrier state machine (`STANDBY`, `OPENED`, `LOCKED`), and real-time gate audit stream.
5. **Platform Administrator Dashboard (`/admin`)**:
   - Role-Based Access Control (`DRIVER`, `OPERATOR`, `GATE_STAFF`, `ADMIN`), national GMV & multi-city telemetry, live vs simulated integration transparency matrix, operator KYC registry, and immutable security audit trail.

## 3. Transactional Integrity & Double-Booking Prevention
- **Zero Double-Booking**: Every booking request acquires a slot-level concurrency lock (`acquire_slot_lock(slot_id)`) and executes a strict time-window overlap query (`req_start < existing.end_time AND req_end > existing.start_time`) across active bookings before committing inside an atomic database transaction.
- **Zero-Trust Pricing & Signatures**: Pricing, 18% GST, and surge multipliers are computed strictly on the backend. Every reservation is signed with `HMAC-SHA256` (`QR_HMAC_SECRET`), preventing forged frontend QR codes from opening gate barriers.
