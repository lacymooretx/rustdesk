from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardStats
from app.schemas.device import DeviceListResponse, DeviceResponse, DeviceUpdate
from app.services.auth import get_current_user, require_admin, require_operator
from app.services.devices import (
    delete_device,
    get_dashboard_stats,
    get_device,
    get_devices,
    update_device_managed_password,
    update_device_note,
    update_device_status,
)

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("/stats", response_model=DashboardStats)
async def device_stats(
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard statistics: total / enabled / disabled / online device counts."""
    return await get_dashboard_stats(db)


@router.get("", response_model=DeviceListResponse)
async def list_devices(
    q: str | None = Query(default=None, description="Search by ID, hostname, note, or user"),
    sort_by: str = Query(default="id", description="Column to sort by"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all devices with search, sort, and pagination."""
    return await get_devices(db, q=q, sort_by=sort_by, sort_order=sort_order, page=page, per_page=per_page)


@router.get("/{device_id}", response_model=DeviceResponse)
async def read_device(
    device_id: str,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single device by RustDesk device ID."""
    return await get_device(db, device_id)


@router.patch("/{device_id}", response_model=DeviceResponse)
async def patch_device(
    device_id: str,
    body: DeviceUpdate,
    _current_user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
):
    """Update device note, status, and/or managed password (operator+ only)."""
    result = None
    if body.status is not None:
        result = await update_device_status(db, device_id, body.status)
    if body.note is not None:
        result = await update_device_note(db, device_id, body.note)
    if body.managed_password is not None:
        result = await update_device_managed_password(db, device_id, body.managed_password)
    if result is None:
        result = await get_device(db, device_id)
    return result


@router.delete("/{device_id}", status_code=204)
async def remove_device(
    device_id: str,
    _current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a device (admin only)."""
    await delete_device(db, device_id)
