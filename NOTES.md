# LeadFlow DevOps Notes & Architecture Decisions

## 1. System Architecture & Routing
- **Orchestration**: Kubernetes with Terraform as Infrastructure as Code.
- **Routing**: Ingress Controller (NGINX) acts as the single point of entry on port 80:
  - `/api` → `leadflow-backend` (port 3001)
  - `/healthz`, `/readyz`, `/version` → `leadflow-backend` (port 3001)
  - `/` → `leadflow-frontend` (Next.js port 3000)
- **Database**: PostgreSQL 16 deployed with a `PersistentVolumeClaim` (1Gi) ensuring persistence across pod restarts and updates.

### Traps Identified in Starter Code
1. **Next.js Production Rewrite Trap**: In development, Next.js rewrote `/api` to localhost:3001. In production (`NODE_ENV=production`), `next.config.ts` returns `[]`. We solved this by using Kubernetes Ingress to route `/api` directly to Express and `/*` to Next.js.
2. **Migrations Trap**: Migrations are never run automatically on API start. We encapsulated migrations within the container startup sequence and separated integration tests to run with isolated clean tables.
3. **Health vs Readiness Probe Trap**: Express provides `/healthz` (liveness) and `/readyz` (readiness, tests DB reachability). We wired Kubernetes `livenessProbe` to `/healthz` and `readinessProbe` to `/readyz` to ensure zero traffic is sent to pods during restarts until the DB connection is verified.

---

## 2. Secrets Management
- No secrets are stored in Git history. A strict `.gitignore` excludes `.env`, `*.tfstate`, and credentials.
- In Kubernetes, sensitive variables (`DATABASE_URL`, `POSTGRES_PASSWORD`) are injected via Kubernetes `Secret` resources (`leadflow-secrets`), referenced by pods as environment variables.
- In production cloud setups (e.g., AWS/GCP), this would integrate with AWS Secrets Manager / HashiCorp Vault via the External Secrets Operator.

---

## 3. Safe Releases & Rollback Mechanism

### Zero-Downtime Rollout
- Deployments use `RollingUpdate` with `maxSurge: 1` and `maxUnavailable: 0`.
- New pods are created first. Traffic is only directed to them once their `readinessProbe` (`/readyz`) succeeds.
- Old pods are only terminated after new pods are fully ready.

### 1-Command Rollback
To rollback to the previous version at any time:
```bash
kubectl rollout undo deployment/leadflow-backend -n leadflow
```
- **What it undoes**: Immediately reverts the container image, configuration, and environment variables to the previous ReplicaSet.
- **What it does not undo**: Database state/migrations (schema changes require forward-compatible migrations or backward-compatible rollback scripts).

#### Terminal Execution Log (Proof of Zero-Downtime Rollout & 1-Command Rollback):
```text
PS C:\Users\BIT\Desktop\leadflow\terraform> kubectl set env deployment/leadflow-backend -n leadflow APP_VERSION=v1.0.1
deployment.apps/leadflow-backend env updated

PS C:\Users\BIT\Desktop\leadflow\terraform> kubectl rollout status deployment/leadflow-backend -n leadflow
Waiting for deployment "leadflow-backend" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "leadflow-backend" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "leadflow-backend" rollout to finish: 1 old replicas are pending termination...
deployment "leadflow-backend" successfully rolled out

PS C:\Users\BIT\Desktop\leadflow\terraform> curl.exe http://localhost/version
{"version":"v1.0.1"}

PS C:\Users\BIT\Desktop\leadflow\terraform> kubectl rollout undo deployment/leadflow-backend -n leadflow
deployment.apps/leadflow-backend rolled back

PS C:\Users\BIT\Desktop\leadflow\terraform> kubectl rollout status deployment/leadflow-backend -n leadflow
Waiting for deployment "leadflow-backend" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "leadflow-backend" rollout to finish: 1 old replicas are pending termination...
deployment "leadflow-backend" successfully rolled out

PS C:\Users\BIT\Desktop\leadflow\terraform> curl.exe http://localhost/version
{"version":"v1.0.0"}
```

---

## 4. Pipeline & Proof
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`).
- **Pipeline Stages**:
  1. **Test Backend**: Spawns isolated PostgreSQL service container, runs linter and full integration test suite.
  2. **Test Frontend**: Runs ESLint and production Next.js build.
  3. **Build Images**: Builds Docker images with Buildx cache.
  4. **Deploy & Verify**: Provisions Kind cluster with Terraform, checks rollout status, and queries live `/healthz` and `/readyz` endpoints.
- **Proof Links**:
  - Actions Dashboard: https://github.com/variantbyx/leadflow-devops/actions
  - Red Run (Stops Bad Release): Demonstrates pipeline stopping deployment on failed test: https://github.com/variantbyx/leadflow-devops/actions/runs/19574488884 (or Run #3/Run #4)
  - Green Run (Successful): Latest green deployment on `main` branch: https://github.com/variantbyx/leadflow-devops/actions

---

## 5. Cost Estimation (Small Team, Real Cloud Deployment)

Assuming a small sales team (~10–50 users, ~50,000 monthly visits):

| Component | Cloud Option (AWS / Managed) | Specs | Estimated Cost / Month |
|---|---|---|---|
| **Compute** | AWS EKS (or ECS Fargate) / DigitalOcean K8s | 2x t3.medium nodes (or 2 DO droplets) | ~$40 - $70 |
| **Database** | AWS RDS PostgreSQL (db.t4g.micro) or Managed DO Postgres | 1 vCPU, 1GB RAM, 20GB SSD, automated daily backups | ~$15 - $25 |
| **Ingress / Load Balancer** | AWS Application Load Balancer / DO Load Balancer | Single external LB with TLS termination | ~$12 - $18 |
| **Registry & CI** | GitHub Actions & GHCR | Free tier / included minutes | $0 |
| **Total** | | | **~$70 - $110 / month** |

*Alternative Lean Setup*: Deploying on a single managed VPS (e.g. Hetzner / DigitalOcean with k3s) would cost under **$15/month**.

---

## 6. What Is Missing & Future Improvements
1. **External Secrets Operator**: Sync secrets directly from AWS Secrets Manager or Vault.
2. **Automated Database Backups**: CronJob taking daily `pg_dump` snapshots to an S3 bucket.
3. **Observability**: Prometheus & Grafana dashboard for metrics and Loki for centralized log aggregation.
4. **TLS/SSL**: `cert-manager` with Let's Encrypt for automatic HTTPS certificate issuance.