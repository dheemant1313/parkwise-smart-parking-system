# PARKWISE ENTERPRISE PRODUCTION DEPLOYMENT RUNBOOK
**Document Version:** 2.5.0  
**Target Environment:** Production (Linux / Ubuntu 22.04 LTS or Amazon Linux 2023)  
**Security Level:** Enterprise Grade / DPDP Act 2023 Compliant  

---

## 1. ARCHITECTURE OVERVIEW

Parkwise uses a production multi-container architecture secured behind an Nginx reverse proxy with TLS 1.3 termination, rate-limiting zones, and WebSocket support:

```
[ Internet Traffic / Drivers & Operators ]
                   │
                   ▼ (Port 80 HTTP -> 301 Redirect)
                   │
                   ▼ (Port 443 HTTPS / TLS 1.3)
      ┌─────────────────────────────┐
      │   Nginx Reverse Proxy       │
      │  (TLS, HSTS, Rate Limiting) │
      └──────────────┬──────────────┘
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
┌──────────────┐            ┌──────────────┐
│   Frontend   │            │   Backend    │
│  (Next.js)   │            │  (FastAPI)   │
│  Port 3000   │            │  Port 8000   │
└──────────────┘            └──────┬───────┘
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
              ┌──────────────┐            ┌──────────────┐
              │  PostgreSQL  │            │   Redis 7    │
              │  Version 16  │            │ (AOF Locks)  │
              └──────────────┘            └──────────────┘
```

---

## 2. SERVER SIZING & PREREQUISITES

### Minimum Recommended Production Specs
- **vCPU:** 4 vCPUs (Compute-Optimized or General Purpose)
- **RAM:** 8 GB (16 GB recommended for high peak booking volumes)
- **Storage:** 100 GB NVMe SSD with automated EBS/volume snapshots
- **OS:** Ubuntu 22.04 LTS / Debian 12 / AWS Linux 2023
- **Network:** 1 Gbps egress with static elastic IP

### Host Software Prerequisites
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker CE & Docker Compose Plugin
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable Docker on startup
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

---

## 3. DOMAIN & DNS CONFIGURATION

Configure the following DNS records at your domain registrar or Cloudflare:

| Record Type | Hostname | Value / Destination | TTL | Notes |
|:---|:---|:---|:---|:---|
| **A** | `@` (parkwise.in) | `203.0.113.10` (Server Elastic IP) | Auto / 300s | Primary apex domain |
| **A** | `api` (api.parkwise.in) | `203.0.113.10` (Server Elastic IP) | Auto / 300s | Dedicated API subdomain |
| **CNAME** | `www` (www.parkwise.in) | `parkwise.in` | Auto / 300s | Redirect alias |
| **CAA** | `@` | `0 issue "letsencrypt.org"` | 3600s | Certificate authority authorization |

---

## 4. SSL/TLS CERTIFICATES (LET'S ENCRYPT & CERTBOT)

Generate free, auto-renewing wildcard or multi-domain certificates using Certbot:

```bash
# Install Certbot
sudo apt install -y certbot

# Option A: Standalone generation before starting Nginx
sudo certbot certonly --standalone \
  -d parkwise.in \
  -d www.parkwise.in \
  -d api.parkwise.in \
  --agree-tos \
  --email devops@parkwise.in

# Certificates are installed to:
# /etc/letsencrypt/live/parkwise.in/fullchain.pem
# /etc/letsencrypt/live/parkwise.in/privkey.pem
```

Setup auto-renewal cron in `/etc/cron.d/certbot-renew`:
```bash
0 3 * * * certbot renew --quiet --post-hook "docker exec parkwise-prod-nginx nginx -s reload"
```

---

## 5. ENVIRONMENT SETUP & SECRET ROTATION

1. Clone repository to deployment directory:
```bash
git clone https://github.com/dheemant1313/parkwise-smart-parking-system.git /opt/parkwise
cd /opt/parkwise
```

2. Copy production environment template:
```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

3. Generate secure cryptographic keys:
```bash
# Generate 64-character hex key for JWT_SECRET_KEY
openssl rand -hex 32

# Generate 64-character hex key for QR_HMAC_SECRET
openssl rand -hex 32

# Generate strong Redis password
openssl rand -hex 24

# Generate strong PostgreSQL password
openssl rand -hex 24
```
Edit `.env.production` and populate the generated keys along with live Razorpay credentials.

---

## 6. PRODUCTION DEPLOYMENT STEP-BY-STEP

### Step 1: Build Production Containers
```bash
docker compose -f docker-compose.prod.yml build
```

### Step 2: Initialize Database and Start Services
```bash
# Launch PostgreSQL and Redis first
docker compose -f docker-compose.prod.yml up -d postgres redis

# Verify health
docker compose -f docker-compose.prod.yml ps

# Launch backend, frontend, nginx, and backup services
docker compose -f docker-compose.prod.yml up -d
```

### Step 3: Run Database Migrations & Initial Seed
```bash
# Execute schema migration and seed
docker compose -f docker-compose.prod.yml exec backend python -c "from app.seed import seed_initial_data; from app.database import SessionLocal; db = SessionLocal(); seed_initial_data(db); db.close(); print('Seed verified!')"
```

### Step 4: Verify Health Probes
```bash
# Liveness probe (HTTP 200)
curl -i https://parkwise.in/api/v1/health/live

# Readiness probe (Verifies PostgreSQL connection)
curl -i https://parkwise.in/api/v1/health/ready

# Full system telemetry
curl -i https://parkwise.in/api/v1/health
```

---

## 7. BACKUP, RESTORE & POINT-IN-TIME RECOVERY

### Automated Backup Execution
The `db_backup` container automatically executes `/backup.sh` every morning at 02:00 UTC, creating a gzip-compressed dump in `./backups/` and automatically purging archives older than 30 days.

### Manual On-Demand Backup
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U parkwise_admin -d parkwise_production -F c | gzip -9 > ./backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Full Disaster Recovery / Database Restore
```bash
# 1. Stop web traffic
docker compose -f docker-compose.prod.yml stop backend frontend

# 2. Drop existing schema and restore from backup file
gunzip -c ./backups/parkwise_production_backup_20261112_020000.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U parkwise_admin -d parkwise_production --clean --if-exists

# 3. Restart application services
docker compose -f docker-compose.prod.yml start backend frontend
```

---

## 8. ZERO-DOWNTIME ROLLING DEPLOYMENT PROCEDURE

For application updates without service interruption:
```bash
# 1. Pull latest code from GitHub
git pull origin main

# 2. Build updated images
docker compose -f docker-compose.prod.yml build backend frontend

# 3. Rolling restart backend
docker compose -f docker-compose.prod.yml up -d --no-deps --build backend

# 4. Wait for readiness probe
until $(curl --output /dev/null --silent --head --fail http://localhost:8000/api/v1/health/ready); do
    printf '.'
    sleep 2
done

# 5. Rolling restart frontend
docker compose -f docker-compose.prod.yml up -d --no-deps --build frontend

# 6. Reload Nginx configuration
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 9. EMERGENCY ROLLBACK PROCEDURE

If a newly deployed release exhibits unforeseen regression:
```bash
# 1. Revert to previous stable git commit
git checkout HEAD~1

# 2. Rebuild and force recreate containers
docker compose -f docker-compose.prod.yml up -d --build --force-recreate

# 3. Verify health probes
curl -f https://parkwise.in/api/v1/health/ready || echo "ROLLBACK HEALTHCHECK FAILED"
```
