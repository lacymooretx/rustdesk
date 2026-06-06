from datetime import datetime

from pydantic import BaseModel, Field


class HeartbeatPayload(BaseModel):
    """Accept both our original format and the native RustDesk client format.

    Native client sends: {id, uuid, ver, conns, modified_at}
    Our manual format:   {id, version, sysinfo}
    """
    id: str = Field(..., min_length=1, description="RustDesk device/peer ID")
    uuid: str | None = None
    ver: int | None = None          # native client version number
    version: str | None = None      # our string version field
    conns: list | None = None       # active connection IDs
    modified_at: int | None = None  # strategy timestamp
    sysinfo: dict | None = None     # our manual sysinfo dict


class SysinfoPayload(BaseModel):
    """Accept the native RustDesk client sysinfo upload.

    Client sends: {cpu, memory, os, hostname, username, version, id, uuid, ...}
    """
    id: str = Field(..., min_length=1)
    cpu: str | None = None
    memory: str | None = None
    os: str | None = None
    hostname: str | None = None
    username: str | None = None
    version: str | None = None
    uuid: str | None = None

    model_config = {"extra": "allow"}  # accept preset-* fields without failing


class HeartbeatResponse(BaseModel):
    device_id: str
    last_seen: datetime
    ip_address: str | None = None
    version: str | None = None
    sysinfo: str | None = None

    model_config = {"from_attributes": True}
