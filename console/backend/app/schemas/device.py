from pydantic import BaseModel


class DeviceInfo(BaseModel):
    hostname: str | None = None
    username: str | None = None
    os: str | None = None
    platform: str | None = None
    ip: str | None = None


class DeviceResponse(BaseModel):
    guid: str
    id: str | None = None
    uuid: str | None = None
    pk: str | None = None
    created_at: str | None = None
    user: str | None = None
    status: int | None = None  # 0 = enabled, 1 = disabled
    note: str | None = None
    info: DeviceInfo | None = None
    online: bool | None = None
    last_seen: str | None = None
    managed_password: str | None = None

    model_config = {"from_attributes": True}


class DeviceListResponse(BaseModel):
    devices: list[DeviceResponse]
    total: int
    page: int
    per_page: int
    pages: int


class DeviceUpdate(BaseModel):
    status: int | None = None  # 0 or 1
    note: str | None = None
    managed_password: str | None = None
