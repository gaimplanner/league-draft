"""
Input validation functions (replaces DRF serializer validation).

These functions validate request data and return cleaned data or errors.
"""

import re
import uuid as uuid_module
from typing import Any, Dict, List, Optional, Tuple

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email as django_validate_email

User = get_user_model()


def validate_email(
    email: str, exclude_user_id: Optional[uuid_module.UUID] = None
) -> Tuple[Optional[str], Optional[str]]:
    """
    Validate an email address.

    Returns:
        (cleaned_email, None) on success
        (None, error_message) on failure
    """
    if not email:
        return None, "Email is required"

    email = email.strip().lower()

    try:
        django_validate_email(email)
    except DjangoValidationError:
        return None, "Enter a valid email address"

    # Check uniqueness
    queryset = User.objects.filter(email__iexact=email)
    if exclude_user_id:
        queryset = queryset.exclude(pk=exclude_user_id)
    if queryset.exists():
        return None, "A user with this email already exists"

    return email, None


def validate_password_strength(password: str) -> Tuple[bool, List[str]]:
    """
    Validate password meets strength requirements.

    Returns:
        (is_valid, list_of_errors)
    """
    if not password:
        return False, ["Password is required"]

    errors = []
    try:
        validate_password(password)
    except DjangoValidationError as e:
        errors = list(e.messages)

    return len(errors) == 0, errors


def validate_register_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate user registration data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    # Email validation
    email = data.get("email", "")
    cleaned_email, email_error = validate_email(email)
    if email_error:
        errors["email"] = [email_error]

    # Password validation
    password = data.get("password", "")
    is_valid, password_errors = validate_password_strength(password)
    if not is_valid:
        errors["password"] = password_errors

    if errors:
        return None, errors

    return {
        "email": cleaned_email,
        "password": password,
        "first_name": data.get("first_name", "").strip(),
        "last_name": data.get("last_name", "").strip(),
        "league_name": data.get("league_name", "").strip(),
        "league_slug": data.get("league_slug", "").strip(),
    }, None


def validate_login_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate login data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    email = data.get("email", "")
    if not email:
        errors["email"] = ["Email is required"]

    password = data.get("password", "")
    if not password:
        errors["password"] = ["Password is required"]

    if errors:
        return None, errors

    return {
        "email": email.strip().lower(),
        "password": password,
    }, None


def validate_profile_update_data(
    data: Dict[str, Any], user
) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate profile update data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    cleaned = {}
    errors = {}

    if "first_name" in data:
        first_name = data["first_name"]
        if first_name is not None and len(str(first_name)) > 150:
            errors["first_name"] = ["First name must be 150 characters or less"]
        else:
            cleaned["first_name"] = str(first_name).strip() if first_name else ""

    if "last_name" in data:
        last_name = data["last_name"]
        if last_name is not None and len(str(last_name)) > 150:
            errors["last_name"] = ["Last name must be 150 characters or less"]
        else:
            cleaned["last_name"] = str(last_name).strip() if last_name else ""

    if "email" in data:
        email = data["email"]
        cleaned_email, email_error = validate_email(email, exclude_user_id=user.pk)
        if email_error:
            errors["email"] = [email_error]
        else:
            cleaned["email"] = cleaned_email

    if errors:
        return None, errors

    return cleaned, None


def validate_change_password_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate change password data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    current_password = data.get("current_password", "")
    if not current_password:
        errors["current_password"] = ["Current password is required"]

    new_password = data.get("new_password", "")
    is_valid, password_errors = validate_password_strength(new_password)
    if not is_valid:
        errors["new_password"] = password_errors

    if errors:
        return None, errors

    return {
        "current_password": current_password,
        "new_password": new_password,
    }, None


def validate_password_reset_request_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate password reset request data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    email = data.get("email", "")
    if not email:
        return None, {"email": ["Email is required"]}

    try:
        django_validate_email(email)
    except DjangoValidationError:
        return None, {"email": ["Enter a valid email address"]}

    return {"email": email.strip().lower()}, None


