import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.notification import NotificationRule

logger = logging.getLogger(__name__)


async def send_email(to_addresses: list[str], subject: str, body_html: str) -> bool:
    """Send an email via SMTP. Returns True on success, False on failure."""
    if not settings.SMTP_ENABLED:
        logger.warning("SMTP is not enabled, skipping email")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = (
            f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
            if settings.SMTP_FROM_NAME
            else settings.SMTP_FROM_EMAIL
        )
        msg["To"] = ", ".join(to_addresses)
        msg.attach(MIMEText(body_html, "html"))

        if settings.SMTP_USE_TLS:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            server.ehlo()

        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        server.sendmail(
            settings.SMTP_FROM_EMAIL,
            to_addresses,
            msg.as_string(),
        )
        server.quit()
        logger.info("Email sent successfully to %s", to_addresses)
        return True

    except Exception:
        logger.exception("Failed to send email to %s", to_addresses)
        return False


async def send_notification(
    event_type: str, subject: str, body_html: str, db: AsyncSession
) -> None:
    """Look up notification rules matching event_type, send to all recipients."""
    result = await db.execute(
        select(NotificationRule).where(
            NotificationRule.event_type == event_type,
            NotificationRule.enabled.is_(True),
        )
    )
    rules = result.scalars().all()

    for rule in rules:
        recipients = [
            addr.strip()
            for addr in rule.recipients.split(",")
            if addr.strip()
        ]
        if recipients:
            await send_email(recipients, subject, body_html)


def build_device_email(device_id: str, hostname: str, event: str) -> tuple[str, str]:
    """Build subject + HTML body for device-related notifications."""
    event_labels = {
        "new_device": "New Device Registered",
        "device_offline": "Device Went Offline",
    }
    label = event_labels.get(event, event.replace("_", " ").title())
    subject = f"[Aspendora] {label}: {hostname or device_id}"

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4f46e5; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">{label}</h2>
        </div>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px;">Device ID</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">{device_id}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Hostname</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">{hostname or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Event</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">{label}</td>
                </tr>
            </table>
            <p style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                This notification was sent by Aspendora Remote Console.
            </p>
        </div>
    </div>
    """
    return subject, html_body


def build_connection_email(
    device_id: str, peer_id: str, event: str
) -> tuple[str, str]:
    """Build subject + HTML body for connection-related notifications."""
    event_labels = {
        "connection_started": "Connection Started",
        "connection_ended": "Connection Ended",
    }
    label = event_labels.get(event, event.replace("_", " ").title())
    subject = f"[Aspendora] {label}: {device_id}"

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4f46e5; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">{label}</h2>
        </div>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px;">Device ID</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">{device_id}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Peer ID</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">{peer_id}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Event</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">{label}</td>
                </tr>
            </table>
            <p style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                This notification was sent by Aspendora Remote Console.
            </p>
        </div>
    </div>
    """
    return subject, html_body
