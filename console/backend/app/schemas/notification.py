import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Notification Rules
# ---------------------------------------------------------------------------

class NotificationRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    event_type: str = Field(
        ...,
        pattern="^(new_device|device_offline|connection_started|connection_ended|new_user)$",
    )
    recipients: str = Field(..., min_length=1)
    enabled: bool = True


class NotificationRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    event_type: str | None = Field(
        default=None,
        pattern="^(new_device|device_offline|connection_started|connection_ended|new_user)$",
    )
    recipients: str | None = Field(default=None, min_length=1)
    enabled: bool | None = None


class NotificationRuleResponse(BaseModel):
    id: uuid.UUID
    name: str
    event_type: str
    enabled: bool
    recipients: str
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotificationRuleListResponse(BaseModel):
    rules: list[NotificationRuleResponse]
    total: int


# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------

class NotificationTestRequest(BaseModel):
    rule_id: uuid.UUID


# ---------------------------------------------------------------------------
# SMTP Settings (read-only, never expose password)
# ---------------------------------------------------------------------------

class SMTPSettingsResponse(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_from_email: str
    smtp_from_name: str
    smtp_use_tls: bool
    smtp_enabled: bool
