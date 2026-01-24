"""
Load testing for Little League Draft API using Locust.

Run with:
    locust -f server/tests/load/locustfile.py --host=http://localhost:3001

Then open http://localhost:8089 to start the test.

Test Scenarios:
1. Draft Session - Simulates 8 concurrent users drafting players
2. Division List - Tests division list endpoint under load
3. Full Division Load - Tests division detail with include=all
"""

import json
import random
import uuid
from locust import HttpUser, task, between, events
from locust.exception import StopUser


class DraftSessionUser(HttpUser):
    """Simulates a user participating in a draft session.

    This user type:
    - Logs in
    - Views division list
    - Views full division detail
    - Makes draft picks (when it's their turn)
    - Views draft state updates
    """

    wait_time = between(1, 3)
    weight = 3  # Higher weight = more of these users

    def on_start(self):
        """Set up authentication and get initial state."""
        self.csrf_token = None
        self.session_ready = False
        self.division_id = None
        self.draft_state_id = None
        self.team_id = None
        self.available_players = []

        # Get CSRF token
        response = self.client.get("/api/auth/csrf/")
        if response.status_code == 200:
            # CSRF token is in cookies
            self.csrf_token = response.cookies.get("csrftoken")

        # Try to log in with test credentials
        # Note: You'll need to set up test users in your database
        self._try_login()

    def _try_login(self):
        """Attempt to log in with test credentials."""
        if not self.csrf_token:
            return

        headers = {"X-CSRFToken": self.csrf_token}
        response = self.client.post(
            "/api/auth/login/",
            json={
                "email": f"loadtest{random.randint(1, 10)}@example.com",
                "password": "TestPassword123!",
            },
            headers=headers,
        )

        if response.status_code == 200:
            self.session_ready = True
            # Update CSRF token after login
            if "csrftoken" in response.cookies:
                self.csrf_token = response.cookies.get("csrftoken")

    def _get_headers(self):
        """Get headers with CSRF token."""
        return {"X-CSRFToken": self.csrf_token} if self.csrf_token else {}

    @task(10)
    def view_division_list(self):
        """View the list of divisions."""
        if not self.session_ready:
            return

        response = self.client.get(
            "/api/divisions/",
            headers=self._get_headers(),
            name="/api/divisions/ [list]",
        )

        if response.status_code == 200:
            divisions = response.json()
            if divisions and not self.division_id:
                # Pick a division to work with
                self.division_id = divisions[0].get("id")

    @task(5)
    def view_division_detail(self):
        """View full division detail with all data."""
        if not self.session_ready or not self.division_id:
            return

        response = self.client.get(
            f"/api/divisions/{self.division_id}/?include=all",
            headers=self._get_headers(),
            name="/api/divisions/{id}/?include=all [detail]",
        )

        if response.status_code == 200:
            data = response.json()
            # Extract draft state and available players
            if data.get("draft_state"):
                self.draft_state_id = data["draft_state"].get("id")
                self.team_id = data["draft_state"].get("current_team_id")

            players = data.get("players", [])
            self.available_players = [
                p for p in players if not p.get("is_drafted")
            ]

    @task(3)
    def view_draft_state(self):
        """View the current draft state."""
        if not self.session_ready or not self.division_id:
            return

        response = self.client.get(
            f"/api/draft/{self.division_id}/",
            headers=self._get_headers(),
            name="/api/draft/{division_id}/ [state]",
        )

        if response.status_code == 200:
            data = response.json()
            self.draft_state_id = data.get("id")
            self.team_id = data.get("current_team_id")

    @task(2)
    def make_draft_pick(self):
        """Attempt to make a draft pick (will fail if not team's turn)."""
        if (
            not self.session_ready
            or not self.draft_state_id
            or not self.team_id
            or not self.available_players
        ):
            return

        # Pick a random available player
        player = random.choice(self.available_players)

        response = self.client.post(
            "/api/draft/pick/",
            json={
                "draft_state_id": self.draft_state_id,
                "team_id": self.team_id,
                "player_id": player["id"],
            },
            headers=self._get_headers(),
            name="/api/draft/pick/ [pick]",
        )

        # Remove player from available list if pick succeeded
        if response.status_code == 200:
            self.available_players = [
                p for p in self.available_players if p["id"] != player["id"]
            ]


class DivisionBrowserUser(HttpUser):
    """Simulates a user browsing divisions without active drafting.

    This user type just browses and views data, representing
    spectators or users checking on draft progress.
    """

    wait_time = between(2, 5)
    weight = 2

    def on_start(self):
        """Set up authentication."""
        self.csrf_token = None
        self.session_ready = False
        self.division_ids = []

        response = self.client.get("/api/auth/csrf/")
        if response.status_code == 200:
            self.csrf_token = response.cookies.get("csrftoken")
            self._try_login()

    def _try_login(self):
        """Attempt to log in."""
        if not self.csrf_token:
            return

        headers = {"X-CSRFToken": self.csrf_token}
        response = self.client.post(
            "/api/auth/login/",
            json={
                "email": f"viewer{random.randint(1, 20)}@example.com",
                "password": "TestPassword123!",
            },
            headers=headers,
        )

        if response.status_code == 200:
            self.session_ready = True
            if "csrftoken" in response.cookies:
                self.csrf_token = response.cookies.get("csrftoken")

    def _get_headers(self):
        return {"X-CSRFToken": self.csrf_token} if self.csrf_token else {}

    @task(5)
    def view_division_list(self):
        """View division list."""
        if not self.session_ready:
            return

        response = self.client.get(
            "/api/divisions/",
            headers=self._get_headers(),
            name="/api/divisions/ [list]",
        )

        if response.status_code == 200:
            divisions = response.json()
            self.division_ids = [d["id"] for d in divisions[:5]]

    @task(3)
    def view_division_summary(self):
        """View division summary (without full data)."""
        if not self.session_ready or not self.division_ids:
            return

        division_id = random.choice(self.division_ids)
        self.client.get(
            f"/api/divisions/{division_id}/",
            headers=self._get_headers(),
            name="/api/divisions/{id}/ [summary]",
        )

    @task(2)
    def view_full_division(self):
        """View full division with all data."""
        if not self.session_ready or not self.division_ids:
            return

        division_id = random.choice(self.division_ids)
        self.client.get(
            f"/api/divisions/{division_id}/?include=all",
            headers=self._get_headers(),
            name="/api/divisions/{id}/?include=all [detail]",
        )


class HealthCheckUser(HttpUser):
    """Simple user that just hits health check endpoints.

    Used to establish baseline and verify the system is up.
    """

    wait_time = between(5, 10)
    weight = 1

    @task
    def health_check(self):
        """Hit the health check endpoint."""
        self.client.get("/api/health/", name="/api/health/ [health]")


# Event hooks for custom reporting
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when a load test starts."""
    print("Load test starting...")
    print("Ensure test users exist in database:")
    print("  - loadtest1@example.com through loadtest10@example.com")
    print("  - viewer1@example.com through viewer20@example.com")
    print("  All with password: TestPassword123!")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when a load test stops."""
    print("\nLoad test complete.")
    print("\nPerformance targets:")
    print("  - Draft pick: < 500ms p95")
    print("  - Division list: < 200ms p95")
    print("  - Division detail: < 500ms p95")