def validate_password_reset_confirm_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate password reset confirmation data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    uid = data.get("uid", "")
    if not uid:
        errors["uid"] = ["UID is required"]

    token = data.get("token", "")
    if not token:
        errors["token"] = ["Token is required"]

    new_password = data.get("new_password", "")
    is_valid, password_errors = validate_password_strength(new_password)
    if not is_valid:
        errors["new_password"] = password_errors

    if errors:
        return None, errors

    return {
        "uid": uid,
        "token": token,
        "new_password": new_password,
    }, None


def validate_uuid_field(value: Any, field_name: str = "id") -> Tuple[Optional[uuid_module.UUID], Optional[str]]:
    """
    Validate a UUID field.

    Returns:
        (uuid, None) on success
        (None, error_message) on failure
    """
    if value is None:
        return None, f"{field_name} is required"
    try:
        if isinstance(value, uuid_module.UUID):
            return value, None
        return uuid_module.UUID(str(value)), None
    except (ValueError, AttributeError):
        return None, f"Invalid {field_name}"


def validate_division_create_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate division creation data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    # Name
    name = data.get("name", "")
    if not name:
        errors["name"] = ["Name is required"]
    elif len(name) > 100:
        errors["name"] = ["Name must be 100 characters or less"]

    # Preset
    preset = data.get("preset", "")
    valid_presets = ["majors", "aaa", "aa", "custom"]
    if not preset:
        errors["preset"] = ["Preset is required"]
    elif preset not in valid_presets:
        errors["preset"] = [f"Invalid preset. Must be one of: {', '.join(valid_presets)}"]

    # Age range
    age_range = data.get("age_range", {})
    if not isinstance(age_range, dict):
        errors["age_range"] = ["Age range must be an object with min and max"]
    elif "min" not in age_range or "max" not in age_range:
        errors["age_range"] = ["Age range must include min and max"]
    else:
        try:
            age_min = int(age_range["min"])
            age_max = int(age_range["max"])
            if age_min < 0 or age_max < 0:
                errors["age_range"] = ["Age values must be non-negative"]
            elif age_min > age_max:
                errors["age_range"] = ["Min age cannot be greater than max age"]
        except (ValueError, TypeError):
            errors["age_range"] = ["Age values must be integers"]

    # Team count
    team_count = data.get("team_count")
    if team_count is None:
        errors["team_count"] = ["Team count is required"]
    else:
        try:
            team_count = int(team_count)
            if team_count < 2 or team_count > 12:
                errors["team_count"] = ["Team count must be between 2 and 12"]
        except (ValueError, TypeError):
            errors["team_count"] = ["Team count must be an integer"]

    # Scoring mode
    scoring_mode = data.get("scoring_mode", "pre-weighted")
    valid_modes = ["raw", "pre-weighted"]
    if scoring_mode not in valid_modes:
        errors["scoring_mode"] = [f"Invalid scoring mode. Must be one of: {', '.join(valid_modes)}"]

    # Division mode (live-draft vs league-generated)
    mode = data.get("mode", "live-draft")
    valid_division_modes = ["live-draft", "league-generated"]
    if mode not in valid_division_modes:
        errors["mode"] = [f"Invalid mode. Must be one of: {', '.join(valid_division_modes)}"]

    # Coaches (optional array of { headCoach, assistantCoach })
    coaches = data.get("coaches", [])
    if coaches and not isinstance(coaches, list):
        errors["coaches"] = ["Coaches must be a list"]

    if errors:
        return None, errors

    return {
        "name": name.strip(),
        "preset": preset,
        "age_range": age_range,
        "enforce_age_limit": bool(data.get("enforce_age_limit", True)),
        "max_per_age": int(data.get("max_per_age", 0)),
        "team_count": int(team_count),
        "scoring_weights": data.get("scoring_weights", {}),
        "scoring_mode": scoring_mode,
        "mode": mode,
        "coaches": coaches if isinstance(coaches, list) else [],
    }, None


