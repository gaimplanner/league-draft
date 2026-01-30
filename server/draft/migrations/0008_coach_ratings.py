import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('draft', '0007_evaluation_templates'),
    ]

    operations = [
        migrations.CreateModel(
            name='CoachRating',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('player_first_name', models.CharField(max_length=100)),
                ('player_last_name', models.CharField(max_length=100)),
                ('player_id', models.UUIDField(blank=True, null=True)),
                ('scores', models.JSONField(default=dict)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('submitted', 'Submitted')], default='draft', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('submitted_at', models.DateTimeField(blank=True, null=True)),
                ('coach', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coach_ratings', to=settings.AUTH_USER_MODEL)),
                ('season', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coach_ratings', to='draft.season')),
            ],
            options={
                'db_table': 'coach_ratings',
                'ordering': ['player_last_name', 'player_first_name'],
            },
        ),
        migrations.AddConstraint(
            model_name='coachrating',
            constraint=models.UniqueConstraint(
                fields=('season', 'coach', 'player_first_name', 'player_last_name'),
                name='unique_coach_rating_per_player_season',
            ),
        ),
    ]
