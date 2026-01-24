# Load Testing

This directory contains load tests for the Little League Draft API using [Locust](https://locust.io/).

## Setup

1. Install Locust:
   ```bash
   pip install -r server/tests/load/requirements.txt
   ```

2. Create test users in the database:
   ```bash
   docker compose exec api python manage.py shell
   ```

   Then run:
   ```python
   from draft.models import User, Organization, OrganizationMembership

   # Create test organization
   org, _ = Organization.objects.get_or_create(
       slug='loadtest',
       defaults={'name': 'Load Test League'}
   )

   # Create draft session users
   for i in range(1, 11):
       user, created = User.objects.get_or_create(
           email=f'loadtest{i}@example.com',
           defaults={'first_name': f'Load', 'last_name': f'Test{i}'}
       )
       if created:
           user.set_password('TestPassword123!')
           user.save()
       OrganizationMembership.objects.get_or_create(
           user=user, organization=org, defaults={'role': 'admin'}
       )

   # Create viewer users
   for i in range(1, 21):
       user, created = User.objects.get_or_create(
           email=f'viewer{i}@example.com',
           defaults={'first_name': f'Viewer', 'last_name': f'{i}'}
       )
       if created:
           user.set_password('TestPassword123!')
           user.save()
       OrganizationMembership.objects.get_or_create(
           user=user, organization=org, defaults={'role': 'viewer'}
       )
   ```

3. Create test divisions with players (or use existing data).

## Running Tests

### Local Development

Start the API server:
```bash
docker compose up -d
```

Run Locust:
```bash
locust -f server/tests/load/locustfile.py --host=http://localhost:3001
```

Open http://localhost:8089 in your browser to configure and start the test.

### Headless Mode

For CI/CD or scripted tests:
```bash
locust -f server/tests/load/locustfile.py \
    --host=http://localhost:3001 \
    --headless \
    --users 50 \
    --spawn-rate 5 \
    --run-time 5m \
    --html=load_test_report.html
```

## Test Scenarios

### DraftSessionUser (weight: 3)
Simulates users actively participating in a draft:
- Views division list (10x frequency)
- Views full division detail (5x)
- Views draft state (3x)
- Makes draft picks (2x)

### DivisionBrowserUser (weight: 2)
Simulates spectators browsing divisions:
- Views division list (5x)
- Views division summary (3x)
- Views full division detail (2x)

### HealthCheckUser (weight: 1)
Simple health check pings for baseline.

## Performance Targets

| Endpoint | Target p95 |
|----------|------------|
| Draft pick | < 500ms |
| Division list | < 200ms |
| Division detail (full) | < 500ms |

## Interpreting Results

Key metrics to watch:
- **Response time p95**: Should meet targets above
- **Failure rate**: Should be < 1% under normal load
- **Requests/sec**: Baseline for capacity planning

If response times degrade significantly under load, check:
1. Database query performance (enable query logging)
2. Connection pool exhaustion
3. API server CPU/memory usage
