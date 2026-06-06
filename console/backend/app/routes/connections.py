import math
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.connection import ConnectionEvent
from app.models.user import User
from app.schemas.connection import (
    ActiveSessionResponse,
    ConnectionEventCreate,
    ConnectionEventListResponse,
    ConnectionEventResponse,
)
from app.services.auth import require_operator

router = APIRouter(prefix="/api/connections", tags=["connections"])


@router.post("/event")
async def create_connection_event(
    body: ConnectionEventCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Record a connection event from a RustDesk client (no auth required)."""
    # Determine client IP
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    else:
        ip_address = request.client.host if request.client else None

    duration_seconds = body.duration_seconds

    # For disconnect events, auto-calculate duration from matching connect event
    if body.event_type == "disconnect" and duration_seconds is None:
        connect_result = await db.execute(
            select(ConnectionEvent)
            .where(
                ConnectionEvent.session_id == body.session_id,
                ConnectionEvent.event_type == "connect",
            )
            .order_by(ConnectionEvent.created_at.desc())
            .limit(1)
        )
        connect_event = connect_result.scalar_one_or_none()
        if connect_event:
            delta = datetime.now(timezone.utc) - connect_event.created_at
            duration_seconds = int(delta.total_seconds())

    event = ConnectionEvent(
        session_id=body.session_id,
        device_id=body.device_id,
        peer_id=body.peer_id,
        event_type=body.event_type,
        peer_username=body.peer_username,
        peer_hostname=body.peer_hostname,
        ip_address=ip_address,
        duration_seconds=duration_seconds,
        file_name=body.file_name,
        file_size=body.file_size,
        file_direction=body.file_direction,
    )
    db.add(event)
    await db.commit()

    return {"ok": True}


@router.get("", response_model=ConnectionEventListResponse)
async def list_connection_events(
    device_id: str | None = Query(default=None, description="Filter by device ID"),
    peer_id: str | None = Query(default=None, description="Filter by peer ID"),
    event_type: str | None = Query(default=None, description="Filter by event type"),
    date_from: datetime | None = Query(default=None, description="Start date (inclusive)"),
    date_to: datetime | None = Query(default=None, description="End date (inclusive)"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    _operator: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
):
    """List connection events with filtering and pagination (operator+)."""
    query = select(ConnectionEvent)
    count_query = select(func.count(ConnectionEvent.id))

    if device_id is not None:
        query = query.where(ConnectionEvent.device_id == device_id)
        count_query = count_query.where(ConnectionEvent.device_id == device_id)
    if peer_id is not None:
        query = query.where(ConnectionEvent.peer_id == peer_id)
        count_query = count_query.where(ConnectionEvent.peer_id == peer_id)
    if event_type is not None:
        query = query.where(ConnectionEvent.event_type == event_type)
        count_query = count_query.where(ConnectionEvent.event_type == event_type)
    if date_from is not None:
        query = query.where(ConnectionEvent.created_at >= date_from)
        count_query = count_query.where(ConnectionEvent.created_at >= date_from)
    if date_to is not None:
        query = query.where(ConnectionEvent.created_at <= date_to)
        count_query = count_query.where(ConnectionEvent.created_at <= date_to)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(ConnectionEvent.created_at.desc())
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    events = result.scalars().all()

    return ConnectionEventListResponse(
        events=[ConnectionEventResponse.model_validate(e) for e in events],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.get("/active", response_model=list[ActiveSessionResponse])
async def list_active_sessions(
    _operator: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
):
    """List active connection sessions (operator+).

    Returns connect events from the last 24 hours that have no corresponding
    disconnect event with the same session_id.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    # Subquery: session_ids that have a disconnect event
    disconnected_sessions = (
        select(ConnectionEvent.session_id)
        .where(ConnectionEvent.event_type == "disconnect")
        .scalar_subquery()
    )

    query = (
        select(ConnectionEvent)
        .where(
            and_(
                ConnectionEvent.event_type == "connect",
                ConnectionEvent.created_at >= cutoff,
                ConnectionEvent.session_id.notin_(disconnected_sessions),
            )
        )
        .order_by(ConnectionEvent.created_at.desc())
    )

    result = await db.execute(query)
    events = result.scalars().all()

    return [
        ActiveSessionResponse(
            session_id=e.session_id,
            device_id=e.device_id,
            peer_id=e.peer_id,
            peer_username=e.peer_username,
            peer_hostname=e.peer_hostname,
            ip_address=e.ip_address,
            connected_at=e.created_at,
        )
        for e in events
    ]