def validate_division_update_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate division update data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    cleaned = {}
    errors = {}

    if "name" in data:
        name = data["name"]
        if len(str(name)) > 100:
            errors["name"] = ["Name must be 100 characters or less"]
        else:
            cleaned["name"] = str(name).strip()

    if "preset" in data:
        preset = data["preset"]
        valid_presets = ["majors", "aaa", "aa", "custom"]
        if preset not in valid_presets:
            errors["preset"] = [f"Invalid preset. Must be one of: {', '.join(valid_presets)}"]
        else:
            cleaned["preset"] = preset

    if "age_range" in data:
        age_range = data["age_range"]
        if not isinstance(age_range, dict):
            errors["age_range"] = ["Age range must be an object with min and max"]
        else:
            try:
                if "min" in age_range:
                    cleaned["age_range_min"] = int(age_range["min"])
                if "max" in age_range:
                    cleaned["age_range_max"] = int(age_range["max"])
            except (ValueError, TypeError):
                errors["age_range"] = ["Age values must be integers"]

    if "enforce_age_limit" in data:
        cleaned["enforce_age_limit"] = bool(data["enforce_age_limit"])

    if "max_per_age" in data:
        try:
            cleaned["max_per_age"] = int(data["max_per_age"])
        except (ValueError, TypeError):
            errors["max_per_age"] = ["Max per age must be an integer"]

    if "team_count" in data:
        try:
            team_count = int(data["team_count"])
            if team_count < 2 or team_count > 12:
                errors["team_count"] = ["Team count must be between 2 and 12"]
            else:
                cleaned["team_count"] = team_count
        except (ValueError, TypeError):
            errors["team_count"] = ["Team count must be an integer"]

    if "roster_size" in data:
        try:
            cleaned["roster_size"] = int(data["roster_size"])
        except (ValueError, TypeError):
            errors["roster_size"] = ["Roster size must be an integer"]

    if "scoring_weights" in data:
        cleaned["scoring_weights"] = data["scoring_weights"]

    if "scoring_mode" in data:
        scoring_mode = data["scoring_mode"]
        valid_modes = ["raw", "pre-weighted"]
        if scoring_mode not in valid_modes:
            errors["scoring_mode"] = [f"Invalid scoring mode. Must be one of: {', '.join(valid_modes)}"]
        else:
            cleaned["scoring_mode"] = scoring_mode

    if "phase" in data:
        phase = data["phase"]
        valid_phases = ["upload", "mapping", "review", "config", "draft", "complete"]
        if phase not in valid_phases:
            errors["phase"] = [f"Invalid phase. Must be one of: {', '.join(valid_phases)}"]
        else:
            cleaned["phase"] = phase

    # Mode is immutable after creation - reject any attempt to change it
    if "mode" in data:
        errors["mode"] = ["Division mode cannot be changed after creation"]

    if errors:
        return None, errors

    return cleaned, None


def validate_team_update_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate team update data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    cleaned = {}
    errors = {}

    if "name" in data:
        cleaned["name"] = str(data["name"]).strip() if data["name"] else ""

    if "head_coach" in data:
        cleaned["head_coach"] = str(data["head_coach"]).strip() if data["head_coach"] else ""

    if "assistant_coach" in data:
        cleaned["assistant_coach"] = str(data["assistant_coach"]).strip() if data["assistant_coach"] else ""

    if "draft_position" in data:
        try:
            cleaned["draft_position"] = int(data["draft_position"])
        except (ValueError, TypeError):
            errors["draft_position"] = ["Draft position must be an integer"]

    if "total_score" in data:
        try:
            cleaned["total_score"] = float(data["total_score"])
        except (ValueError, TypeError):
            errors["total_score"] = ["Total score must be a number"]

    if "age_breakdown" in data:
        if not isinstance(data["age_breakdown"], dict):
            errors["age_breakdown"] = ["Age breakdown must be an object"]
        else:
            cleaned["age_breakdown"] = data["age_breakdown"]

    if errors:
        return None, errors

    return cleaned, None


