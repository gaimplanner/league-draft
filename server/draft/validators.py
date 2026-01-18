"""
Custom password validators matching gaimplan_b2b requirements.
"""

import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class StrongPasswordValidator:
    """
    Validate that the password meets strength requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    """

    def validate(self, password, user=None):
        errors = []

        if len(password) < 8:
            errors.append(_("Password must be at least 8 characters long."))

        if not re.search(r"[A-Z]", password):
            errors.append(_("Password must contain at least one uppercase letter."))

        if not re.search(r"[a-z]", password):
            errors.append(_("Password must contain at least one lowercase letter."))

        if not re.search(r"\d", password):
            errors.append(_("Password must contain at least one number."))

        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return _(
            "Your password must be at least 8 characters long and contain "
            "at least one uppercase letter, one lowercase letter, and one number."
        )
