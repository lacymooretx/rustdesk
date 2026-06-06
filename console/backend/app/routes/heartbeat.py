from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.heartbeat import HeartbeatPayload, SysinfoPayload
from app.services.devices import upsert_device_from_heartbeat

router = APIRouter(prefix="/api", tags=["heartbeat"])


def _get_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/heartbeat")
async def receive_heartbeat(
    body: HeartbeatPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive a heartbeat from a RustDesk client (no auth required).

    Accepts both the native client format ({id, uuid, ver, conns, modified_at})
    and our manual format ({id, version, sysinfo}).
    """
    ip_address = _get_client_ip(request)

    # Normalize version: native client sends int `ver`, our format sends string `version`
    version = body.version
    if version is None and body.ver is not None:
        version = str(body.ver)

    await upsert_device_from_heartbeat(
        db=db,
        device_id=body.id,
        ip_address=ip_address,
        version=version,
        sysinfo=body.sysinfo,
        device_uuid=body.uuid,
    )

    return {"ok": True}


@router.post("/sysinfo", response_class=PlainTextResponse)
async def receive_sysinfo(
    body: SysinfoPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive sysinfo from a RustDesk client (no auth required).

    The native client uploads system information (hostname, OS, CPU, memory, etc.)
    separately from heartbeats. Expects "SYSINFO_UPDATED" as the text response.
    """
    ip_address = _get_client_ip(request)

    sysinfo = {
        "hostname": body.hostname,
        "os": body.os,
        "platform": body.os,  # map OS to platform for display
        "username": body.username,
        "cpu": body.cpu,
        "memory": body.memory,
    }
    # Remove None values
    sysinfo = {k: v for k, v in sysinfo.items() if v is not None}

    await upsert_device_from_heartbeat(
        db=db,
        device_id=body.id,
        ip_address=ip_address,
        version=body.version,
        sysinfo=sysinfo if sysinfo else None,
        device_uuid=body.uuid,
    )

    return "SYSINFO_UPDATED"
