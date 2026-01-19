"""
Management command to create Demo Organization with seed data.
"""

from django.core.management.base import BaseCommand
from draft.models import Organization, OrganizationMembership, User, Division, Team


class Command(BaseCommand):
    help = "Create Demo Organization with seed data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing Demo Organization data before creating new data",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            self._reset_demo_data()

        # Create or get Demo Organization
        org, created = Organization.objects.get_or_create(
            slug="demo",
            defaults={"name": "Demo League"},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created organization: {org.name}"))
        else:
            self.stdout.write(f"Found existing organization: {org.name}")

        # Create demo user
        demo_email = "demo@example.com"
        user = User.objects.filter(email=demo_email).first()
        if not user:
            user = User.objects.create_user(
                email=demo_email,
                password="Demo1234!",  # Meets password requirements
                first_name="Demo",
                last_name="User",
            )
            self.stdout.write(self.style.SUCCESS(f"Created user: {user.email}"))
        else:
            self.stdout.write(f"Found existing user: {demo_email}")

        # Create membership if not exists
        membership, m_created = OrganizationMembership.objects.get_or_create(
            user=user,
            organization=org,
            defaults={"role": "admin"},
        )
        if m_created:
            self.stdout.write(self.style.SUCCESS(f"Created membership for {user.email}"))

        # Create sample division
        division, created = Division.objects.get_or_create(
            organization=org,
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
                "\nDemo Organization setup complete!\n"
                f"  Organization: {org.name} ({org.slug})\n"
                f"  Login: demo@example.com / Demo1234!"
            )
        )

    def _reset_demo_data(self):
        """Delete existing demo data."""
        try:
            org = Organization.objects.get(slug="demo")
            # Delete all divisions in the organization (cascades to teams, players, etc.)
            Division.objects.filter(organization=org).delete()
            # Delete memberships
            OrganizationMembership.objects.filter(organization=org).delete()
            # Delete the organization itself
            org.delete()
            self.stdout.write(self.style.WARNING("Deleted existing Demo Organization data"))
        except Organization.DoesNotExist:
            self.stdout.write("No existing Demo Organization found to reset")
