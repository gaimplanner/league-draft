import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('draft', '0006_add_team_builder_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='EvaluationTemplate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True, default='')),
                ('version', models.IntegerField(default=1)),
                ('stations', models.JSONField(default=list)),
                ('coach_categories', models.JSONField(default=list)),
                ('blend_weights', models.JSONField(default=dict)),
                ('is_active', models.BooleanField(default=True)),
                ('is_locked', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='evaluation_templates', to='draft.organization')),
                ('parent_template', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='child_versions', to='draft.evaluationtemplate')),
            ],
            options={
                'db_table': 'evaluation_templates',
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='evaluationtemplate',
            constraint=models.UniqueConstraint(fields=('organization', 'name', 'version'), name='unique_template_version'),
        ),
        migrations.CreateModel(
            name='Season',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
                ('year', models.IntegerField()),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='seasons', to='draft.organization')),
                ('template', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='seasons', to='draft.evaluationtemplate')),
            ],
            options={
                'db_table': 'seasons',
                'ordering': ['-year', '-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='season',
            constraint=models.UniqueConstraint(fields=('organization', 'name'), name='unique_season_name_per_org'),
        ),
    ]
