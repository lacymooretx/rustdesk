import math
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogListResponse, AuditLogResponse
from app.services.auth import require_admin

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    q: str | None = Query(default=None, description="Search user_email, action, or resource_id"),
    user_id: uuid.UUID | None = Query(default=None, description="Filter by user ID"),
    action: str | None = Query(default=None, description="Filter by action prefix (e.g. 'device')"),
    resource_type: str | None = Query(default=None, description="Filter by resource type"),
    date_from: datetime | None = Query(default=None, description="Start date (inclusive)"),
    date_to: datetime | None = Query(default=None, description="End date (inclusive)"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List audit log entries with filtering and pagination (admin only)."""
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    if q is not None:
        like_q = f"%{q}%"
        search_clause = (
            AuditLog.user_email.ilike(like_q)
            | AuditLog.action.ilike(like_q)
            | AuditLog.resource_id.ilike(like_q)
        )
        query = query.where(search_clause)
        count_query = count_query.where(search_clause)
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)
    if action is not None:
        query = query.where(AuditLog.action.ilike(f"{action}%"))
        count_query = count_query.where(AuditLog.action.ilike(f"{action}%"))
    if resource_type is not None:
        query = query.where(AuditLog.resource_type == resource_type)
        count_query = count_query.where(AuditLog.resource_type == resource_type)
    if date_from is not None:
        query = query.where(AuditLog.created_at >= date_from)
        count_query = count_query.where(AuditLog.created_at >= date_from)
    if date_to is not None:
        query = query.where(AuditLog.created_at <= date_to)
        count_query = count_query.where(AuditLog.created_at <= date_to)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(AuditLog.created_at.desc())
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    logs = result.scalars().all()

    return AuditLogListResponse(
        logs=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )
