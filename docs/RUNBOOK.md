# Little League Draft - Operations Runbook

This document provides operational guidance for running the Little League Draft application in production.

## Table of Contents

1. [System Overview](#system-overview)
2. [Health Monitoring](#health-monitoring)
3. [Incident Response](#incident-response)
4. [Common Issues](#common-issues)
5. [Database Operations](#database-operations)
6. [Deployment Procedures](#deployment-procedures)
7. [Alerting Configuration](#alerting-configuration)

---

## System Overview

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   API       │────▶│  PostgreSQL │
│   (React)   │     │   (Django)  │     │  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
     CDN              K8s (2 replicas)    Cloud SQL
```

### Key Components

| Component | Technology | Notes |
|-----------|------------|-------|
| Frontend | React + TypeScript + Vite | Static files served via CDN |
| API | Django REST Framework | Kubernetes deployment (2 replicas) |
| Database | PostgreSQL 16 | Cloud SQL with automated backups |
| Auth | Session-based | 24-hour session timeout |

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SECRET_KEY` | Django secret key | Yes |
| `DEBUG` | Enable debug mode (False in prod) | Yes |
| `ALLOWED_HOSTS` | Comma-separated allowed hosts | Yes |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS origins | Yes |
| `LOG_FORMAT` | `json` or `console` | No (default: json) |
| `LOG_LEVEL` | Logging level | No (default: INFO) |

---

## Health Monitoring

### Health Check Endpoint

```bash
# Basic health check
curl https://api.your-domain.com/health/

# Expected response (healthy):
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "response_time_ms": 12.5,
  "timestamp": "2025-01-22T12:00:00Z"
}

# Degraded response (database issue):
{
  "status": "degraded",
  "version": "1.0.0",
  "database": "disconnected",
  "response_time_ms": 5002.3,
  "timestamp": "2025-01-22T12:00:00Z"
}
```

### Key Metrics to Monitor

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| API Response Time (p95) | > 1s | > 3s |
| API Error Rate | > 2% | > 5% |
| Database Connections | > 80% pool | > 95% pool |
| Memory Usage | > 70% | > 90% |
| CPU Usage | > 70% | > 90% |

### Log Locations

- **API Logs**: Kubernetes pod logs (JSON structured)
- **Client Errors**: Logged to `/api/log-error/` endpoint
- **Correlation IDs**: All requests tagged with `X-Request-ID` header

```bash
# View API logs
kubectl logs -l app=league-draft --tail=100 -f

# Search for specific request
kubectl logs -l app=league-draft | jq 'select(.request_id == "abc123")'

# View errors only
kubectl logs -l app=league-draft | jq 'select(.level == "ERROR")'
```

---

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 | Draft in progress cannot continue | Immediate |
| P2 | Feature degraded but draft can continue | < 1 hour |
| P3 | Minor issue, workaround available | < 24 hours |
| P4 | Enhancement request | Next sprint |

### Draft Stuck / UI Frozen (P1)

**Symptoms**: Users cannot make picks, UI unresponsive

**Diagnosis**:
1. Check browser console for JavaScript errors
2. Verify API health: `curl https://api.your-domain.com/health/`
3. Check Kubernetes pod status: `kubectl get pods -l app=league-draft`
4. Review recent logs for errors

**Resolution**:
1. If frontend lock stuck: Wait 30 seconds for auto-release (built-in timeout)
2. If API unresponsive: Check pod health, restart if needed
3. If database issue: Check Cloud SQL status, connection pool

**Rollback**:
```bash
# If deployment caused issue, rollback
kubectl rollout undo deployment/league-draft
```

### Player Already Drafted Error (P2)

**Symptoms**: "Player is already drafted" error when picking

**Cause**: Race condition or stale UI state

**Resolution**:
1. Refresh the browser page
2. Verify pick was actually recorded
3. If pick was recorded, it's working correctly (UI was stale)
4. If pick was NOT recorded, retry the pick

### Mandatory Pick Not Appearing (P2)

**Symptoms**: Coach's kid or sibling should be mandatory but isn't shown

**Cause**: Coach team assignment missing or incorrect projected round

**Resolution**:
1. In Review phase, verify player has `isCoachKid: true` and `coachTeamId` set
2. Verify `projectedRound` matches current round (or `lockedToRound` if set)
3. For siblings: Verify `siblingId` is set correctly on both players

### Authentication Issues (P2)

**Symptoms**: Users cannot log in, sessions expiring unexpectedly

**Diagnosis**:
1. Check for rate limiting (5 attempts/minute limit)
2. Verify CSRF token is being sent
3. Check session cookie settings

**Resolution**:
1. Rate limited: Wait 1 minute, retry
2. CSRF issues: Clear browser cookies, reload app
3. Session issues: Check `SESSION_COOKIE_AGE` setting (default: 24 hours)

---

## Common Issues

### Issue: Import Fails with Validation Errors

**Resolution**:
1. Check CSV format matches expected columns
2. Verify all required fields present (firstName, lastName, bib, birthday, littleLeagueAge)
3. Check for duplicate BIB numbers
4. Verify age values are reasonable (4-18)

### Issue: Sibling Chain Not Working

**Resolution**:
1. Verify `siblingId` is set on BOTH siblings (bidirectional link)
2. For 3+ siblings, verify chain links correctly (A→B→C, C→B)
3. Check `lockedToTeamId` is set when first sibling is drafted

### Issue: Snake Draft Order Incorrect

**Resolution**:
1. Verify `draftFormat` is set to "snake"
2. Snake reverses order on even rounds (2, 4, 6...)
3. Check `currentRoundOrder` in draft state matches expected

### Issue: Score Calculations Wrong

**Resolution**:
1. Check `scoringMode` setting (raw vs pre-weighted)
2. Verify `scoringWeights` in division config
3. Recalculate: scores should sum component scores with weights

---

## Database Operations

### Backup Schedule

- **Automated**: Daily backups at 2:00 AM UTC (Cloud SQL)
- **Retention**: 7 days for daily, 30 days for weekly
- **Point-in-time**: Recovery available within retention window

### Manual Backup

```bash
# Create manual backup
gcloud sql backups create --instance=league-draft-db

# List backups
gcloud sql backups list --instance=league-draft-db
```

### Restore from Backup

```bash
# Restore to specific backup
gcloud sql backups restore BACKUP_ID \
  --restore-instance=league-draft-db \
  --backup-instance=league-draft-db

# Point-in-time recovery
gcloud sql instances clone league-draft-db league-draft-db-restored \
  --point-in-time="2025-01-22T12:00:00Z"
```

### Data Recovery from Draft Picks

If player state becomes inconsistent, it can be reconstructed from DraftPick records:

```sql
-- View all picks for a draft
SELECT dp.round, dp.pick, dp.was_skipped,
       t.name as team_name,
       p.name as player_name, p.total_score
FROM draft_picks dp
JOIN teams t ON dp.team_id = t.id
LEFT JOIN players p ON dp.player_id = p.id
WHERE dp.draft_state_id = 'DRAFT_STATE_UUID'
ORDER BY dp.pick;

-- Reconstruct player draft status from picks
UPDATE players p
SET is_drafted = true,
    drafted_by_team_id = dp.team_id,
    drafted_in_round = dp.round,
    drafted_at_pick = dp.pick
FROM draft_picks dp
WHERE dp.player_id = p.id
  AND dp.draft_state_id = 'DRAFT_STATE_UUID'
  AND NOT dp.was_skipped;
```

### Connection Pool Management

```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity
WHERE datname = 'league_draft';

# Kill idle connections (emergency only)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'league_draft'
  AND state = 'idle'
  AND query_start < now() - interval '10 minutes';
```

---

## Deployment Procedures

### Pre-Deployment Checklist

- [ ] All tests passing (frontend + backend)
- [ ] Build successful
- [ ] Database migrations reviewed
- [ ] No active drafts in progress (check with users)
- [ ] Rollback plan ready

### Deploy to Production

```bash
# 1. Run tests
npm run test
docker compose exec api python manage.py test draft.tests

# 2. Build and push image
docker build -t us-east1-docker.pkg.dev/gaimplan-core/builds/league-draft:v1.x.x .
docker push us-east1-docker.pkg.dev/gaimplan-core/builds/league-draft:v1.x.x

# 3. Update deployment
kubectl set image deployment/league-draft \
  league-draft=us-east1-docker.pkg.dev/gaimplan-core/builds/league-draft:v1.x.x

# 4. Monitor rollout
kubectl rollout status deployment/league-draft

# 5. Verify health
curl https://api.your-domain.com/health/
```

### Database Migrations

```bash
# Run migrations (automatic on pod startup, but can be manual)
kubectl exec -it deployment/league-draft -- python manage.py migrate

# Check migration status
kubectl exec -it deployment/league-draft -- python manage.py showmigrations
```

### Rollback

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/league-draft

# Rollback to specific revision
kubectl rollout undo deployment/league-draft --to-revision=2

# Check rollout history
kubectl rollout history deployment/league-draft
```

---

## Alerting Configuration

### Recommended Alerts

#### Critical (P1) - Page immediately

| Alert | Condition | Channel |
|-------|-----------|---------|
| API Down | Health check fails 3x consecutive | PagerDuty |
| Database Unreachable | Health shows `database: disconnected` | PagerDuty |
| Error Rate Spike | > 10% error rate for 5 minutes | PagerDuty |

#### Warning (P2) - Notify within 1 hour

| Alert | Condition | Channel |
|-------|-----------|---------|
| High Latency | p95 response > 2s for 10 minutes | Slack |
| High Error Rate | > 5% error rate for 10 minutes | Slack |
| Auth Failures | > 20 failures/minute | Slack |
| Memory High | > 85% for 15 minutes | Slack |

#### Info (P3/P4) - Daily digest

| Alert | Condition | Channel |
|-------|-----------|---------|
| Elevated Latency | p95 response > 1s | Email digest |
| Certificate Expiry | < 30 days | Email digest |
| Database Size | > 80% quota | Email digest |

### Alert Configuration Examples

#### Prometheus Alert Rules (if using Prometheus)

```yaml
groups:
  - name: league-draft
    rules:
      - alert: APIHighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"

      - alert: APIDown
        expr: up{job="league-draft"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "League Draft API is down"
```

#### Cloud Monitoring (GCP)

```bash
# Create uptime check
gcloud monitoring uptime-configs create league-draft-health \
  --display-name="League Draft Health" \
  --http-check-path="/health/" \
  --monitored-resource-type="uptime-url" \
  --hostname="api.your-domain.com"
```

---

## Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-call Engineer | [Rotation Schedule] | PagerDuty |
| Backend Lead | [Name] | Direct |
| Frontend Lead | [Name] | Direct |
| Database Admin | [Name/Team] | Ticket |

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-22 | 1.0 | Initial runbook creation |
