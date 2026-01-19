"""
Management command to create E2E test data.

Creates 3 test organizations with 3 users each (admin, coach, viewer),
and sample divisions with players for end-to-end testing.

Usage:
    python manage.py seed_e2e --reset
"""

import random
from django.core.management.base import BaseCommand
from draft.models import (
    Organization,
    OrganizationMembership,
    User,
    Division,
    Team,
    Player,
)

# Shared password for all test users
TEST_PASSWORD = "TestPassword123!"

# Test organization configurations
TEST_ORGS = [
    {
        "name": "Test League Alpha",
        "slug": "test-alpha",
        "divisions": [
            {"name": "Alpha Majors", "preset": "majors", "age_min": 10, "age_max": 12, "team_count": 8, "roster_size": 12},
            {"name": "Alpha AAA", "preset": "aaa", "age_min": 8, "age_max": 10, "team_count": 6, "roster_size": 12},
            {"name": "Alpha AA", "preset": "aa", "age_min": 7, "age_max": 10, "team_count": 5, "roster_size": 12},
        ],
    },
    {
        "name": "Test League Beta",
        "slug": "test-beta",
        "divisions": [
            {"name": "Beta Majors", "preset": "majors", "age_min": 10, "age_max": 12, "team_count": 8, "roster_size": 12},
            {"name": "Beta AAA", "preset": "aaa", "age_min": 8, "age_max": 10, "team_count": 6, "roster_size": 12},
            {"name": "Beta AA", "preset": "aa", "age_min": 7, "age_max": 10, "team_count": 5, "roster_size": 12},
        ],
    },
    {
        "name": "Test League Gamma",
        "slug": "test-gamma",
        "divisions": [
            {"name": "Gamma Majors", "preset": "majors", "age_min": 10, "age_max": 12, "team_count": 8, "roster_size": 12},
            {"name": "Gamma AAA", "preset": "aaa", "age_min": 8, "age_max": 10, "team_count": 6, "roster_size": 12},
            {"name": "Gamma AA", "preset": "aa", "age_min": 7, "age_max": 10, "team_count": 5, "roster_size": 12},
        ],
    },
]

# Fake first names for players
FIRST_NAMES = [
    "James", "Michael", "Robert", "David", "William", "Richard", "Joseph", "Thomas",
    "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Steven", "Paul", "Andrew",
    "Joshua", "Kenneth", "Kevin", "Brian", "George", "Timothy", "Ronald", "Edward",
    "Jason", "Jeffrey", "Ryan", "Jacob", "Gary", "Nicholas", "Eric", "Jonathan",
    "Stephen", "Larry", "Justin", "Scott", "Brandon", "Benjamin", "Samuel", "Raymond",
    "Gregory", "Frank", "Alexander", "Patrick", "Henry", "Jack", "Dennis", "Jerry",
    "Tyler", "Aaron", "Jose", "Adam", "Nathan", "Henry", "Zachary", "Douglas",
    "Peter", "Kyle", "Noah", "Ethan", "Jeremy", "Walter", "Christian", "Keith",
    "Roger", "Terry", "Harry", "Ralph", "Sean", "Jesse", "Roy", "Louis", "Eugene",
    "Russell", "Bobby", "Philip", "Johnny", "Bradley", "Vincent", "Dylan", "Austin",
]

# Fake last names for players and coaches
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts", "Turner", "Phillips", "Evans", "Parker", "Edwards", "Collins",
]


