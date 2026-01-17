import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


# -----------------------------------------------------------------------------
# Tenant (League) Model
# -----------------------------------------------------------------------------


class League(models.Model):
    """Tenant model - represents a Little League organization."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "leagues"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


# -----------------------------------------------------------------------------
# Custom User Model
# -----------------------------------------------------------------------------


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "master_admin")
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model with email authentication and tenant membership."""

    ROLE_CHOICES = [
        ("master_admin", "Master Admin"),
        ("user", "User"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="user")
    league = models.ForeignKey(
        League,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="users",
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"
        ordering = ["-created_at"]

    def __str__(self):
        return self.email


# -----------------------------------------------------------------------------
# Tenant-aware QuerySet and Manager
# -----------------------------------------------------------------------------


class TenantQuerySet(models.QuerySet):
    """QuerySet that supports tenant filtering."""

    def for_league(self, league):
        if league is None:
            return self.none()
        return self.filter(league=league)


class TenantManager(models.Manager):
    """Manager that supports tenant filtering."""

    def get_queryset(self):
        return TenantQuerySet(self.model, using=self._db)

    def for_league(self, league):
        return self.get_queryset().for_league(league)


# -----------------------------------------------------------------------------
# Division Model
# -----------------------------------------------------------------------------


class Division(models.Model):
    """Top-level container for a draft."""

    PRESET_CHOICES = [
        ("majors", "Majors"),
        ("aaa", "AAA"),
        ("aa", "AA"),
        ("custom", "Custom"),
    ]

    PHASE_CHOICES = [
        ("upload", "Upload"),
        ("mapping", "Mapping"),
        ("review", "Review"),
        ("config", "Config"),
        ("draft", "Draft"),
        ("complete", "Complete"),
    ]

    SCORING_MODE_CHOICES = [
        ("raw", "Raw"),
        ("pre-weighted", "Pre-weighted"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    league = models.ForeignKey(
        League,
        on_delete=models.CASCADE,
        related_name="divisions",
        null=True,  # Temporary for migration
        blank=True,
    )
    name = models.CharField(max_length=100)
    preset = models.CharField(max_length=20, choices=PRESET_CHOICES)
    age_range_min = models.IntegerField()
    age_range_max = models.IntegerField()
    enforce_age_limit = models.BooleanField(default=True)
    max_per_age = models.IntegerField(default=0)
    team_count = models.IntegerField()
    roster_size = models.IntegerField(default=0)
    phase = models.CharField(max_length=20, choices=PHASE_CHOICES, default="upload")

    # Scoring configuration stored as JSON
    scoring_weights = models.JSONField(default=dict)
    scoring_mode = models.CharField(
        max_length=20, choices=SCORING_MODE_CHOICES, default="pre-weighted"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Use tenant-aware manager
    objects = TenantManager()

    class Meta:
        db_table = "divisions"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


# -----------------------------------------------------------------------------
# Team Model
# -----------------------------------------------------------------------------


class Team(models.Model):
    """Team within a division."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    division = models.ForeignKey(
        Division, on_delete=models.CASCADE, related_name="teams"
    )
    name = models.CharField(max_length=100, blank=True)
    draft_position = models.IntegerField()
    total_score = models.FloatField(default=0)

    # Assistant coaches stored as JSON array
    assistant_coaches = models.JSONField(default=list)

    # Age breakdown stored as JSON: {"10": 3, "11": 4, "12": 2}
    age_breakdown = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "teams"
        ordering = ["draft_position"]

    def __str__(self):
        return self.name or f"Team {self.draft_position}"


class Player(models.Model):
    """Player in a division."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    division = models.ForeignKey(
        Division, on_delete=models.CASCADE, related_name="players"
    )
    bib = models.CharField(max_length=20)  # Unique ID from evaluation day
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    name = models.CharField(max_length=200)  # Full name

    # Raw Component Scores
    field_score = models.FloatField(default=0)
    throw_score = models.FloatField(default=0)
    hit_power = models.FloatField(default=0)
    hit_form = models.FloatField(default=0)
    hit_contact = models.FloatField(default=0)
    pitching_strength = models.FloatField(default=0)
    pitching_form = models.FloatField(default=0)
    catch_score = models.FloatField(default=0)
    running_score = models.FloatField(default=0)

    # Calculated Subtotals
    fielding_subtotal = models.FloatField(default=0)
    hitting_subtotal = models.FloatField(default=0)
    pitching_subtotal = models.FloatField(default=0)
    subjective_total = models.FloatField(default=0)
    objective_total = models.FloatField(default=0)
    official_adjust = models.FloatField(default=0)

    # Totals and ranking
    total_score = models.FloatField(default=0)
    rank = models.IntegerField(default=0)
    projected_round = models.IntegerField(default=1)

    # Player Info
    little_league_age = models.IntegerField()
    birthday = models.CharField(max_length=20)
    is_all_star = models.BooleanField(default=False)
    is_dne = models.BooleanField(default=False)  # Did Not Evaluate

    # Draft Rules
    is_coach_kid = models.BooleanField(default=False)
    coach_team = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coach_kids",
    )
    sibling = models.CharField(max_length=200, blank=True)  # Display name of sibling
    sibling_id = models.UUIDField(null=True, blank=True)  # ID of linked sibling

    # Locked assignments
    locked_to_round = models.IntegerField(null=True, blank=True)
    locked_to_team = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="locked_players",
    )

    # Draft Status
    is_drafted = models.BooleanField(default=False)
    drafted_by_team = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="roster",
    )
    drafted_in_round = models.IntegerField(null=True, blank=True)
    drafted_at_pick = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "players"
        ordering = ["rank"]
        constraints = [
            models.UniqueConstraint(
                fields=["division", "bib"], name="unique_player_bib_per_division"
            )
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Auto-generate full name
        self.name = f"{self.first_name} {self.last_name}"
        super().save(*args, **kwargs)


class DraftState(models.Model):
    """Draft state for a division."""

    DRAFT_FORMAT_CHOICES = [
        ("straight", "Straight"),
        ("snake", "Snake"),
        ("recalculated", "Recalculated"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    division = models.OneToOneField(
        Division, on_delete=models.CASCADE, related_name="draft_state"
    )

    draft_format = models.CharField(max_length=20, choices=DRAFT_FORMAT_CHOICES)

    # Draft order stored as JSON arrays of team IDs
    draft_order = models.JSONField(default=list)
    current_round_order = models.JSONField(default=list)

    current_round = models.IntegerField(default=1)
    current_pick_in_round = models.IntegerField(default=1)
    current_team = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="current_for_draft",
    )
    is_draft_complete = models.BooleanField(default=False)

    # Mandatory pick info
    mandatory_player = models.ForeignKey(
        Player,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mandatory_for_draft",
    )
    mandatory_reason = models.CharField(max_length=20, blank=True)
    mandatory_sibling_name = models.CharField(max_length=200, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "draft_states"

    def __str__(self):
        return f"Draft for {self.division.name}"


class DraftPick(models.Model):
    """Individual draft picks."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    draft_state = models.ForeignKey(
        DraftState, on_delete=models.CASCADE, related_name="picks"
    )

    round = models.IntegerField()
    pick = models.IntegerField()  # Overall pick number
    team_id = models.UUIDField()
    player_id = models.UUIDField(null=True, blank=True)
    was_skipped = models.BooleanField(default=False)

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "draft_picks"
        ordering = ["pick"]
        constraints = [
            models.UniqueConstraint(
                fields=["draft_state", "round", "pick"],
                name="unique_pick_per_draft_round",
            )
        ]

    def __str__(self):
        return f"Round {self.round}, Pick {self.pick}"


class Trade(models.Model):
    """Post-draft trades."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    draft_state = models.ForeignKey(
        DraftState, on_delete=models.CASCADE, related_name="trades"
    )

    team1_id = models.UUIDField()
    team2_id = models.UUIDField()
    player1_id = models.UUIDField()  # Moving FROM team1 TO team2
    player2_id = models.UUIDField()  # Moving FROM team2 TO team1
    reason = models.TextField()

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "trades"
        ordering = ["timestamp"]

    def __str__(self):
        return f"Trade at {self.timestamp}"
