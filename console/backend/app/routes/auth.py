import base64
import json
import secrets
from io import BytesIO
from urllib.parse import urlencode

import httpx
import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import Token
from app.schemas.totp import TOTPDisableRequest, TOTPSetupResponse, TOTPVerifyRequest
from app.schemas.user import ChangePassword, UserLogin, UserResponse
from app.services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate with email + password and return a JWT.

    If the user has TOTP enabled, a valid `totp_code` must also be provided.
    If TOTP is enabled and no code is supplied, returns 403 with `totp_required: true`.
    """
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # TOTP check
    if user.totp_enabled:
        if not body.totp_code:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "TOTP code required", "totp_required": True},
            )
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(body.totp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid TOTP code",
            )

    token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user).model_dump(mode="json"),
    }


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.post("/change-password", response_model=UserResponse)
async def change_password(
    body: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = hash_password(body.new_password)
    current_user.must_change_password = False
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


# ---------------------------------------------------------------------------
# TOTP endpoints
# ---------------------------------------------------------------------------

@router.post("/totp/setup", response_model=TOTPSetupResponse)
async def totp_setup(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a TOTP secret and QR code for the current user.

    Requires authentication. Fails if TOTP is already enabled.
    """
    if current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP is already enabled for this account",
        )

    # Generate a new TOTP secret
    secret = pyotp.random_base32()

    # Store the secret (not yet enabled — user must verify first)
    current_user.totp_secret = secret
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    # Build the otpauth URI
    totp = pyotp.TOTP(secret)
    qr_uri = totp.provisioning_uri(
        name=current_user.email,
        issuer_name="Aspendora Remote Console",
    )

    # Generate QR code as base64 PNG
    img = qrcode.make(qr_uri)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return TOTPSetupResponse(
        secret=secret,
        qr_uri=qr_uri,
        qr_base64=qr_base64,
    )


@router.post("/totp/verify")
async def totp_verify(
    body: TOTPVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify a TOTP code and enable TOTP for the current user.

    The user must have called /totp/setup first to get a secret.
    """
    if current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP is already enabled",
        )
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No TOTP secret found. Call /totp/setup first.",
        )

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(body.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code",
        )

    current_user.totp_enabled = True
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return {"detail": "TOTP enabled successfully"}


@router.post("/totp/disable")
async def totp_disable(
    body: TOTPDisableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable TOTP for the current user. Requires the current password."""
    if not current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP is not enabled",
        )

    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.totp_enabled = False
    current_user.totp_secret = None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return {"detail": "TOTP disabled successfully"}


# ---------------------------------------------------------------------------
# Microsoft Entra ID SSO endpoints
# ---------------------------------------------------------------------------

# Simple in-memory state store for CSRF protection (maps state -> True)
_sso_pending_states: dict[str, bool] = {}


@router.get("/sso/enabled")
async def sso_status():
    """Return whether SSO is enabled (public, no auth needed)."""
    return {"enabled": settings.ENTRA_ENABLED, "provider": "microsoft"}


@router.get("/sso/authorize")
async def sso_authorize():
    """Return the Microsoft authorization URL to redirect the user to."""
    if not settings.ENTRA_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SSO is not configured",
        )

    state = secrets.token_urlsafe(32)
    _sso_pending_states[state] = True

    # Limit stored states to prevent unbounded growth
    if len(_sso_pending_states) > 1000:
        oldest_keys = list(_sso_pending_states.keys())[:-500]
        for k in oldest_keys:
            _sso_pending_states.pop(k, None)

    params = {
        "client_id": settings.ENTRA_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.ENTRA_REDIRECT_URI,
        "scope": "openid profile email User.Read",
        "state": state,
        "response_mode": "query",
    }
    authorize_url = (
        f"https://login.microsoftonline.com/{settings.ENTRA_TENANT_ID}"
        f"/oauth2/v2.0/authorize?{urlencode(params)}"
    )
    return {"authorize_url": authorize_url}


@router.get("/sso/callback")
async def sso_callback(
    code: str,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Exchange the authorization code for tokens, provision user, and redirect with JWT."""
    if not settings.ENTRA_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SSO is not configured",
        )

    # Validate CSRF state
    if not state or not _sso_pending_states.pop(state, False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired SSO state parameter",
        )

    # 1. Exchange authorization code for tokens
    token_url = (
        f"https://login.microsoftonline.com/{settings.ENTRA_TENANT_ID}"
        f"/oauth2/v2.0/token"
    )
    token_body = {
        "client_id": settings.ENTRA_CLIENT_ID,
        "client_secret": settings.ENTRA_CLIENT_SECRET,
        "code": code,
        "redirect_uri": settings.ENTRA_REDIRECT_URI,
        "grant_type": "authorization_code",
        "scope": "openid profile email User.Read",
    }

    import logging
    logger = logging.getLogger(__name__)

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(token_url, data=token_body)
        if token_resp.status_code != 200:
            logger.error("Token exchange failed: %s %s", token_resp.status_code, token_resp.text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to exchange authorization code with Microsoft",
            )
        token_data = token_resp.json()

    access_token_ms = token_data.get("access_token")
    if not access_token_ms:
        logger.error("No access_token in response: %s", list(token_data.keys()))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No access token received from Microsoft",
        )

    # 2. Get user info from Microsoft Graph
    async with httpx.AsyncClient() as client:
        graph_resp = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token_ms}"},
        )
        if graph_resp.status_code != 200:
            logger.error("Graph /me failed: %s %s", graph_resp.status_code, graph_resp.text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to fetch user profile from Microsoft Graph ({graph_resp.status_code})",
            )
        profile = graph_resp.json()

    email = (
        profile.get("mail")
        or profile.get("userPrincipalName")
        or ""
    ).lower().strip()
    display_name = profile.get("displayName") or email.split("@")[0]

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not determine email address from Microsoft profile",
        )

    # 3. Look up or auto-provision user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        # Auto-provision with role=viewer
        username = email.split("@")[0]
        # Ensure username uniqueness by appending random suffix if needed
        existing = await db.execute(
            select(User).where(User.username == username)
        )
        if existing.scalar_one_or_none() is not None:
            username = f"{username}_{secrets.token_hex(4)}"

        user = User(
            email=email,
            username=username,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=display_name,
            role=UserRole.viewer,
            is_active=True,
            must_change_password=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # 4. Create our JWT access token
    jwt_token = create_access_token(data={"sub": str(user.id)})

    # 5. Redirect to frontend SSO callback page
    user_data = UserResponse.model_validate(user).model_dump(mode="json")
    user_json = json.dumps(user_data)

    redirect_params = urlencode({"token": jwt_token, "user": user_json})
    frontend_url = "https://rd.aspendora.com/sso-callback"

    # Use the CORS origin to determine the frontend base URL for dev
    if "http://localhost:5173" in settings.CORS_ORIGINS:
        # Check referer or just default to production
        pass

    return RedirectResponse(
        url=f"{frontend_url}?{redirect_params}",
        status_code=status.HTTP_302_FOUND,
    )