def validate_player_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate player data for creation/update.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    # Required fields
    bib = data.get("bib", "")
    if not bib:
        errors["bib"] = ["Bib is required"]
    elif len(str(bib)) > 50:
        errors["bib"] = ["Bib must be 50 characters or less"]

    first_name = data.get("first_name", "")
    if not first_name:
        errors["first_name"] = ["First name is required"]
    elif len(str(first_name)) > 100:
        errors["first_name"] = ["First name must be 100 characters or less"]

    last_name = data.get("last_name", "")
    if not last_name:
        errors["last_name"] = ["Last name is required"]
    elif len(str(last_name)) > 100:
        errors["last_name"] = ["Last name must be 100 characters or less"]

    # Age
    little_league_age = data.get("little_league_age")
    if little_league_age is None:
        errors["little_league_age"] = ["Little League age is required"]
    else:
        try:
            little_league_age = int(little_league_age)
            if little_league_age < 0 or little_league_age > 18:
                errors["little_league_age"] = ["Little League age must be between 0 and 18"]
        except (ValueError, TypeError):
            errors["little_league_age"] = ["Little League age must be an integer"]

    if errors:
        return None, errors

    # Build cleaned data with defaults
    cleaned = {
        "bib": str(bib).strip(),
        "first_name": str(first_name).strip(),
        "last_name": str(last_name).strip(),
        "little_league_age": int(little_league_age),
        "field_score": float(data.get("field_score", 0)),
        "throw_score": float(data.get("throw_score", 0)),
        "hit_power": float(data.get("hit_power", 0)),
        "hit_form": float(data.get("hit_form", 0)),
        "hit_contact": float(data.get("hit_contact", 0)),
        "pitching_strength": float(data.get("pitching_strength", 0)),
        "pitching_form": float(data.get("pitching_form", 0)),
        "catch_score": float(data.get("catch_score", 0)),
        "running_score": float(data.get("running_score", 0)),
        "fielding_subtotal": float(data.get("fielding_subtotal", 0)),
        "hitting_subtotal": float(data.get("hitting_subtotal", 0)),
        "pitching_subtotal": float(data.get("pitching_subtotal", 0)),
        "subjective_total": float(data.get("subjective_total", 0)),
        "objective_total": float(data.get("objective_total", 0)),
        "official_adjust": float(data.get("official_adjust", 0)),
        "total_score": float(data.get("total_score", 0)),
        "rank": int(data.get("rank", 0)),
        "projected_round": int(data.get("projected_round", 0)),
        "birthday": str(data.get("birthday", "")),
        "is_all_star": bool(data.get("is_all_star", False)),
        "is_dne": bool(data.get("is_dne", False)),
        "is_coach_kid": bool(data.get("is_coach_kid", False)),
        "sibling": str(data.get("sibling", "")),
    }

    # Optional UUID fields
    for field in ["coach_team_id", "sibling_id", "locked_to_team_id", "drafted_by_team_id"]:
        if field in data and data[field]:
            try:
                cleaned[field] = uuid_module.UUID(str(data[field]))
            except (ValueError, AttributeError):
                # Invalid UUID - skip
                pass

    # Optional integer fields
    for field in ["locked_to_round", "drafted_in_round", "drafted_at_pick"]:
        if field in data and data[field] is not None:
            try:
                cleaned[field] = int(data[field])
            except (ValueError, TypeError):
                pass

    # Draft status
    if "is_drafted" in data:
        cleaned["is_drafted"] = bool(data["is_drafted"])

    return cleaned, None


