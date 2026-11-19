# Parkwise Production Deployment Guide

## 1. Architecture Overview
Parkwise is engineered for high-availability enterprise deployment utilizing containerized micro-services orchestrated with Docker Compose and Kubernetes.

```mermaid
flowchart TD
    Client[Web & Mobile Clients] -->|HTTPS 443 / TLS 1.3| Nginx[NGINX Reverse Proxy / SSL Termination]
    Nginx -->|X-Correlation-ID / RFC 7807| FastAPIPool[FastAPI Enterprise Backend Cluster]
    FastAPIPool -->|Write / Read Replica| Postgres[(PostgreSQL High Availability DB)]
    FastAPIPool -->|Reservation Mutex & Session Cache| Redis[(Redis Cluster)]
    FastAPIPool -->|Telemetry Scraping| Prometheus[Prometheus & Grafana Alerting]
    FastAPIPool -->|Encrypted Webhooks| Razorpay[Razorpay Payment Gateway]
    FastAPIPool -->|Signed Offline Sync| GateIPC[Gate Terminal IPC / Relay GPIO]
```

---

## 2. Environment Configuration & Secrets Management
All sensitive credentials must be injected via environment variables or a secrets manager (AWS Secrets Manager, HashiCorp Vault, or Google Secret Manager). Never commit `.env` to version control.

### Required Environment Variables
| Variable | Production Value / Format | Purpose |
| :--- | :--- | :--- |
| `ENV` | `production` | Enables strict SSL and disables debug endpoints |
| `SECRET_KEY` | `64-character hex` | Cryptographic JWT signing |
| `DATABASE_URL` | `postgresql+psycopg2://usr:pwd@host:5432/parkwise` | Enterprise relational database |
| `REDIS_URL` | `rediss://default:pwd@host:6379/0` | Slot lock mutex and token blacklisting |
| `RAZORPAY_KEY_ID` | `rzp_live_...` | Live Razorpay merchant account |
| `RAZORPAY_KEY_SECRET` | Secret string | Payment signature verification |
| `RAZORPAY_WEBHOOK_SECRET` | Secret string | Webhook HMAC-SHA256 signature verification |
| `QR_HMAC_SECRET` | `64-character hex` | Offline gate QR pass signing key |
| `CORS_ORIGINS` | `https://parkwise.in,https://admin.parkwise.in` | Whitelisted cross-origin domains |

---

## 3. Docker Production Orchestration
Production services are defined in `docker-compose.prod.yml`:

```bash
# 1. Build and boot production multi-container stack
docker-compose -f docker-compose.prod.yml up -d --build

# 2. Verify container health status
docker-compose -f docker-compose.prod.yml ps

# 3. View live structured logs
docker-compose -f docker-compose.prod.yml logs -f --tail=100
```

---

## 4. Kubernetes Production Deployment
For multi-node cloud clusters (GKE, EKS, AKS):
- Apply ConfigMaps & Secrets: `kubectl apply -f k8s/secrets.yaml`
- Deploy PostgreSQL StatefulSet with persistent volumes.
- Deploy Redis cluster with Sentinel.
- Deploy FastAPI API pods with Horizontal Pod Autoscaler (HPA) targeting 70% CPU utilization.
- Health Probes:
  - **Liveness Probe**: `GET /api/v1/health/live` (Interval: 15s)
  - **Readiness Probe**: `GET /api/v1/health/ready` (Interval: 5s)
  - **Metrics Exposition**: `GET /metrics` scraped every 15s by Prometheus.

---

## 5. Automated Disaster Recovery Backups
Automated database snapshots with SHA-256 integrity verification:
```bash
# Run backup manually or via cron
python backend/scripts/backup_db.py

# Verified backup archives are stored in /backups with a 7-day retention policy.
```
