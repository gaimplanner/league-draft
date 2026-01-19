# Custom migration for League -> Organization rename
# This migration preserves existing data by:
# 1. Adding new columns/tables first
# 2. Copying data over
# 3. Removing old columns/tables

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrate_memberships(apps, schema_editor):
    """Copy data from old membership table to new one."""
    # This runs after tables exist but before old ones are deleted
    OldMembership = apps.get_model('draft', 'LeagueMembership')
    NewMembership = apps.get_model('draft', 'OrganizationMembership')

    for old in OldMembership.objects.all():
        # Map 'member' role to 'viewer' (new default)
        new_role = old.role if old.role in ('admin', 'coach', 'viewer') else 'viewer'
        NewMembership.objects.create(
            id=old.id,
            user_id=old.user_id,
            organization_id=old.league_id,
            role=new_role,
            created_at=old.created_at,
        )


def migrate_invitations(apps, schema_editor):
    """Copy data from old invitation table to new one."""
    OldInvitation = apps.get_model('draft', 'LeagueInvitation')
    NewInvitation = apps.get_model('draft', 'OrganizationInvitation')

    for old in OldInvitation.objects.all():
        # Map 'member' role to 'viewer' (new default)
        new_role = old.role if old.role in ('admin', 'coach', 'viewer') else 'viewer'
        NewInvitation.objects.create(
            id=old.id,
            organization_id=old.league_id,
            email=old.email,
            token=old.token,
            invited_by_id=old.invited_by_id,
            role=new_role,
            is_link_invite=old.is_link_invite,
            created_at=old.created_at,
            expires_at=old.expires_at,
            accepted_at=old.accepted_at,
        )


def reverse_memberships(apps, schema_editor):
    """Reverse migration for memberships."""
    OldMembership = apps.get_model('draft', 'LeagueMembership')
    NewMembership = apps.get_model('draft', 'OrganizationMembership')

    for new in NewMembership.objects.all():
        # Map back to old roles
        old_role = new.role if new.role in ('admin', 'member') else 'member'
        OldMembership.objects.create(
            id=new.id,
            user_id=new.user_id,
            league_id=new.organization_id,
            role=old_role,
            created_at=new.created_at,
        )


def reverse_invitations(apps, schema_editor):
    """Reverse migration for invitations."""
    OldInvitation = apps.get_model('draft', 'LeagueInvitation')
    NewInvitation = apps.get_model('draft', 'OrganizationInvitation')

    for new in NewInvitation.objects.all():
        old_role = new.role if new.role in ('admin', 'member') else 'member'
        OldInvitation.objects.create(
            id=new.id,
            league_id=new.organization_id,
            email=new.email,
            token=new.token,
            invited_by_id=new.invited_by_id,
            role=old_role,
            is_link_invite=new.is_link_invite,
            created_at=new.created_at,
            expires_at=new.expires_at,
            accepted_at=new.accepted_at,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('draft', '0003_league_join_link_enabled_league_join_link_token_and_more'),
    ]

    operations = [
        # Step 1: Rename League table to organizations
        migrations.AlterModelTable(
            name='league',
            table='organizations',
        ),

        # Step 2: Rename the model
        migrations.RenameModel(
            old_name='League',
            new_name='Organization',
        ),

        # Step 3: Add organization field to Division (but keep league temporarily)
        migrations.RenameField(
            model_name='division',
            old_name='league',
            new_name='organization',
        ),

        # Step 4: Add owner field to Division for personal workspaces
        migrations.AddField(
            model_name='division',
            name='owner',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='personal_divisions',
                to=settings.AUTH_USER_MODEL
            ),
        ),

        # Step 5: Create new OrganizationMembership model
        migrations.CreateModel(
            name='OrganizationMembership',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('role', models.CharField(choices=[('admin', 'Admin'), ('coach', 'Coach'), ('viewer', 'Viewer')], default='viewer', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='memberships', to='draft.organization')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='memberships', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'organization_memberships',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='organizationmembership',
            constraint=models.UniqueConstraint(fields=['user', 'organization'], name='unique_org_membership'),
        ),

        # Step 6: Create new OrganizationInvitation model
        migrations.CreateModel(
            name='OrganizationInvitation',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('email', models.EmailField(blank=True, max_length=254, null=True)),
                ('token', models.CharField(max_length=64, unique=True)),
                ('role', models.CharField(choices=[('admin', 'Admin'), ('coach', 'Coach'), ('viewer', 'Viewer')], default='viewer', max_length=20)),
                ('is_link_invite', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('accepted_at', models.DateTimeField(blank=True, null=True)),
                ('invited_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sent_invitations', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invitations', to='draft.organization')),
            ],
            options={
                'db_table': 'organization_invitations',
                'ordering': ['-created_at'],
            },
        ),

        # Step 7: Migrate data from old tables to new
        migrations.RunPython(migrate_memberships, reverse_memberships),
        migrations.RunPython(migrate_invitations, reverse_invitations),

        # Step 8: Remove old unique constraint from LeagueMembership
        migrations.AlterUniqueTogether(
            name='leaguemembership',
            unique_together=set(),
        ),

        # Step 9: Delete old models
        migrations.DeleteModel(
            name='LeagueInvitation',
        ),
        migrations.DeleteModel(
            name='LeagueMembership',
        ),
    ]
