# PARKWISE PHASE 07: AI INTELLIGENCE ARCHITECTURE & SPECIFICATION

## Overview
Phase 07 implements the complete **AI Intelligence & Decision Platform** for Parkwise across six production-grade Python modules.

All models and analytical services follow zero-hallucination engineering standards:
1. **Provenance Classification**: Every data point is tagged as `ACTUAL_DB_OBSERVATION`, `PREDICTED_NOT_ACTUAL`, or `SAMPLE_DATA`. Model predictions are never presented as observed reality.
2. **Deterministic Bounding**: AI proposals for dynamic pricing cannot breach operator-configured minimum or maximum bounds.
3. **Operator Governance**: AI price changes and booking decisions are never automatically applied without explicit operator approval or transactional backend confirmation.
4. **Hard Security Guardrails**: The conversational LLM assistants are strictly read-only and prohibited from executing mutations on payments, bookings, or pricing.

---

## Module 1: Best-Slot Recommendation Engine
- **Source**: `backend/app/ai/slot_ranker.py`
- **Endpoints**: `POST /api/v1/ai/recommendations`
- **Architecture**:
  1. **Hard Constraint Filtering**: Evaluates bay availability, EV charging needs, wheelchair accessibility, dimensional compatibility (SUV XL wide-bay requirements), and budget caps. Incompatible slots are rejected immediately.
  2. **Multi-Factor Feature Normalization**: Extracts normalised features in `[0, 1]` for distance, vehicle fit, EV match, duration fit, availability cushion, and price efficiency.
  3. **Pluggable Scoring Strategy**:
     - `WEIGHTED_SCORING` (Production Default): Deterministic weighted sum with normalized, configurable weights.
     - `LEARNED` (Pluggable LTR): Automatically loads an XGBoost ranking booster from `model_artifacts/slot_ranker_xgb.json` if present; falls back safely to weighted scoring when labelled conversion telemetry is pending.

---

## Module 2: Demand Forecasting (Baseline vs XGBoost)
- **Source**: `backend/app/ai/forecasting.py`
- **Endpoints**: `GET /api/v1/ai/demand-forecast/{lot_id}`
- **Horizon**: 168 consecutive hourly steps (7 full days).
- **Dual-Model Evaluation**:
  - **Seasonal-Naive Baseline**: $y(t) = y(t - 168\text{h})$ weekly seasonality.
  - **XGBoost Direct Regressor**: Gradient-boosted decision trees trained on calendar cycles, 168h/336h lags, and same-hour moving averages.
- **Uncertainty & Confidence Intervals**:
  - Employs **split-conformal prediction intervals** at the 90% confidence level.
  - Interval half-width is calibrated from the 90th percentile of absolute residuals on an unseen calibration week, with empirical coverage reported on a separate holdout test week.
- **Data Provenance**:
  - Automatically checks live booking ledger density. If fewer than 336 non-zero hours exist in the last 60 days, falls back to `data/ai_sample_dataset.json` with an explicit `SAMPLE_DATA` classification banner.

---

## Module 3: Dynamic Pricing & Approval Workflow
- **Source**: `backend/app/ai/pricing.py`
- **Endpoints**:
  - `POST /api/v1/ai/pricing/proposals` (Create proposal, requires `lot:manage`)
  - `GET /api/v1/ai/pricing/proposals` (List proposals, requires `lot:manage`)
  - `POST /api/v1/ai/pricing/proposals/{proposal_id}/decision` (Approve / Override / Reject, requires `lot:manage`)
- **Deterministic Step Tiers**:
  - $\ge 85\%$ Predicted Peak $\rightarrow$ `CRITICAL_PEAK` (1.40x)
  - $\ge 70\%$ Predicted Peak $\rightarrow$ `HIGH_DEMAND` (1.25x)
  - $\ge 50\%$ Predicted Peak $\rightarrow$ `MODERATE_DEMAND` (1.10x)
  - $\le 25\%$ Predicted Peak $\rightarrow$ `OFF_PEAK_DISCOUNT` (0.90x)
  - Baseline $\rightarrow$ `STANDARD_DEMAND` (1.00x)
