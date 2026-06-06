import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.api_token import APIToken
from app.models.user import User
from app.schemas.api_token import (
    APITokenCreate,
    APITokenCreatedResponse,
    APITokenListResponse,
    APITokenResponse,
    APITokenUpdate,
)
from app.services.auth import require_admin

router = APIRouter(prefix="/api/api-tokens", tags=["api-tokens"])

TOKEN_PREFIX = "arc_"
TOKEN_RANDOM_LENGTH = 48  # hex chars


def _generate_token() -> str:
    """Generate a plaintext API token: arc_ + 48 random hex chars."""
    return TOKEN_PREFIX + secrets.token_hex(TOKEN_RANDOM_LENGTH // 2)


def _hash_token(plaintext: str) -> str:
    """SHA-256 hash of the plaintext token."""
    return hashlib.sha256(plaintext.encode()).hexdigest()


def _token_to_response(token: APIToken) -> APITokenResponse:
    return APITokenResponse(
        id=token.id,
        name=token.name,
        token_prefix=token.token_prefix,
        scopes=token.scopes,
        expires_at=token.expires_at,
        last_used_at=token.last_used_at,
        is_active=token.is_active,
        created_at=token.created_at,
    )


@router.post(
    "",
    response_model=APITokenCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_token(
    body: APITokenCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new API token (admin only). Returns the plaintext token ONCE."""
    plaintext = _generate_token()
    token_hash = _hash_token(plaintext)
    token_prefix = plaintext[:8]

    expires_at = None
    if body.expires_in_days is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)

    api_token = APIToken(
        name=body.name,
        token_hash=token_hash,
        token_prefix=token_prefix,
        user_id=admin.id,
        scopes=body.scopes,
        expires_at=expires_at,
    )
    db.add(api_token)
    await db.commit()
    await db.refresh(api_token)

    return APITokenCreatedResponse(
        id=api_token.id,
        name=api_token.name,
        token_prefix=api_token.token_prefix,
        scopes=api_token.scopes,
        expires_at=api_token.expires_at,
        last_used_at=api_token.last_used_at,
        is_active=api_token.is_active,
        created_at=api_token.created_at,
        plaintext_token=plaintext,
    )


@router.get("", response_model=APITokenListResponse)
async def list_api_tokens(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all API tokens (admin only)."""
    count_result = await db.execute(select(func.count(APIToken.id)))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(APIToken).order_by(APIToken.created_at.desc())
    )
    tokens = result.scalars().all()

    return APITokenListResponse(
        tokens=[_token_to_response(t) for t in tokens],
        total=total,
    )


@router.patch("/{token_id}", response_model=APITokenResponse)
async def update_api_token(
    token_id: uuid.UUID,
    body: APITokenUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update an API token's name, scopes, or active status (admin only)."""
    result = await db.execute(
        select(APIToken).where(APIToken.id == token_id)
    )
    api_token = result.scalar_one_or_none()
    if api_token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API token not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(api_token, field, value)

    db.add(api_token)
    await db.commit()
    await db.refresh(api_token)
    return _token_to_response(api_token)


@router.delete("/{token_id}", status_code=204)
async def delete_api_token(
    token_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Revoke and delete an API token (admin only)."""
    result = await db.execute(
        select(APIToken).where(APIToken.id == token_id)
    )
    api_token = result.scalar_one_or_none()
    if api_token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API token not found",
        )
    await db.delete(api_token)
    await db.commit()