def validate_bulk_players_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate bulk player creation data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    # Division ID
    division_id = data.get("division_id")
    if not division_id:
        errors["division_id"] = ["Division ID is required"]
    else:
        parsed_id, id_error = validate_uuid_field(division_id, "division_id")
        if id_error:
            errors["division_id"] = [id_error]

    # Players array
    players = data.get("players", [])
    if not isinstance(players, list):
        errors["players"] = ["Players must be a list"]
    elif not players:
        errors["players"] = ["At least one player is required"]

    if errors:
        return None, errors

    # Validate each player (just basic validation, full validation in bulk create)
    cleaned_players = []
    for i, player_data in enumerate(players):
        cleaned, player_errors = validate_player_data(player_data)
        if player_errors:
            errors[f"players[{i}]"] = player_errors
        else:
            # Preserve original ID for sibling mapping
            if "id" in player_data:
                cleaned["id"] = player_data["id"]
            cleaned_players.append(cleaned)

    if errors:
        return None, errors

    return {
        "division_id": parsed_id,
        "players": cleaned_players,
    }, None


def validate_draft_start_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate draft start data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    # Division ID
    division_id = data.get("division_id")
    if not division_id:
        errors["division_id"] = ["Division ID is required"]
    else:
        parsed_id, id_error = validate_uuid_field(division_id, "division_id")
        if id_error:
            errors["division_id"] = [id_error]

    # Draft format
    draft_format = data.get("draft_format", "")
    valid_formats = ["straight", "snake", "recalculated"]
    if not draft_format:
        errors["draft_format"] = ["Draft format is required"]
    elif draft_format not in valid_formats:
        errors["draft_format"] = [f"Invalid format. Must be one of: {', '.join(valid_formats)}"]

    # Draft order
    draft_order = data.get("draft_order", [])
    if not isinstance(draft_order, list):
        errors["draft_order"] = ["Draft order must be a list of team IDs"]
    elif not draft_order:
        errors["draft_order"] = ["Draft order is required"]
    else:
        parsed_order = []
        for i, team_id in enumerate(draft_order):
            parsed_team_id, team_error = validate_uuid_field(team_id, f"draft_order[{i}]")
            if team_error:
                errors[f"draft_order[{i}]"] = [team_error]
            else:
                parsed_order.append(parsed_team_id)

    if errors:
        return None, errors

    return {
        "division_id": parsed_id,
        "draft_format": draft_format,
        "draft_order": parsed_order,
    }, None


def validate_draft_pick_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate draft pick data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    draft_state_id, state_error = validate_uuid_field(data.get("draft_state_id"), "draft_state_id")
    if state_error:
        errors["draft_state_id"] = [state_error]

    player_id, player_error = validate_uuid_field(data.get("player_id"), "player_id")
    if player_error:
        errors["player_id"] = [player_error]

    team_id, team_error = validate_uuid_field(data.get("team_id"), "team_id")
    if team_error:
        errors["team_id"] = [team_error]

    if errors:
        return None, errors

    return {
        "draft_state_id": draft_state_id,
        "player_id": player_id,
        "team_id": team_id,
    }, None


def validate_undo_pick_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate undo pick data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    draft_state_id, state_error = validate_uuid_field(data.get("draft_state_id"), "draft_state_id")
    if state_error:
        return None, {"draft_state_id": [state_error]}

    return {"draft_state_id": draft_state_id}, None


def validate_skip_pick_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate skip pick data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    draft_state_id, state_error = validate_uuid_field(data.get("draft_state_id"), "draft_state_id")
    if state_error:
        errors["draft_state_id"] = [state_error]

    team_id, team_error = validate_uuid_field(data.get("team_id"), "team_id")
    if team_error:
        errors["team_id"] = [team_error]

    if errors:
        return None, errors

    return {
        "draft_state_id": draft_state_id,
        "team_id": team_id,
    }, None


def validate_trade_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate trade data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    draft_state_id, state_error = validate_uuid_field(data.get("draft_state_id"), "draft_state_id")
    if state_error:
        errors["draft_state_id"] = [state_error]

    team1_id, team1_error = validate_uuid_field(data.get("team1_id"), "team1_id")
    if team1_error:
        errors["team1_id"] = [team1_error]

    team2_id, team2_error = validate_uuid_field(data.get("team2_id"), "team2_id")
    if team2_error:
        errors["team2_id"] = [team2_error]

    player1_id, player1_error = validate_uuid_field(data.get("player1_id"), "player1_id")
    if player1_error:
        errors["player1_id"] = [player1_error]

    player2_id, player2_error = validate_uuid_field(data.get("player2_id"), "player2_id")
    if player2_error:
        errors["player2_id"] = [player2_error]

    reason = data.get("reason", "")
    if not reason:
        errors["reason"] = ["Reason is required"]

    if errors:
        return None, errors

    return {
        "draft_state_id": draft_state_id,
        "team1_id": team1_id,
        "team2_id": team2_id,
        "player1_id": player1_id,
        "player2_id": player2_id,
        "reason": str(reason),
    }, None


