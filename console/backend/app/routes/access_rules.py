import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.groups import AccessRule, DeviceGroup, UserGroup
from app.models.user import User
from app.schemas.groups import (
    AccessRuleCreate,
    AccessRuleListResponse,
    AccessRuleResponse,
    AccessRuleUpdate,
)
from app.services.auth import require_admin

router = APIRouter(prefix="/api/access-rules", tags=["access-rules"])


async def _rule_to_response(
    db: AsyncSession, rule: AccessRule
) -> AccessRuleResponse:
    """Convert an AccessRule ORM object to a response with group names."""
    ug_result = await db.execute(
        select(UserGroup.name).where(UserGroup.id == rule.user_group_id)
    )
    ug_name = ug_result.scalar() or "(deleted)"

    dg_result = await db.execute(
        select(DeviceGroup.name).where(DeviceGroup.id == rule.device_group_id)
    )
    dg_name = dg_result.scalar() or "(deleted)"

    return AccessRuleResponse(
        id=rule.id,
        user_group_id=rule.user_group_id,
        device_group_id=rule.device_group_id,
        user_group_name=ug_name,
        device_group_name=dg_name,
        permission=rule.permission,
        created_at=rule.created_at,
    )


@router.get("", response_model=AccessRuleListResponse)
async def list_access_rules(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all access rules with group names (admin only)."""
    result = await db.execute(select(AccessRule).order_by(AccessRule.created_at.desc()))
    rules = result.scalars().all()

    rule_responses = []
    for r in rules:
        rule_responses.append(await _rule_to_response(db, r))

    return AccessRuleListResponse(
        rules=rule_responses,
        total=len(rule_responses),
    )


@router.post("", response_model=AccessRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_access_rule(
    body: AccessRuleCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new access rule (admin only)."""
    # Verify user group exists
    ug_result = await db.execute(
        select(UserGroup).where(UserGroup.id == body.user_group_id)
    )
    if ug_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User group not found",
        )

    # Verify device group exists
    dg_result = await db.execute(
        select(DeviceGroup).where(DeviceGroup.id == body.device_group_id)
    )
    if dg_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device group not found",
        )

    # Check for duplicate rule
    existing = await db.execute(
        select(AccessRule).where(
            AccessRule.user_group_id == body.user_group_id,
            AccessRule.device_group_id == body.device_group_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An access rule for this user group / device group combination already exists",
        )

    rule = AccessRule(
        user_group_id=body.user_group_id,
        device_group_id=body.device_group_id,
        permission=body.permission,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return await _rule_to_response(db, rule)


@router.patch("/{rule_id}", response_model=AccessRuleResponse)
async def update_access_rule(
    rule_id: uuid.UUID,
    body: AccessRuleUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update the permission level of an access rule (admin only)."""
    result = await db.execute(select(AccessRule).where(AccessRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access rule not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return await _rule_to_response(db, rule)


@router.delete("/{rule_id}", status_code=204)
async def delete_access_rule(
    rule_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete an access rule (admin only)."""
    result = await db.execute(select(AccessRule).where(AccessRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access rule not found",
        )
    await db.delete(rule)
    await db.commit()
