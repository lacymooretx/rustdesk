import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ConnectionEventCreate(BaseModel):
    session_id: str
    device_id: str
    peer_id: str
    event_type: str = Field(pattern="^(connect|disconnect|file_transfer)$")
    peer_username: str | None = None
    peer_hostname: str | None = None
    duration_seconds: int | None = None
    file_name: str | None = None
    file_size: int | None = None
    file_direction: str | None = Field(default=None, pattern="^(upload|download)$")


class ConnectionEventResponse(BaseModel):
    id: uuid.UUID
    session_id: str
    device_id: str
    peer_id: str
    event_type: str
    peer_username: str | None
    peer_hostname: str | None
    ip_address: str | None
    duration_seconds: int | None
    file_name: str | None
    file_size: int | None
    file_direction: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConnectionEventListResponse(BaseModel):
    events: list[ConnectionEventResponse]
    total: int
    page: int
    per_page: int
    pages: int


class ActiveSessionResponse(BaseModel):
    session_id: str
    device_id: str
    peer_id: str
    peer_username: str | None
    peer_hostname: str | None
    ip_address: str | None
    connected_at: datetime

    model_config = {"from_attributes": True}
