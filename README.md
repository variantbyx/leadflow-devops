# LeadFlow - Production DevOps Setup

LeadFlow is a lead-tracking web application featuring:
- **Web UI**: Next.js 16 (React 19, Tailwind CSS)
- **API**: Express + TypeScript
- **Database**: PostgreSQL 16 (with persistent volume storage)
- **Ingress**: NGINX Ingress Controller

---

## 🚀 Running Locally with Docker Compose

To run the full stack locally with a single command:

```bash
docker compose up --build
```
- **Web UI**: http://localhost:3000
- **API**: http://localhost:3001 (Health: `/healthz`, Readiness: `/readyz`)
- **Database**: PostgreSQL on port 5432

---

## ☸️ Infrastructure as Code (Kubernetes & Terraform)

The entire production-grade environment is provisioned via Terraform:

```bash
cd terraform
terraform init
terraform apply -auto-approve
```

Traffic enters via NGINX Ingress on port 80:
- `http://localhost/` → Next.js Web UI
- `http://localhost/api/*` → Express API
- `http://localhost/healthz` → Express Liveness probe
- `http://localhost/readyz` → Express Readiness probe (verifies DB)
- `http://localhost/version` → Running version string

---

## 🔄 Zero-Downtime Rollout & 1-Command Rollback

### Zero-Downtime Release:
```bash
kubectl set env deployment/leadflow-backend -n leadflow APP_VERSION=v1.0.1
kubectl rollout status deployment/leadflow-backend -n leadflow
```

### 1-Command Rollback:
```bash
kubectl rollout undo deployment/leadflow-backend -n leadflow
kubectl rollout status deployment/leadflow-backend -n leadflow
```

---

## 🧪 CI/CD Pipeline (GitHub Actions)

On every push to `main`:
1. **Backend Tests**: Spawns a PostgreSQL container and runs unit/integration tests (`npm test`) and typechecks.
2. **Frontend Tests**: Runs ESLint and production Next.js builds.
3. **Build & Deploy**: Builds Docker images, provisions a local Kind Kubernetes cluster, applies Terraform manifests, and verifies live `/healthz` and `/readyz` endpoints.

---

## 📄 Architecture & Decisions
Detailed architecture diagrams, traps spotted in the starter code, secrets handling, rollback mechanisms, and cloud cost estimates are documented in **[NOTES.md](./NOTES.md)**.