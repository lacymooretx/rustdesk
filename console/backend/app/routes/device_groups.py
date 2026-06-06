import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.groups import DeviceGroup, DeviceGroupMember
from app.models.user import User
from app.schemas.device import DeviceResponse
from app.schemas.groups import (
    DeviceGroupCreate,
    DeviceGroupListResponse,
    DeviceGroupMemberAdd,
    DeviceGroupMemberResponse,
    DeviceGroupResponse,
    DeviceGroupUpdate,
)
from app.services.auth import require_admin
from app.services.devices import get_device_or_none

router = APIRouter(prefix="/api/device-groups", tags=["device-groups"])


async def _group_to_response(
    db: AsyncSession, group: DeviceGroup
) -> DeviceGroupResponse:
    """Convert a DeviceGroup ORM object to a response with member count."""
    count_result = await db.execute(
        select(func.count(DeviceGroupMember.id)).where(
            DeviceGroupMember.group_id == group.id
        )
    )
    member_count = count_result.scalar() or 0
    return DeviceGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        member_count=member_count,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.get("", response_model=DeviceGroupListResponse)
async def list_device_groups(
    q: str | None = Query(default=None, description="Search by name or description"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all device groups with search and pagination (admin only)."""
    query = select(DeviceGroup)
    count_query = select(func.count(DeviceGroup.id))

    if q:
        like_pattern = f"%{q}%"
        filter_clause = DeviceGroup.name.ilike(like_pattern) | DeviceGroup.description.ilike(like_pattern)
        query = query.where(filter_clause)
        count_query = count_query.where(filter_clause)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(DeviceGroup.name.asc())
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    groups = result.scalars().all()

    group_responses = []
    for g in groups:
        group_responses.append(await _group_to_response(db, g))

    return DeviceGroupListResponse(
        groups=group_responses,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.post("", response_model=DeviceGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_device_group(
    body: DeviceGroupCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new device group (admin only)."""
    existing = await db.execute(
        select(DeviceGroup).where(DeviceGroup.name == body.name)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device group '{body.name}' already exists",
        )

    group = DeviceGroup(name=body.name, description=body.description)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return await _group_to_response(db, group)


@router.post("/auto-assign", status_code=status.HTTP_200_OK)
async def auto_assign_device_to_group(
    body: dict,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Auto-assign a device to a group by tenant/group name (create group if needed).

    Used by ImmyBot metascript to auto-organize devices by tenant.
    Expects: { "group_name": "Acme Corp", "device_id": "123456789" }
    """
    group_name = body.get("group_name")
    device_id = body.get("device_id")

    if not group_name or not device_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both group_name and device_id are required",
        )

    # Find or create the group
    result = await db.execute(
        select(DeviceGroup).where(DeviceGroup.name == group_name)
    )
    group = result.scalar_one_or_none()

    if group is None:
        group = DeviceGroup(
            name=group_name,
            description=f"Auto-created from ImmyBot tenant: {group_name}",
        )
        db.add(group)
        await db.flush()
        created = True
    else:
        created = False

    # Check if already a member
    existing = await db.execute(
        select(DeviceGroupMember).where(
            DeviceGroupMember.group_id == group.id,
            DeviceGroupMember.device_id == device_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        await db.commit()
        return {
            "status": "already_assigned",
            "group_name": group.name,
            "group_id": str(group.id),
            "device_id": device_id,
            "group_created": False,
        }

    # Add device to group
    member = DeviceGroupMember(group_id=group.id, device_id=device_id)
    db.add(member)
    await db.commit()

    return {
        "status": "assigned",
        "group_name": group.name,
        "group_id": str(group.id),
        "device_id": device_id,
        "group_created": created,
    }


@router.get("/{group_id}", response_model=DeviceGroupResponse)
async def get_device_group(
    group_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get a single device group by ID (admin only)."""
    result = await db.execute(select(DeviceGroup).where(DeviceGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device group not found",
        )
    return await _group_to_response(db, group)


@router.patch("/{group_id}", response_model=DeviceGroupResponse)
async def update_device_group(
    group_id: uuid.UUID,
    body: DeviceGroupUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a device group's name or description (admin only)."""
    result = await db.execute(select(DeviceGroup).where(DeviceGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device group not found",
        )

    update_data = body.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        # Check for duplicate name
        existing = await db.execute(
            select(DeviceGroup).where(
                DeviceGroup.name == update_data["name"],
                DeviceGroup.id != group_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Device group '{update_data['name']}' already exists",
            )

    for field, value in update_data.items():
        setattr(group, field, value)

    db.add(group)
    await db.commit()
    await db.refresh(group)
    return await _group_to_response(db, group)


@router.delete("/{group_id}", status_code=204)
async def delete_device_group(
    group_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a device group (admin only). Members are cascaded."""
    result = await db.execute(select(DeviceGroup).where(DeviceGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device group not found",
        )
    await db.delete(group)
    await db.commit()


@router.post(
    "/{group_id}/members",
    response_model=DeviceGroupMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_device_group_member(
    group_id: uuid.UUID,
    body: DeviceGroupMemberAdd,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add a device to a device group (admin only)."""
    # Verify group exists
    group_result = await db.execute(
        select(DeviceGroup).where(DeviceGroup.id == group_id)
    )
    if group_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device group not found",
        )

    # Check for duplicate membership
    existing = await db.execute(
        select(DeviceGroupMember).where(
            DeviceGroupMember.group_id == group_id,
            DeviceGroupMember.device_id == body.device_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device '{body.device_id}' is already in this group",
        )

    member = DeviceGroupMember(group_id=group_id, device_id=body.device_id)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{group_id}/members/{device_id}", status_code=204)
async def remove_device_group_member(
    group_id: uuid.UUID,
    device_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a device from a device group (admin only)."""
    result = await db.execute(
        select(DeviceGroupMember).where(
            DeviceGroupMember.group_id == group_id,
            DeviceGroupMember.device_id == device_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device membership not found",
        )
    await db.delete(member)
    await db.commit()


@router.get("/{group_id}/members", response_model=list[DeviceResponse])
async def list_device_group_members(
    group_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List members of a device group with device info (admin only)."""
    # Verify group exists
    group_result = await db.execute(
        select(DeviceGroup).where(DeviceGroup.id == group_id)
    )
    if group_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device group not found",
        )

    result = await db.execute(
        select(DeviceGroupMember.device_id).where(
            DeviceGroupMember.group_id == group_id
        )
    )
    device_ids = [row[0] for row in result.all()]

    devices = []
    for did in device_ids:
        device = await get_device_or_none(db, did)
        if device:
            devices.append(device)
        else:
            devices.append(DeviceResponse(guid="", id=did, note="(device not yet registered)"))

    return devices