def validate_invitation_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate invitation creation data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}

    email = data.get("email", "")
    if not email:
        errors["email"] = ["Email is required"]
    else:
        try:
            django_validate_email(email)
        except DjangoValidationError:
            errors["email"] = ["Enter a valid email address"]

    role = data.get("role", "member")
    valid_roles = ["admin", "member"]
    if role not in valid_roles:
        errors["role"] = [f"Invalid role. Must be one of: {', '.join(valid_roles)}"]

    if errors:
        return None, errors

    return {
        "email": email.strip().lower(),
        "role": role,
    }, None


def validate_accept_invitation_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate accept invitation data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    token = data.get("token", "")
    if not token:
        return None, {"token": ["Token is required"]}

    return {"token": token}, None


def validate_member_role_data(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate member role update data.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    role = data.get("role", "")
    valid_roles = ["admin", "member"]
    if not role:
        return None, {"role": ["Role is required"]}
    if role not in valid_roles:
        return None, {"role": [f"Invalid role. Must be one of: {', '.join(valid_roles)}"]}

    return {"role": role}, None


# -----------------------------------------------------------------------------
# Team Builder Validators
# -----------------------------------------------------------------------------


def validate_team_builder_config(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate team builder configuration.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    errors = {}
    result = {}

    # balanceTolerance -> balance_tolerance (0.05 to 0.25)
    if "balanceTolerance" in data:
        bt = data["balanceTolerance"]
        if not isinstance(bt, (int, float)):
            errors["balanceTolerance"] = ["Must be a number"]
        elif bt < 0.05 or bt > 0.25:
            errors["balanceTolerance"] = ["Must be between 0.05 and 0.25"]
        else:
            result["balance_tolerance"] = float(bt)

    # topTalentRounds -> top_talent_rounds (1 to 5)
    if "topTalentRounds" in data:
        ttr = data["topTalentRounds"]
        if not isinstance(ttr, int):
            errors["topTalentRounds"] = ["Must be an integer"]
        elif ttr < 1 or ttr > 5:
            errors["topTalentRounds"] = ["Must be between 1 and 5"]
        else:
            result["top_talent_rounds"] = ttr

    # maxRosterSize -> max_roster_size (8 to 20)
    if "maxRosterSize" in data:
        mrs = data["maxRosterSize"]
        if not isinstance(mrs, int):
            errors["maxRosterSize"] = ["Must be an integer"]
        elif mrs < 8 or mrs > 20:
            errors["maxRosterSize"] = ["Must be between 8 and 20"]
        else:
            result["max_roster_size"] = mrs

    # prioritizeBalance -> prioritize_balance (boolean)
    if "prioritizeBalance" in data:
        pb = data["prioritizeBalance"]
        if not isinstance(pb, bool):
            errors["prioritizeBalance"] = ["Must be a boolean"]
        else:
            result["prioritize_balance"] = pb

    if errors:
        return None, errors

    return result, None


def validate_team_builder_run(data: Dict[str, Any]) -> Tuple[Optional[Dict], Optional[Dict]]:
    """
    Validate team builder run request.

    Returns:
        (cleaned_data, None) on success
        (None, errors) on failure
    """
    result = {}

    # Config is optional
    config_data = data.get("config", {})
    if config_data:
        config_result, config_errors = validate_team_builder_config(config_data)
        if config_errors:
            return None, {"config": config_errors}
        result["config"] = config_result

    return result, None
