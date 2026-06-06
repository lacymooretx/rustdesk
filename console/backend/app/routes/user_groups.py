import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.groups import UserGroup, UserGroupMember
from app.models.user import User
from app.schemas.groups import (
    UserGroupCreate,
    UserGroupListResponse,
    UserGroupMemberAdd,
    UserGroupMemberResponse,
    UserGroupResponse,
    UserGroupUpdate,
)
from app.schemas.user import UserResponse
from app.services.auth import require_admin

router = APIRouter(prefix="/api/user-groups", tags=["user-groups"])


async def _group_to_response(
    db: AsyncSession, group: UserGroup
) -> UserGroupResponse:
    """Convert a UserGroup ORM object to a response with member count."""
    count_result = await db.execute(
        select(func.count(UserGroupMember.id)).where(
            UserGroupMember.group_id == group.id
        )
    )
    member_count = count_result.scalar() or 0
    return UserGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        member_count=member_count,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.get("", response_model=UserGroupListResponse)
async def list_user_groups(
    q: str | None = Query(default=None, description="Search by name or description"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all user groups with search and pagination (admin only)."""
    query = select(UserGroup)
    count_query = select(func.count(UserGroup.id))

    if q:
        like_pattern = f"%{q}%"
        filter_clause = UserGroup.name.ilike(like_pattern) | UserGroup.description.ilike(like_pattern)
        query = query.where(filter_clause)
        count_query = count_query.where(filter_clause)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(UserGroup.name.asc())
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    groups = result.scalars().all()

    group_responses = []
    for g in groups:
        group_responses.append(await _group_to_response(db, g))

    return UserGroupListResponse(
        groups=group_responses,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.post("", response_model=UserGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_user_group(
    body: UserGroupCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user group (admin only)."""
    existing = await db.execute(
        select(UserGroup).where(UserGroup.name == body.name)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User group '{body.name}' already exists",
        )

    group = UserGroup(name=body.name, description=body.description)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return await _group_to_response(db, group)


@router.get("/{group_id}", response_model=UserGroupResponse)
async def get_user_group(
    group_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get a single user group by ID (admin only)."""
    result = await db.execute(select(UserGroup).where(UserGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User group not found",
        )
    return await _group_to_response(db, group)


@router.patch("/{group_id}", response_model=UserGroupResponse)
async def update_user_group(
    group_id: uuid.UUID,
    body: UserGroupUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a user group's name or description (admin only)."""
    result = await db.execute(select(UserGroup).where(UserGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User group not found",
        )

    update_data = body.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        existing = await db.execute(
            select(UserGroup).where(
                UserGroup.name == update_data["name"],
                UserGroup.id != group_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User group '{update_data['name']}' already exists",
            )

    for field, value in update_data.items():
        setattr(group, field, value)

    db.add(group)
    await db.commit()
    await db.refresh(group)
    return await _group_to_response(db, group)


@router.delete("/{group_id}", status_code=204)
async def delete_user_group(
    group_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user group (admin only). Members are cascaded."""
    result = await db.execute(select(UserGroup).where(UserGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User group not found",
        )
    await db.delete(group)
    await db.commit()


@router.post(
    "/{group_id}/members",
    response_model=UserGroupMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_user_group_member(
    group_id: uuid.UUID,
    body: UserGroupMemberAdd,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add a user to a user group (admin only)."""
    # Verify group exists
    group_result = await db.execute(
        select(UserGroup).where(UserGroup.id == group_id)
    )
    if group_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User group not found",
        )

    # Verify user exists
    user_result = await db.execute(
        select(User).where(User.id == body.user_id)
    )
    if user_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check for duplicate membership
    existing = await db.execute(
        select(UserGroupMember).where(
            UserGroupMember.group_id == group_id,
            UserGroupMember.user_id == body.user_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already in this group",
        )

    member = UserGroupMember(group_id=group_id, user_id=body.user_id)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{group_id}/members/{user_id}", status_code=204)
async def remove_user_group_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a user from a user group (admin only)."""
    result = await db.execute(
        select(UserGroupMember).where(
            UserGroupMember.group_id == group_id,
            UserGroupMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User membership not found",
        )
    await db.delete(member)
    await db.commit()


@router.get("/{group_id}/members", response_model=list[UserResponse])
async def list_user_group_members(
    group_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List members of a user group (admin only)."""
    # Verify group exists
    group_result = await db.execute(
        select(UserGroup).where(UserGroup.id == group_id)
    )
    if group_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User group not found",
        )

    result = await db.execute(
        select(User)
        .join(UserGroupMember, UserGroupMember.user_id == User.id)
        .where(UserGroupMember.group_id == group_id)
        .order_by(User.username.asc())
    )
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]
