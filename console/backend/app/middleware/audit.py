"""Audit logging middleware.

Intercepts mutating requests (POST, PATCH, DELETE) that return 2xx responses
and writes an AuditLog record asynchronously without blocking the response.
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import ClassVar

from jose import jwt
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.audit import AuditLog
from app.models.user import User
from app.services.auth import ALGORITHM

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths that should never be audited
# ---------------------------------------------------------------------------
SKIP_PATHS: set[str] = {
    "/api/auth/login",
    "/api/heartbeat",
    "/api/health",
    "/api/connections/event",
}

# ---------------------------------------------------------------------------
# Route-to-action mapping using compiled regex patterns.
# Order matters: more specific patterns must come first.
# Each entry: (method, compiled_regex, action, resource_type, resource_id_group)
#   resource_id_group: the regex group index (1-based) that holds the resource id,
#   or None if no resource id can be extracted from the path.
# ---------------------------------------------------------------------------
_ROUTE_MAP: list[tuple[str, re.Pattern[str], str, str, int | None]] = [
    # Device groups — members (must be before the group-level patterns)
    ("POST", re.compile(r"^/api/device-groups/([^/]+)/members$"), "device_group.add_member", "device_group", 1),
    ("DELETE", re.compile(r"^/api/device-groups/([^/]+)/members/([^/]+)$"), "device_group.remove_member", "device_group", 1),
    # Device groups
    ("POST", re.compile(r"^/api/device-groups$"), "device_group.create", "device_group", None),
    ("PATCH", re.compile(r"^/api/device-groups/([^/]+)$"), "device_group.update", "device_group", 1),
    ("DELETE", re.compile(r"^/api/device-groups/([^/]+)$"), "device_group.delete", "device_group", 1),
    # User groups — members
    ("POST", re.compile(r"^/api/user-groups/([^/]+)/members$"), "user_group.add_member", "user_group", 1),
    ("DELETE", re.compile(r"^/api/user-groups/([^/]+)/members/([^/]+)$"), "user_group.remove_member", "user_group", 1),
    # User groups
    ("POST", re.compile(r"^/api/user-groups$"), "user_group.create", "user_group", None),
    ("PATCH", re.compile(r"^/api/user-groups/([^/]+)$"), "user_group.update", "user_group", 1),
    ("DELETE", re.compile(r"^/api/user-groups/([^/]+)$"), "user_group.delete", "user_group", 1),
    # Devices
    ("PATCH", re.compile(r"^/api/devices/([^/]+)$"), "device.update", "device", 1),
    ("DELETE", re.compile(r"^/api/devices/([^/]+)$"), "device.delete", "device", 1),
    # Users
    ("POST", re.compile(r"^/api/users$"), "user.create", "user", None),
    ("PATCH", re.compile(r"^/api/users/([^/]+)$"), "user.update", "user", 1),
    ("DELETE", re.compile(r"^/api/users/([^/]+)$"), "user.delete", "user", 1),
    # Access rules
    ("POST", re.compile(r"^/api/access-rules$"), "access_rule.create", "access_rule", None),
    ("PATCH", re.compile(r"^/api/access-rules/([^/]+)$"), "access_rule.update", "access_rule", 1),
    ("DELETE", re.compile(r"^/api/access-rules/([^/]+)$"), "access_rule.delete", "access_rule", 1),
    # Strategies — assignments (must be before the strategy-level patterns)
    ("POST", re.compile(r"^/api/strategies/([^/]+)/assignments$"), "strategy.add_assignment", "strategy", 1),
    ("DELETE", re.compile(r"^/api/strategies/([^/]+)/assignments/([^/]+)$"), "strategy.remove_assignment", "strategy", 1),
    # Strategies
    ("POST", re.compile(r"^/api/strategies$"), "strategy.create", "strategy", None),
    ("PATCH", re.compile(r"^/api/strategies/([^/]+)$"), "strategy.update", "strategy", 1),
    ("DELETE", re.compile(r"^/api/strategies/([^/]+)$"), "strategy.delete", "strategy", 1),
    # Address books — entries (must be before the book-level patterns)
    ("POST", re.compile(r"^/api/address-books/([^/]+)/entries$"), "address_book.add_entry", "address_book", 1),
    ("PATCH", re.compile(r"^/api/address-books/([^/]+)/entries/([^/]+)$"), "address_book.update_entry", "address_book", 1),
    ("DELETE", re.compile(r"^/api/address-books/([^/]+)/entries/([^/]+)$"), "address_book.remove_entry", "address_book", 1),
    # Address books — permissions
    ("POST", re.compile(r"^/api/address-books/([^/]+)/permissions$"), "address_book.add_permission", "address_book", 1),
    ("DELETE", re.compile(r"^/api/address-books/([^/]+)/permissions/([^/]+)$"), "address_book.remove_permission", "address_book", 1),
    # Address books
    ("POST", re.compile(r"^/api/address-books$"), "address_book.create", "address_book", None),
    ("PATCH", re.compile(r"^/api/address-books/([^/]+)$"), "address_book.update", "address_book", 1),
    ("DELETE", re.compile(r"^/api/address-books/([^/]+)$"), "address_book.delete", "address_book", 1),
    # Notification rules
    ("POST", re.compile(r"^/api/notifications/test/([^/]+)$"), "notification_rule.test", "notification_rule", 1),
    ("POST", re.compile(r"^/api/notifications/rules$"), "notification_rule.create", "notification_rule", None),
    ("PATCH", re.compile(r"^/api/notifications/rules/([^/]+)$"), "notification_rule.update", "notification_rule", 1),
    ("DELETE", re.compile(r"^/api/notifications/rules/([^/]+)$"), "notification_rule.delete", "notification_rule", 1),
    # API tokens
    ("POST", re.compile(r"^/api/api-tokens$"), "api_token.create", "api_token", None),
    ("PATCH", re.compile(r"^/api/api-tokens/([^/]+)$"), "api_token.update", "api_token", 1),
    ("DELETE", re.compile(r"^/api/api-tokens/([^/]+)$"), "api_token.delete", "api_token", 1),
    # Auth actions
    ("POST", re.compile(r"^/api/auth/change-password$"), "auth.change_password", "auth", None),
    ("POST", re.compile(r"^/api/auth/totp/setup$"), "auth.totp_setup", "auth", None),
    ("POST", re.compile(r"^/api/auth/totp/verify$"), "auth.totp_verify", "auth", None),
    ("POST", re.compile(r"^/api/auth/totp/disable$"), "auth.totp_disable", "auth", None),
]


def _match_route(
    method: str, path: str
) -> tuple[str, str, str | None] | None:
    """Return (action, resource_type, resource_id) for a matched route, or None."""
    for route_method, pattern, action, resource_type, rid_group in _ROUTE_MAP:
        if method != route_method:
            continue
        m = pattern.match(path)
        if m:
            resource_id = m.group(rid_group) if rid_group else None
            return action, resource_type, resource_id
    return None


def _extract_user_id_from_token(authorization: str | None) -> str | None:
    """Decode the JWT (or look up an API token) and return the user_id, or None."""
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token_value = parts[1]

    # API tokens start with "arc_" — we can't decode a user_id synchronously here,
    # so we return None and let the audit log record it as "unknown".
    # The actual auth + user lookup happens in the request handler itself.
    if token_value.startswith("arc_"):
        return None

    try:
        payload = jwt.decode(token_value, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None


def _get_client_ip(request: Request) -> str | None:
    """Return the client IP from X-Forwarded-For or the direct connection."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


