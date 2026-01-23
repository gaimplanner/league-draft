"""
Structured logging utilities for production observability.

Provides:
- JSON-formatted log output for log aggregation systems
- Request correlation IDs for tracing requests across services
- Context-aware logging with user/league information
"""

import json
import logging
import time
import uuid
from functools import wraps
from typing import Any, Optional


class JSONFormatter(logging.Formatter):
    """
    Formats log records as JSON for easy parsing by log aggregation systems.

    Output format:
    {
        "timestamp": "2025-01-22T10:30:00.123456",
        "level": "INFO",
        "logger": "draft.services",
        "message": "Draft pick made",
        "request_id": "abc123",
        "user_id": "uuid",
        "league_id": "uuid",
        "extra": {...}
    }
    """

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add correlation context if available
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "league_id"):
            log_data["league_id"] = record.league_id

        # Add location info for errors
        if record.levelno >= logging.WARNING:
            log_data["module"] = record.module
            log_data["function"] = record.funcName
            log_data["line"] = record.lineno

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add any extra fields
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in (
                "name", "msg", "args", "created", "filename", "funcName",
                "levelname", "levelno", "lineno", "module", "msecs",
                "pathname", "process", "processName", "relativeCreated",
                "stack_info", "exc_info", "exc_text", "thread", "threadName",
                "request_id", "user_id", "league_id", "message",
            ):
                try:
                    # Ensure value is JSON serializable
                    json.dumps(value)
                    extra_fields[key] = value
                except (TypeError, ValueError):
                    extra_fields[key] = str(value)

        if extra_fields:
            log_data["extra"] = extra_fields

        return json.dumps(log_data)


class RequestContextFilter(logging.Filter):
    """
    Logging filter that adds request context (request_id, user_id, league_id)
    to all log records within a request.

    Context is stored in thread-local storage and set by RequestIDMiddleware.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        # Get context from thread-local storage
        from .middleware import get_request_context
        context = get_request_context()

        record.request_id = context.get("request_id")
        record.user_id = context.get("user_id")
        record.league_id = context.get("league_id")

        return True


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with the request context filter attached.

    Usage:
        logger = get_logger(__name__)
        logger.info("Something happened", extra={"player_id": "123"})
    """
    logger = logging.getLogger(name)

    # Add filter if not already present
    has_filter = any(isinstance(f, RequestContextFilter) for f in logger.filters)
    if not has_filter:
        logger.addFilter(RequestContextFilter())

    return logger


def log_operation(operation_name: str, include_duration: bool = True):
    """
    Decorator to log the start and end of an operation.

    Usage:
        @log_operation("draft_pick")
        def draft_player(cls, draft_state_id, player_id, team_id):
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger = get_logger(func.__module__)

            # Build context from kwargs
            extra = {
                "operation": operation_name,
            }
            # Include relevant IDs from kwargs
            for key in ("draft_state_id", "player_id", "team_id", "division_id"):
                if key in kwargs:
                    extra[key] = str(kwargs[key])

            logger.info(f"Starting {operation_name}", extra=extra)
            start_time = time.time()

            try:
                result = func(*args, **kwargs)

                if include_duration:
                    duration_ms = (time.time() - start_time) * 1000
                    extra["duration_ms"] = round(duration_ms, 2)

                logger.info(f"Completed {operation_name}", extra=extra)
                return result

            except Exception as e:
                if include_duration:
                    duration_ms = (time.time() - start_time) * 1000
                    extra["duration_ms"] = round(duration_ms, 2)
                extra["error"] = str(e)
                extra["error_type"] = type(e).__name__

                logger.error(f"Failed {operation_name}", extra=extra, exc_info=True)
                raise

        return wrapper
    return decorator


# Convenience functions for common log patterns
def log_auth_event(
    event_type: str,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    success: bool = True,
    **extra
):
    """
    Log an authentication event.

    Args:
        event_type: One of "login", "logout", "register", "password_change", "password_reset"
        user_id: User ID if available
        email: Email if available (will be partially masked)
        success: Whether the operation succeeded
        **extra: Additional context
    """
    logger = get_logger("draft.auth")

    log_data = {
        "event_type": event_type,
        "success": success,
        **extra,
    }

    if user_id:
        log_data["target_user_id"] = user_id
    if email:
        # Mask email for privacy: "user@example.com" -> "us**@example.com"
        parts = email.split("@")
        if len(parts) == 2:
            masked = parts[0][:2] + "**@" + parts[1]
            log_data["email_masked"] = masked

    level = logging.INFO if success else logging.WARNING
    logger.log(level, f"Auth event: {event_type}", extra=log_data)


def log_draft_event(
    event_type: str,
    draft_state_id: str,
    **extra
):
    """
    Log a draft event.

    Args:
        event_type: One of "start", "pick", "undo", "skip", "trade", "reset", "complete"
        draft_state_id: The draft state ID
        **extra: Additional context (player_id, team_id, round, pick_number, etc.)
    """
    logger = get_logger("draft.operations")

    log_data = {
        "event_type": event_type,
        "draft_state_id": str(draft_state_id),
        **extra,
    }

    logger.info(f"Draft event: {event_type}", extra=log_data)
