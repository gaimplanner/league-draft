"""
Management command to create Demo League with seed data.
"""

from django.core.management.base import BaseCommand
from draft.models import League, User, Division, Team


class Command(BaseCommand):
    help = "Create Demo League with seed data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing Demo League data before creating new data",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            self._reset_demo_data()

        # Create or get Demo League
        league, created = League.objects.get_or_create(
            slug="demo",
            defaults={"name": "Demo League"},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created league: {league.name}"))
        else:
            self.stdout.write(f"Found existing league: {league.name}")

        # Create demo user
        demo_email = "demo@example.com"
        if not User.objects.filter(email=demo_email).exists():
            user = User.objects.create_user(
                email=demo_email,
                password="Demo1234!",  # Meets password requirements
                first_name="Demo",
                last_name="User",
                league=league,
            )
            self.stdout.write(self.style.SUCCESS(f"Created user: {user.email}"))
        else:
            self.stdout.write(f"Found existing user: {demo_email}")

        # Create sample division
        division, created = Division.objects.get_or_create(
            league=league,
            name="Demo Majors",
            defaults={
                "preset": "majors",
                "age_range_min": 10,
                "age_range_max": 12,
                "team_count": 8,
                "roster_size": 12,
                "phase": "config",
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created division: {division.name}"))
            # Create teams only for new divisions
            for i in range(8):
                Team.objects.get_or_create(
                    division=division,
                    name=f"Team {i + 1}",
                    defaults={"draft_position": i + 1},
                )
            self.stdout.write(self.style.SUCCESS("Created 8 teams"))
        else:
            self.stdout.write(f"Found existing division: {division.name}")

        self.stdout.write(
            self.style.SUCCESS(
                "\nDemo League setup complete!\n"
                f"  League: {league.name} ({league.slug})\n"
                f"  Login: demo@example.com / Demo1234!"
            )
        )

    def _reset_demo_data(self):
        """Delete existing demo data."""
        try:
            league = League.objects.get(slug="demo")
            # Delete all divisions in the league (cascades to teams, players, etc.)
            Division.objects.filter(league=league).delete()
            # Delete all users in the league
            User.objects.filter(league=league).delete()
            # Delete the league itself
            league.delete()
            self.stdout.write(self.style.WARNING("Deleted existing Demo League data"))
        except League.DoesNotExist:
            self.stdout.write("No existing Demo League found to reset")