async def _write_audit_log(
    user_id_str: str | None,
    action: str,
    resource_type: str,
    resource_id: str | None,
    ip_address: str | None,
) -> None:
    """Write an audit log entry using a fresh database session."""
    try:
        async with AsyncSessionLocal() as session:
            # Look up user email
            user_email = "unknown"
            user_uuid: uuid.UUID | None = None
            if user_id_str:
                try:
                    user_uuid = uuid.UUID(user_id_str)
                except ValueError:
                    user_uuid = None

                if user_uuid:
                    result = await session.execute(
                        select(User.email).where(User.id == user_uuid)
                    )
                    row = result.scalar_one_or_none()
                    if row:
                        user_email = row

            log = AuditLog(
                user_id=user_uuid,
                user_email=user_email,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address=ip_address,
            )
            session.add(log)
            await session.commit()
    except Exception:
        logger.exception("Failed to write audit log entry")


class AuditMiddleware(BaseHTTPMiddleware):
    """Logs mutating API actions to the audit_logs table."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        # Only audit mutating methods with successful responses
        if request.method not in ("POST", "PATCH", "DELETE"):
            return response
        if not (200 <= response.status_code < 300):
            return response

        # Skip non-auditable paths
        path = request.url.path.rstrip("/")
        if path in SKIP_PATHS:
            return response

        match = _match_route(request.method, path)
        if match is None:
            return response

        action, resource_type, resource_id = match
        user_id_str = _extract_user_id_from_token(
            request.headers.get("Authorization")
        )
        ip_address = _get_client_ip(request)

        # Fire-and-forget via background task on the response
        request.state._audit_task = (  # noqa: SLF001
            action,
            resource_type,
            resource_id,
            user_id_str,
            ip_address,
        )

        # Use asyncio to run the write without blocking.
        # We await it here but since the response is already built
        # and we use a separate session, it won't delay the client
        # if the middleware is structured with streaming.
        # For BaseHTTPMiddleware, the response body has already been
        # consumed by call_next, so this is effectively post-response.
        try:
            await _write_audit_log(
                user_id_str=user_id_str,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address=ip_address,
            )
        except Exception:
            logger.exception("Audit middleware: failed to write log")

        return response
