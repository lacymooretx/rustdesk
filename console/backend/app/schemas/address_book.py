import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Address Book
# ---------------------------------------------------------------------------

class AddressBookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    is_personal: bool = False


class AddressBookUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class AddressBookResponse(BaseModel):
    id: uuid.UUID
    name: str
    owner_id: uuid.UUID | None
    is_personal: bool
    description: str | None
    entry_count: int = 0
    entries: list["AddressBookEntryResponse"] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AddressBookListResponse(BaseModel):
    books: list[AddressBookResponse]


# ---------------------------------------------------------------------------
# Address Book Entries
# ---------------------------------------------------------------------------

class AddressBookEntryCreate(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=255)
    alias: str | None = None
    tags: str | None = None


class AddressBookEntryUpdate(BaseModel):
    alias: str | None = None
    tags: str | None = None


class AddressBookEntryResponse(BaseModel):
    id: uuid.UUID
    book_id: uuid.UUID
    device_id: str
    alias: str | None
    tags: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# Rebuild AddressBookResponse to resolve the forward reference to AddressBookEntryResponse
AddressBookResponse.model_rebuild()


# ---------------------------------------------------------------------------
# Address Book Permissions
# ---------------------------------------------------------------------------

class AddressBookPermissionCreate(BaseModel):
    user_group_id: uuid.UUID
    permission: str = Field(..., pattern="^(read|write)$")


class AddressBookPermissionResponse(BaseModel):
    id: uuid.UUID
    book_id: uuid.UUID
    user_group_id: uuid.UUID
    user_group_name: str | None = None
    permission: str
    created_at: datetime

    model_config = {"from_attributes": True}
