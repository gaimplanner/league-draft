# External Integrations

**Analysis Date:** 2026-01-29

## APIs & External Services

**Not Detected:**
- No third-party REST APIs integrated currently
- No SaaS payment processing (Stripe, Paddle, etc.)
- No external analytics or telemetry services
- No third-party messaging services

## Data Storage

**Databases:**
- PostgreSQL 16-alpine
  - Connection: `DATABASE_URL` env var (default: `postgresql://league_draft:league_draft_dev@localhost:5433/league_draft`)
  - Client: Django ORM (built-in)
  - Runs in Docker container `league-draft-db` exposed on port 5433

**File Storage:**
- Local filesystem only
  - CSV/Excel imports: Parsed in-memory by frontend (PapaParse, XLSX libraries)
  - No persistent file storage (S3, Azure Blob, etc.)
  - Static files: Collected to `server/staticfiles/` by Django (for production)

**Caching:**
- Not configured
- Django default caching to local memory available but not explicitly enabled

## Authentication & Identity

**Auth Provider:**
- Custom email/password authentication (Django built-in)
  - Implementation: Email-based user accounts via custom User model (`server/draft/models.py`)
  - Password validation: Django's standard validators + custom `StrongPasswordValidator` (`server/draft/validators.py`)
  - Session-based auth with Django sessions framework
  - CSRF protection via cookie-based tokens (not session-based)
  - Session timeout: 24 hours (`SESSION_COOKIE_AGE = 86400`)

**Multi-tenancy:**
- Organization model (formerly League) is the tenant
- Users belong to multiple organizations via `OrganizationMembership`
- Roles per organization: `admin`, `coach`, `viewer`
- TenantMiddleware (`server/draft/middleware.py`) injects `request.organization` based on user's membership

**No OAuth/SSO:**
- No Google Login, GitHub Auth, or other providers
- Registration requires email + password creation

## Monitoring & Observability

**Error Tracking:**
- Not configured (no Sentry, Rollbar, etc.)
- Errors logged to Django console/application logs

**Logs:**
- Backend: Django logging to console (captured by Docker logs)
  - View with: `docker compose logs -f api`
- Frontend: Browser console logs (no centralized log aggregation)
- No structured logging framework configured

## CI/CD & Deployment

**Hosting:**
- Not configured for automated deployment
- Manual deployment via Docker containers
- Frontend: Static site (Vite build output)
- Backend: Docker container with Gunicorn WSGI server

**CI Pipeline:**
- Not detected (no GitHub Actions, GitLab CI, etc.)
- E2E tests can be run locally via Playwright

**Containerization:**
- Docker Compose for local development
  - Two services: `db` (PostgreSQL) and `api` (Django)
  - Frontend runs locally with `npm run dev` (not containerized in compose)
- Multi-stage Dockerfile available for production builds

## Environment Configuration

**Required env vars:**

Frontend (`.env.local`):
- `VITE_USE_API` - Enable API mode (default: `true`)
- `VITE_API_URL` - API endpoint (default: `http://localhost:3001/api`)

Backend (`server/.env`):
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SECRET_KEY` - Django secret key (required for security)
- `DEBUG` - Debug mode toggle (default: `true` for dev, must be `false` for production)
- `ALLOWED_HOSTS` - Comma-separated allowed hosts
- `CORS_ALLOWED_ORIGINS` - Comma-separated CORS origins for frontend
- `FRONTEND_URL` - Frontend URL for password reset email links (default: `http://localhost:5173`)

**Secrets location:**
- `server/.env` file (should NOT be committed, use `.env.example` as template)
- `.env.local` for frontend (should NOT be committed)
- Docker Compose overrides via `environment:` section in `docker-compose.yml`

## Email

**Email Configuration:**
- Backend: Console email backend (`django.core.mail.backends.console.EmailBackend`)
- **Production TODO:** Replace with real SMTP service (SendGrid, SES, etc.)
- Default sender: `noreply@littleleaguedraft.local`
- Password reset flow sends emails via `django.core.mail.send_mail()`
- Password reset token expiration: 1 hour (`PASSWORD_RESET_TIMEOUT = 3600`)

**Use cases:**
- Password reset emails (sent to user email with reset token link)
- Organization invitation emails (not implemented yet)

## Webhooks & Callbacks

**Incoming:**
- Not implemented
- No webhook endpoints that receive events from external services

**Outgoing:**
- Not implemented
- No callbacks to external services from draft events

## Cross-Origin Requests (CORS)

**Configuration:**
- CORS enabled via `django-cors-headers`
- Allowed origins configurable via `CORS_ALLOWED_ORIGINS` env var
- Default origins (development):
  - `http://localhost:5173`
  - `http://localhost:5174`
  - `http://localhost:5175`
  - `http://127.0.0.1:5173`
  - `http://127.0.0.1:5174`
  - `http://127.0.0.1:5175`
- Credentials allowed: `CORS_ALLOW_CREDENTIALS = True`

## API Communication

**Frontend to Backend:**
- Protocol: HTTPS (in production)
- Base URL: `VITE_API_URL` environment variable
- Authentication: Session cookies (CSRF protected)
- Data format: JSON with snake_case from API, transformed to camelCase by frontend
- Transformation: `server/draft/transformers.py` handles snake_case ↔ camelCase conversion
- Timeout: 30 seconds (configurable in `src/api/client.ts`)
- CSRF handling: Automatic retry on 403 with token refresh

**API Endpoints:**
- Auth: `/api/auth/*` (register, login, logout, password reset)
- Divisions: `/api/divisions/`
- Teams: `/api/teams/`
- Players: `/api/players/`
- Draft: `/api/draft/`
- Organizations: `/api/leagues/` (legacy name, uses Organization model)
- Team Builder: `/api/team-builder/`

---

*Integration audit: 2026-01-29*