- **Bounded Clamping & Trace**:
  - Evaluates operator-defined `PricingRule` caps.
  - Clamps strictly to $[ \text{min\_hourly\_rate\_inr}, \text{max\_hourly\_rate\_inr} ]$.
  - Generates immutable `formula_trace` recording all intermediate variables.
- **Human-in-the-Loop**:
  - All proposals start in `PENDING_APPROVAL`.
  - Operators may `APPROVE`, `MANUAL_OVERRIDE` (with bounded clamping), or `REJECT`.
  - All actions produce timestamped records in `audit_logs`.

---

## Module 4: Bilingual Conversational Booking Assistant
- **Source**: `backend/app/ai/booking_assistant.py`
- **Endpoints**: `POST /api/v1/ai/booking-assistant`
- **Language Support**: English, Devanagari Hindi, and colloquial Hinglish.
- **Structured Parameter Extraction**:
  - City / Landmark (e.g. Connaught Place, BKC, Indiranagar, CyberHub, HITEC City).
  - Vehicle Class (SUV XL, Compact, Sedan) in Hindi and English.
  - EV Charging (`ईवी`, `चार्जिंग`, `ccs2`) and Accessibility (`दिव्यांग`, `wheelchair`).
  - Duration (numerical digits and Hindi word numbers: `दो घंटे`, `char ghante`).
  - Maximum budget ceilings.
- **Mandatory Backend Validation**:
  - Slot availability is verified against conflicting intervals in the PostgreSQL/SQLite `bookings` table.
  - Returns a non-executed `BookingDraft` for client review.
  - **Safety Invariant**: `booking_executed` is strictly `False`. Bookings must be submitted through transactional endpoint `POST /api/v1/bookings`.

---

## Module 5: Operator Analytics Assistant
- **Source**: `backend/app/ai/operator_assistant.py`
- **Endpoints**: `POST /api/v1/ai/operator-assistant` (requires `operator:analytics`)
- **Grounded Analytics**:
  - Queries live tables (`bookings`, `payments`, `parking_slots`, `gate_logs`).
  - Reports gross realized revenue, 18% GST collected, current bay occupancy & utilization, no-show holds, overstay penalties, and peak congestion windows.
  - Each metric cites its exact source table and SQL aggregation logic.
- **Hard Security Guardrail**:
  - Rejects state-modification prompts (price changes, booking cancellations, refund executions, table drops).
  - Flags `refused = True`, sets `write_capabilities = []`, and logs `AI_OPERATOR_ASSISTANT_MUTATION_REFUSED` to `audit_logs`.

---

## Module 6: Model Monitoring & Drift Detection
- **Source**: `backend/app/ai/monitoring.py`
- **Endpoints**: `GET /api/v1/ai/monitoring` (requires `operator:analytics`)
- **Capabilities**:
  1. **Live Forecast Evaluation**: Automatically links past predictions with observed occupancy readings taken during target hours to calculate real-world MAE, RMSE, Bias, and 90% CI empirical coverage.
  2. **Feature Drift Tracking**: Computes **Population Stability Index (PSI)** between reference baseline distributions and live database distributions for occupancy, duration, and hourly tariffs:
     $$\text{PSI} = \sum \left( \text{Actual}_i - \text{Expected}_i \right) \times \ln\left( \frac{\text{Actual}_i}{\text{Expected}_i} \right)$$
     - $\text{PSI} < 0.10$: `HEALTHY`
     - $0.10 \le \text{PSI} < 0.25$: `MODERATE_DRIFT`
     - $\text{PSI} \ge 0.25$: `SIGNIFICANT_DRIFT`
  3. **Data Quality Audits**: Validates slot schema integrity, IoT sensor heartbeats, positive duration & amount invariants on bookings, and pricing rule bounds.
  4. **Telemetry Logging**: Persists audit checkpoints into `ai_model_metric_logs`.

---

## Automated Validation & Evaluation Scripts
- Run evaluation: `py scripts/evaluate_models.py`
- Run test suite: `py -m pytest -v` (6/6 suites passing)
- Sample dataset: `backend/data/ai_sample_dataset.json`