class Command(BaseCommand):
    help = "Create E2E test data (organizations, users, divisions, players)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing E2E test data before creating new data",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            self._reset_e2e_data()

        for org_config in TEST_ORGS:
            self._create_organization(org_config)

        self._print_summary()

    def _reset_e2e_data(self):
        """Delete all E2E test data."""
        self.stdout.write(self.style.WARNING("Resetting E2E test data..."))

        for org_config in TEST_ORGS:
            slug = org_config["slug"]
            try:
                org = Organization.objects.get(slug=slug)
                # Delete divisions (cascades to teams, players, draft states)
                Division.objects.filter(organization=org).delete()
                # Delete memberships
                OrganizationMembership.objects.filter(organization=org).delete()
                # Delete the organization
                org.delete()
                self.stdout.write(f"  Deleted organization: {slug}")
            except Organization.DoesNotExist:
                pass

        # Delete test users
        for org_config in TEST_ORGS:
            slug = org_config["slug"]
            for role in ["admin", "coach", "viewer"]:
                email = f"{role}@{slug}.test"
                User.objects.filter(email=email).delete()

        self.stdout.write(self.style.SUCCESS("E2E test data reset complete"))

    def _create_organization(self, org_config: dict):
        """Create an organization with users and divisions."""
        slug = org_config["slug"]
        name = org_config["name"]

        # Create organization
        org, created = Organization.objects.get_or_create(
            slug=slug,
            defaults={"name": name},
        )
        status = "Created" if created else "Found existing"
        self.stdout.write(f"{status} organization: {name}")

        # Create users and memberships
        for role in ["admin", "coach", "viewer"]:
            email = f"{role}@{slug}.test"
            user, user_created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": role.capitalize(),
                    "last_name": name.split()[-1],  # e.g., "Alpha"
                },
            )
            if user_created:
                user.set_password(TEST_PASSWORD)
                user.save()
                self.stdout.write(f"  Created user: {email}")

            # Create membership
            OrganizationMembership.objects.get_or_create(
                user=user,
                organization=org,
                defaults={"role": role},
            )

        # Create divisions
        for div_config in org_config["divisions"]:
            self._create_division(org, div_config)

    def _create_division(self, org: Organization, div_config: dict):
        """Create a division with teams and players."""
        division, created = Division.objects.get_or_create(
            organization=org,
            name=div_config["name"],
            defaults={
                "preset": div_config["preset"],
                "age_range_min": div_config["age_min"],
                "age_range_max": div_config["age_max"],
                "team_count": div_config["team_count"],
                "roster_size": div_config["roster_size"],
                "phase": "config",  # Ready for draft setup
            },
        )

        if not created:
            self.stdout.write(f"    Found existing division: {div_config['name']}")
            return

        self.stdout.write(f"    Created division: {div_config['name']}")

        team_count = div_config["team_count"]
        roster_size = div_config["roster_size"]

        # Use consistent coach names per team
        coach_names = random.sample(LAST_NAMES, team_count)

        # Create teams
        teams = []
        for i in range(team_count):
            team = Team.objects.create(
                division=division,
                name=coach_names[i],
                head_coach=coach_names[i],
                assistant_coach=random.choice([n for n in LAST_NAMES if n != coach_names[i]]),
                draft_position=i + 1,
            )
            teams.append(team)

        self.stdout.write(f"      Created {team_count} teams")

        # Create players
        total_players = team_count * roster_size
        age_min = div_config["age_min"]
        age_max = div_config["age_max"]

        # Track used names to avoid duplicates
        used_names = set()
        players = []

        for i in range(total_players):
            # Generate unique name
            while True:
                first = random.choice(FIRST_NAMES)
                last = random.choice(LAST_NAMES)
                full_name = f"{first} {last}"
                if full_name not in used_names:
                    used_names.add(full_name)
                    break

            age = random.randint(age_min, age_max)

            # Generate realistic scores (higher rank = higher scores)
            # Base scores decrease as we go through players
            base_multiplier = 1.0 - (i / total_players) * 0.5  # 1.0 to 0.5

            player = Player.objects.create(
                division=division,
                bib=f"{div_config['preset'][0].upper()}{i + 1:03d}",  # M001, A001, etc.
                first_name=first,
                last_name=last,
                little_league_age=age,
                birthday=f"{2026 - age}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                # Scores
                fielding_subtotal=round(random.uniform(8, 15) * base_multiplier, 1),
                hitting_subtotal=round(random.uniform(8, 15) * base_multiplier, 1),
                pitching_subtotal=round(random.uniform(5, 12) * base_multiplier, 1),
                catch_score=round(random.uniform(3, 8) * base_multiplier, 1),
                running_score=round(random.uniform(3, 8) * base_multiplier, 1),
                official_adjust=round(random.uniform(-2, 2), 1),
            )

            # Calculate totals
            player.subjective_total = player.fielding_subtotal + player.hitting_subtotal + player.pitching_subtotal
            player.objective_total = player.catch_score + player.running_score
            player.total_score = player.subjective_total + player.objective_total + player.official_adjust
            player.save()

            players.append(player)

        # Sort players by score and assign ranks
        players.sort(key=lambda p: p.total_score, reverse=True)
        for rank, player in enumerate(players, 1):
            player.rank = rank
            player.projected_round = ((rank - 1) // team_count) + 1
            player.save()

        # Assign coach kids (one per team, using coach last name matching)
        coach_kids_assigned = 0
        for team in teams:
            # Find a player with the same last name as head coach
            matching_players = [p for p in players if p.last_name == team.head_coach and not p.is_coach_kid]
            if matching_players:
                coach_kid = matching_players[0]
            else:
                # No matching name, pick a random unassigned player from appropriate round
                unassigned = [p for p in players if not p.is_coach_kid]
                if unassigned:
                    coach_kid = random.choice(unassigned[:len(unassigned) // 2])  # From better half
                else:
                    continue

            coach_kid.is_coach_kid = True
            coach_kid.coach_team = team
            coach_kid.save()
            coach_kids_assigned += 1

        self.stdout.write(f"      Created {total_players} players ({coach_kids_assigned} coach kids)")

        # Create sibling pairs (2-3 pairs per division)
        sibling_count = min(3, total_players // 20)
        available_for_siblings = [p for p in players if not p.is_coach_kid and not p.sibling_id]

        for _ in range(sibling_count):
            if len(available_for_siblings) < 2:
                break

            # Pick two players to be siblings
            sib1 = available_for_siblings.pop(random.randrange(len(available_for_siblings)))
            sib2 = available_for_siblings.pop(random.randrange(len(available_for_siblings)))

            # Make them have the same last name
            shared_last = sib1.last_name
            sib2.last_name = shared_last
            sib2.name = f"{sib2.first_name} {shared_last}"

            # Link them
            sib1.sibling_id = sib2.id
            sib1.sibling = sib2.name
            sib2.sibling_id = sib1.id
            sib2.sibling = sib1.name

            sib1.save()
            sib2.save()

        self.stdout.write(f"      Created {sibling_count} sibling pairs")

    def _print_summary(self):
        """Print summary of created test data."""
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("E2E TEST DATA CREATED"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write("")
        self.stdout.write(f"Shared password: {TEST_PASSWORD}")
        self.stdout.write("")

        for org_config in TEST_ORGS:
            slug = org_config["slug"]
            self.stdout.write(f"Organization: {org_config['name']}")
            self.stdout.write(f"  Admin:  admin@{slug}.test")
            self.stdout.write(f"  Coach:  coach@{slug}.test")
            self.stdout.write(f"  Viewer: viewer@{slug}.test")
            self.stdout.write("")

        self.stdout.write(self.style.SUCCESS("=" * 60))
