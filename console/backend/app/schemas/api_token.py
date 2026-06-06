import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class APITokenCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    scopes: str | None = None
    expires_in_days: int | None = None


class APITokenUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    scopes: str | None = None
    is_active: bool | None = None


class APITokenResponse(BaseModel):
    id: uuid.UUID
    name: str
    token_prefix: str
    scopes: str | None
    expires_at: datetime | None
    last_used_at: datetime | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class APITokenCreatedResponse(APITokenResponse):
    plaintext_token: str


class APITokenListResponse(BaseModel):
    tokens: list[APITokenResponse]
    total: int
