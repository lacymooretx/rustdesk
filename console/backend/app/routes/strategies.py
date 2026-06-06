import json
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.groups import DeviceGroup, DeviceGroupMember
from app.models.strategy import Strategy, StrategyAssignment
from app.models.user import User
from app.schemas.strategy import (
    EffectiveStrategyResponse,
    StrategyAssignmentCreate,
    StrategyAssignmentResponse,
    StrategyCreate,
    StrategyListResponse,
    StrategyResponse,
    StrategyUpdate,
)
from app.services.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/strategies", tags=["strategies"])


async def _strategy_to_response(
    db: AsyncSession, strategy: Strategy
) -> StrategyResponse:
    """Convert a Strategy ORM object to a response with assignment count."""
    count_result = await db.execute(
        select(func.count(StrategyAssignment.id)).where(
            StrategyAssignment.strategy_id == strategy.id
        )
    )
    assignment_count = count_result.scalar() or 0
    return StrategyResponse(
        id=strategy.id,
        name=strategy.name,
        description=strategy.description,
        settings=json.loads(strategy.settings),
        assignment_count=assignment_count,
        created_at=strategy.created_at,
        updated_at=strategy.updated_at,
    )


async def _resolve_target_name(
    db: AsyncSession, target_type: str, target_id: str
) -> str | None:
    """Resolve a human-readable name for a strategy assignment target."""
    if target_type == "device":
        return target_id
    if target_type == "user":
        try:
            uid = uuid.UUID(target_id)
        except ValueError:
            return None
        result = await db.execute(select(User.email).where(User.id == uid))
        return result.scalar_one_or_none()
    if target_type == "device_group":
        try:
            gid = uuid.UUID(target_id)
        except ValueError:
            return None
        result = await db.execute(
            select(DeviceGroup.name).where(DeviceGroup.id == gid)
        )
        return result.scalar_one_or_none()
    return None


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.get("", response_model=StrategyListResponse)
async def list_strategies(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all strategies with pagination (admin only)."""
    count_query = select(func.count(Strategy.id))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = select(Strategy).order_by(Strategy.name.asc())
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    strategies = result.scalars().all()

    strategy_responses = []
    for s in strategies:
        strategy_responses.append(await _strategy_to_response(db, s))

    return StrategyListResponse(
        strategies=strategy_responses,
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.post("", response_model=StrategyResponse, status_code=status.HTTP_201_CREATED)
async def create_strategy(
    body: StrategyCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new strategy (admin only)."""
    existing = await db.execute(
        select(Strategy).where(Strategy.name == body.name)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Strategy '{body.name}' already exists",
        )

    strategy = Strategy(
        name=body.name,
        description=body.description,
        settings=json.dumps(body.settings),
    )
    db.add(strategy)
    await db.commit()
    await db.refresh(strategy)
    return await _strategy_to_response(db, strategy)


@router.get("/effective/{device_id}", response_model=EffectiveStrategyResponse)
async def get_effective_strategy(
    device_id: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compute the effective (merged) strategy for a device.

    Merges settings from all applicable strategies ordered by priority
    (higher priority overrides lower). Available to all authenticated users.
    """
    # 1. Direct device assignments
    device_assignments = await db.execute(
        select(StrategyAssignment, Strategy)
        .join(Strategy, StrategyAssignment.strategy_id == Strategy.id)
        .where(
            StrategyAssignment.target_type == "device",
            StrategyAssignment.target_id == device_id,
        )
    )
    device_rows = device_assignments.all()

    # 2. Device group assignments — find groups the device belongs to
    group_ids_result = await db.execute(
        select(DeviceGroupMember.group_id).where(
            DeviceGroupMember.device_id == device_id
        )
    )
    group_ids = [row[0] for row in group_ids_result.all()]

    group_rows = []
    if group_ids:
        group_assignments = await db.execute(
            select(StrategyAssignment, Strategy)
            .join(Strategy, StrategyAssignment.strategy_id == Strategy.id)
            .where(
                StrategyAssignment.target_type == "device_group",
                StrategyAssignment.target_id.in_([str(gid) for gid in group_ids]),
            )
        )
        group_rows = group_assignments.all()

    # 3. Collect all applicable strategies with source info
    all_entries: list[dict] = []

    for assignment, strategy in device_rows:
        all_entries.append({
            "strategy_id": str(strategy.id),
            "name": strategy.name,
            "priority": assignment.priority,
            "source": f"device:{device_id}",
            "settings": json.loads(strategy.settings),
        })

    for assignment, strategy in group_rows:
        all_entries.append({
            "strategy_id": str(strategy.id),
            "name": strategy.name,
            "priority": assignment.priority,
            "source": f"device_group:{assignment.target_id}",
            "settings": json.loads(strategy.settings),
        })

    # 4. Sort by priority ascending so higher priority overrides lower
    all_entries.sort(key=lambda e: e["priority"])

    # 5. Merge settings: lower priority first, higher overwrites
    merged_settings: dict = {}
    for entry in all_entries:
        merged_settings.update(entry["settings"])

    # Build applied list (without the raw settings blob)
    applied_strategies = [
        {
            "strategy_id": e["strategy_id"],
            "name": e["name"],
            "priority": e["priority"],
            "source": e["source"],
        }
        for e in all_entries
    ]

    return EffectiveStrategyResponse(
        device_id=device_id,
        merged_settings=merged_settings,
        applied_strategies=applied_strategies,
    )


@router.get("/{strategy_id}", response_model=StrategyResponse)
async def get_strategy(
    strategy_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get a single strategy by ID (admin only)."""
    result = await db.execute(
        select(Strategy).where(Strategy.id == strategy_id)
    )
    strategy = result.scalar_one_or_none()
    if strategy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Strategy not found",
        )
    return await _strategy_to_response(db, strategy)


@router.patch("/{strategy_id}", response_model=StrategyResponse)
async def update_strategy(
    strategy_id: uuid.UUID,
    body: StrategyUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a strategy's name, description, or settings (admin only)."""
    result = await db.execute(
        select(Strategy).where(Strategy.id == strategy_id)
    )
    strategy = result.scalar_one_or_none()
    if strategy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Strategy not found",
        )

    update_data = body.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        existing = await db.execute(
            select(Strategy).where(
                Strategy.name == update_data["name"],
                Strategy.id != strategy_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Strategy '{update_data['name']}' already exists",
            )

    if "settings" in update_data and update_data["settings"] is not None:
        update_data["settings"] = json.dumps(update_data["settings"])

    for field, value in update_data.items():
        setattr(strategy, field, value)

    db.add(strategy)
    await db.commit()
    await db.refresh(strategy)
    return await _strategy_to_response(db, strategy)


@router.delete("/{strategy_id}", status_code=204)
async def delete_strategy(
    strategy_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a strategy (admin only). Assignments are cascaded."""
    result = await db.execute(
        select(Strategy).where(Strategy.id == strategy_id)
    )
    strategy = result.scalar_one_or_none()
    if strategy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Strategy not found",
        )
    await db.delete(strategy)
    await db.commit()


# ---------------------------------------------------------------------------
# Assignments
# ---------------------------------------------------------------------------


@router.get(
    "/{strategy_id}/assignments",
    response_model=list[StrategyAssignmentResponse],
)
async def list_strategy_assignments(
    strategy_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List assignments for a strategy with resolved target names (admin only)."""
    # Verify strategy exists
    strat_result = await db.execute(
        select(Strategy).where(Strategy.id == strategy_id)
    )
    if strat_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Strategy not found",
        )

    result = await db.execute(
        select(StrategyAssignment)
        .where(StrategyAssignment.strategy_id == strategy_id)
        .order_by(StrategyAssignment.priority.desc())
    )
    assignments = result.scalars().all()

    responses = []
    for a in assignments:
        target_name = await _resolve_target_name(db, a.target_type, a.target_id)
        responses.append(
            StrategyAssignmentResponse(
                id=a.id,
                strategy_id=a.strategy_id,
                target_type=a.target_type,
                target_id=a.target_id,
                target_name=target_name,
                priority=a.priority,
                created_at=a.created_at,
            )
        )

    return responses


@router.post(
    "/{strategy_id}/assignments",
    response_model=StrategyAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_strategy_assignment(
    strategy_id: uuid.UUID,
    body: StrategyAssignmentCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add an assignment to a strategy (admin only)."""
    # Verify strategy exists
    strat_result = await db.execute(
        select(Strategy).where(Strategy.id == strategy_id)
    )
    if strat_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Strategy not found",
        )

    # Check for duplicate
    existing = await db.execute(
        select(StrategyAssignment).where(
            StrategyAssignment.strategy_id == strategy_id,
            StrategyAssignment.target_type == body.target_type,
            StrategyAssignment.target_id == body.target_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This assignment already exists",
        )

    assignment = StrategyAssignment(
        strategy_id=strategy_id,
        target_type=body.target_type,
        target_id=body.target_id,
        priority=body.priority,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    target_name = await _resolve_target_name(
        db, assignment.target_type, assignment.target_id
    )
    return StrategyAssignmentResponse(
        id=assignment.id,
        strategy_id=assignment.strategy_id,
        target_type=assignment.target_type,
        target_id=assignment.target_id,
        target_name=target_name,
        priority=assignment.priority,
        created_at=assignment.created_at,
    )


@router.delete("/{strategy_id}/assignments/{assignment_id}", status_code=204)
async def remove_strategy_assignment(
    strategy_id: uuid.UUID,
    assignment_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove an assignment from a strategy (admin only)."""
    result = await db.execute(
        select(StrategyAssignment).where(
            StrategyAssignment.id == assignment_id,
            StrategyAssignment.strategy_id == strategy_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )
    await db.delete(assignment)
    await db.commit()
