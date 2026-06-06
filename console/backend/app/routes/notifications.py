import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.notification import NotificationRule
from app.models.user import User
from app.schemas.notification import (
    NotificationRuleCreate,
    NotificationRuleListResponse,
    NotificationRuleResponse,
    NotificationRuleUpdate,
    SMTPSettingsResponse,
)
from app.services.auth import require_admin
from app.services.email import send_email

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ---------------------------------------------------------------------------
# SMTP Settings (read-only)
# ---------------------------------------------------------------------------


@router.get("/smtp-settings", response_model=SMTPSettingsResponse)
async def get_smtp_settings(
    _admin: User = Depends(require_admin),
):
    """Return current SMTP configuration (admin only). Password is never exposed."""
    return SMTPSettingsResponse(
        smtp_host=settings.SMTP_HOST,
        smtp_port=settings.SMTP_PORT,
        smtp_from_email=settings.SMTP_FROM_EMAIL,
        smtp_from_name=settings.SMTP_FROM_NAME,
        smtp_use_tls=settings.SMTP_USE_TLS,
        smtp_enabled=settings.SMTP_ENABLED,
    )


# ---------------------------------------------------------------------------
# Notification Rules CRUD
# ---------------------------------------------------------------------------


@router.get("/rules", response_model=NotificationRuleListResponse)
async def list_notification_rules(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all notification rules (admin only)."""
    count_result = await db.execute(select(func.count(NotificationRule.id)))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(NotificationRule).order_by(NotificationRule.created_at.desc())
    )
    rules = result.scalars().all()

    return NotificationRuleListResponse(
        rules=[NotificationRuleResponse.model_validate(r) for r in rules],
        total=total,
    )


@router.post(
    "/rules",
    response_model=NotificationRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_notification_rule(
    body: NotificationRuleCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new notification rule (admin only)."""
    rule = NotificationRule(
        name=body.name,
        event_type=body.event_type,
        enabled=body.enabled,
        recipients=body.recipients,
        created_by=admin.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return NotificationRuleResponse.model_validate(rule)


@router.patch("/rules/{rule_id}", response_model=NotificationRuleResponse)
async def update_notification_rule(
    rule_id: uuid.UUID,
    body: NotificationRuleUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a notification rule (admin only)."""
    result = await db.execute(
        select(NotificationRule).where(NotificationRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification rule not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return NotificationRuleResponse.model_validate(rule)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_notification_rule(
    rule_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a notification rule (admin only)."""
    result = await db.execute(
        select(NotificationRule).where(NotificationRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification rule not found",
        )
    await db.delete(rule)
    await db.commit()


# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------


@router.post("/test/{rule_id}")
async def test_notification_rule(
    rule_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Send a test email using the specified notification rule (admin only)."""
    result = await db.execute(
        select(NotificationRule).where(NotificationRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification rule not found",
        )

    if not settings.SMTP_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP is not enabled. Configure SMTP settings via environment variables.",
        )

    recipients = [
        addr.strip() for addr in rule.recipients.split(",") if addr.strip()
    ]
    if not recipients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid recipients configured for this rule.",
        )

    subject = f"[Aspendora] Test Notification - {rule.name}"
    body_html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4f46e5; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Test Notification</h2>
        </div>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p style="color: #1e293b; font-size: 14px; margin-top: 0;">
                This is a test notification from Aspendora Remote Console.
            </p>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px;">Rule Name</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">{rule.name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Event Type</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">{rule.event_type}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Recipients</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">{rule.recipients}</td>
                </tr>
            </table>
            <p style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                If you received this email, your notification rule is configured correctly.
            </p>
        </div>
    </div>
    """

    success = await send_email(recipients, subject, body_html)
    if success:
        return {"status": "ok", "message": "Test email sent successfully."}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send test email. Check SMTP configuration and server logs.",
        )
