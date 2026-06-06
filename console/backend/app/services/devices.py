import math
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.schemas.dashboard import DashboardStats
from app.schemas.device import DeviceInfo, DeviceListResponse, DeviceResponse

ONLINE_THRESHOLD_MINUTES = 5

VALID_SORT_COLUMNS = {"device_id", "created_at", "status", "hostname"}


def _device_to_response(device: Device) -> DeviceResponse:
    """Convert a Device ORM object to a DeviceResponse."""
    threshold = datetime.now(timezone.utc) - timedelta(minutes=ONLINE_THRESHOLD_MINUTES)
    online = device.last_seen >= threshold if device.last_seen else False

    return DeviceResponse(
        guid=str(device.id),
        id=device.device_id,
        uuid=device.uuid,
        pk=None,
        created_at=device.created_at.isoformat() if device.created_at else None,
        user=device.username,
        status=device.status,
        note=device.note,
        info=DeviceInfo(
            hostname=device.hostname,
            username=device.username,
            os=device.os,
            platform=device.platform or device.os,
            ip=device.ip_address,
        ),
        online=online,
        last_seen=device.last_seen.isoformat() if device.last_seen else None,
        managed_password=device.managed_password,
    )


async def get_devices(
    db: AsyncSession,
    q: str | None = None,
    sort_by: str = "device_id",
    sort_order: str = "asc",
    page: int = 1,
    per_page: int = 50,
) -> DeviceListResponse:
    """Return a paginated, searchable, sortable list of devices."""
    query = select(Device)
    count_query = select(func.count(Device.id))

    if q:
        like_pattern = f"%{q}%"
        filter_clause = or_(
            Device.device_id.ilike(like_pattern),
            Device.hostname.ilike(like_pattern),
            Device.note.ilike(like_pattern),
            Device.username.ilike(like_pattern),
            Device.os.ilike(like_pattern),
            Device.ip_address.ilike(like_pattern),
        )
        query = query.where(filter_clause)
        count_query = count_query.where(filter_clause)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Map frontend sort_by="id" to device_id
    if sort_by == "id":
        sort_by = "device_id"
    if sort_by not in VALID_SORT_COLUMNS:
        sort_by = "device_id"

    order_col = getattr(Device, sort_by)
    if sort_order.lower() == "desc":
        order_col = order_col.desc()
    else:
        order_col = order_col.asc()
    query = query.order_by(order_col)

    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    devices = result.scalars().all()

    return DeviceListResponse(
        devices=[_device_to_response(d) for d in devices],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


async def get_device(db: AsyncSession, device_id: str) -> DeviceResponse:
    """Return a single device by its RustDesk device ID."""
    result = await db.execute(
        select(Device).where(Device.device_id == device_id)
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found",
        )
    return _device_to_response(device)


async def get_device_or_none(db: AsyncSession, device_id: str) -> DeviceResponse | None:
    """Return a single device or None if not found."""
    result = await db.execute(
        select(Device).where(Device.device_id == device_id)
    )
    device = result.scalar_one_or_none()
    if device is None:
        return None
    return _device_to_response(device)


async def get_devices_by_ids(
    db: AsyncSession, device_ids: list[str]
) -> list[DeviceResponse]:
    """Fetch multiple devices by their RustDesk IDs."""
    if not device_ids:
        return []
    result = await db.execute(
        select(Device).where(Device.device_id.in_(device_ids))
    )
    devices = result.scalars().all()
    return [_device_to_response(d) for d in devices]


async def get_dashboard_stats(db: AsyncSession) -> DashboardStats:
    """Return aggregate device statistics."""
    total_result = await db.execute(select(func.count(Device.id)))
    total = total_result.scalar() or 0

    disabled_result = await db.execute(
        select(func.count(Device.id)).where(Device.status == 1)
    )
    disabled = disabled_result.scalar() or 0

    threshold = datetime.now(timezone.utc) - timedelta(minutes=ONLINE_THRESHOLD_MINUTES)
    online_result = await db.execute(
        select(func.count(Device.id)).where(Device.last_seen >= threshold)
    )
    online = online_result.scalar() or 0

    return DashboardStats(
        total_devices=total,
        enabled_devices=total - disabled,
        disabled_devices=disabled,
        online_devices=online,
    )


async def update_device_status(
    db: AsyncSession, device_id: str, new_status: int
) -> DeviceResponse:
    """Enable (0) or disable (1) a device."""
    result = await db.execute(
        select(Device).where(Device.device_id == device_id)
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found",
        )
    if new_status not in (0, 1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 0 (enabled) or 1 (disabled)",
        )
    device.status = new_status
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return _device_to_response(device)


async def update_device_note(
    db: AsyncSession, device_id: str, note: str
) -> DeviceResponse:
    """Update the note field of a device."""
    result = await db.execute(
        select(Device).where(Device.device_id == device_id)
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found",
        )
    device.note = note
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return _device_to_response(device)


async def update_device_managed_password(
    db: AsyncSession, device_id: str, managed_password: str
) -> DeviceResponse:
    """Update the managed password for a device."""
    result = await db.execute(
        select(Device).where(Device.device_id == device_id)
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found",
        )
    device.managed_password = managed_password
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return _device_to_response(device)


async def delete_device(db: AsyncSession, device_id: str) -> None:
    """Remove a device."""
    result = await db.execute(
        select(Device).where(Device.device_id == device_id)
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found",
        )
    await db.delete(device)
    await db.commit()


async def upsert_device_from_heartbeat(
    db: AsyncSession,
    device_id: str,
    ip_address: str | None = None,
    version: str | None = None,
    sysinfo: dict | None = None,
    device_uuid: str | None = None,
) -> Device:
    """Create or update a device record from heartbeat/sysinfo data."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Device).where(Device.device_id == device_id)
    )
    device = result.scalar_one_or_none()

    if device is None:
        device = Device(
            device_id=device_id,
            last_seen=now,
            ip_address=ip_address,
            version=version,
            uuid=device_uuid,
        )
        if sysinfo:
            device.hostname = sysinfo.get("hostname")
            device.username = sysinfo.get("username")
            device.os = sysinfo.get("os")
            device.platform = sysinfo.get("platform") or sysinfo.get("os")
            device.cpu = sysinfo.get("cpu")
            device.memory = sysinfo.get("memory")
        db.add(device)
    else:
        device.last_seen = now
        device.updated_at = now
        if ip_address is not None:
            device.ip_address = ip_address
        if version is not None:
            device.version = version
        if device_uuid is not None:
            device.uuid = device_uuid
        if sysinfo:
            if sysinfo.get("hostname"):
                device.hostname = sysinfo["hostname"]
            if sysinfo.get("username"):
                device.username = sysinfo["username"]
            if sysinfo.get("os"):
                device.os = sysinfo["os"]
            if sysinfo.get("platform") or sysinfo.get("os"):
                device.platform = sysinfo.get("platform") or sysinfo.get("os")
            if sysinfo.get("cpu"):
                device.cpu = sysinfo["cpu"]
            if sysinfo.get("memory"):
                device.memory = sysinfo["memory"]
        db.add(device)

    await db.commit()
    await db.refresh(device)
    return device
