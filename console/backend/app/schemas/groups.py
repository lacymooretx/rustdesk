import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Device Groups
# ---------------------------------------------------------------------------

class DeviceGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class DeviceGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class DeviceGroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    member_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeviceGroupListResponse(BaseModel):
    groups: list[DeviceGroupResponse]
    total: int
    page: int
    per_page: int
    pages: int


class DeviceGroupMemberAdd(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=255)


class DeviceGroupMemberResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    device_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# User Groups
# ---------------------------------------------------------------------------

class UserGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class UserGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class UserGroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    member_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserGroupListResponse(BaseModel):
    groups: list[UserGroupResponse]
    total: int
    page: int
    per_page: int
    pages: int


class UserGroupMemberAdd(BaseModel):
    user_id: uuid.UUID


class UserGroupMemberResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Access Rules
# ---------------------------------------------------------------------------

class AccessRuleCreate(BaseModel):
    user_group_id: uuid.UUID
    device_group_id: uuid.UUID
    permission: str = Field(..., pattern="^(view|control|full)$")


class AccessRuleUpdate(BaseModel):
    permission: str | None = Field(default=None, pattern="^(view|control|full)$")


class AccessRuleResponse(BaseModel):
    id: uuid.UUID
    user_group_id: uuid.UUID
    device_group_id: uuid.UUID
    user_group_name: str
    device_group_name: str
    permission: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AccessRuleListResponse(BaseModel):
    rules: list[AccessRuleResponse]
    total: int
