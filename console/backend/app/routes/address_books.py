import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.address_book import AddressBook, AddressBookEntry, AddressBookPermission
from app.models.groups import UserGroup, UserGroupMember
from app.models.user import User, UserRole
from app.schemas.address_book import (
    AddressBookCreate,
    AddressBookEntryCreate,
    AddressBookEntryResponse,
    AddressBookEntryUpdate,
    AddressBookListResponse,
    AddressBookPermissionCreate,
    AddressBookPermissionResponse,
    AddressBookResponse,
    AddressBookUpdate,
)
from app.services.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/address-books", tags=["address-books"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _book_to_response(
    db: AsyncSession, book: AddressBook
) -> AddressBookResponse:
    """Convert an AddressBook ORM object to a response with entry count."""
    count_result = await db.execute(
        select(func.count(AddressBookEntry.id)).where(
            AddressBookEntry.book_id == book.id
        )
    )
    entry_count = count_result.scalar() or 0
    return AddressBookResponse(
        id=book.id,
        name=book.name,
        owner_id=book.owner_id,
        is_personal=book.is_personal,
        description=book.description,
        entry_count=entry_count,
        created_at=book.created_at,
        updated_at=book.updated_at,
    )


async def check_book_access(
    db: AsyncSession, book: AddressBook, user: User, require_write: bool = False
) -> bool:
    """Check if a user can access this book. Raises 403 if not."""
    # Admins can access everything
    if user.role == UserRole.admin:
        return True

    # Owner can access their personal book
    if book.is_personal and book.owner_id == user.id:
        return True

    # For shared books, check if user is in a group with permission
    if not book.is_personal:
        # Find groups the user belongs to
        user_group_ids_result = await db.execute(
            select(UserGroupMember.group_id).where(
                UserGroupMember.user_id == user.id
            )
        )
        user_group_ids = [row[0] for row in user_group_ids_result.all()]

        if user_group_ids:
            perm_query = select(AddressBookPermission).where(
                AddressBookPermission.book_id == book.id,
                AddressBookPermission.user_group_id.in_(user_group_ids),
            )
            perm_result = await db.execute(perm_query)
            permissions = perm_result.scalars().all()

            if permissions:
                if require_write:
                    # Need at least one "write" permission
                    if any(p.permission == "write" for p in permissions):
                        return True
                else:
                    # Any permission (read or write) grants access
                    return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this address book",
    )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.get("", response_model=AddressBookListResponse)
async def list_address_books(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List address books the current user can access.

    Admins see all books. Others see their personal book plus shared books
    where their user group has a permission entry.
    """
    if current_user.role == UserRole.admin:
        result = await db.execute(
            select(AddressBook).order_by(AddressBook.name.asc())
        )
        books = result.scalars().all()
    else:
        # Personal books owned by user
        personal_result = await db.execute(
            select(AddressBook).where(
                AddressBook.is_personal.is_(True),
                AddressBook.owner_id == current_user.id,
            )
        )
        personal_books = list(personal_result.scalars().all())

        # Shared books via group permissions
        user_group_ids_result = await db.execute(
            select(UserGroupMember.group_id).where(
                UserGroupMember.user_id == current_user.id
            )
        )
        user_group_ids = [row[0] for row in user_group_ids_result.all()]

        shared_books: list[AddressBook] = []
        if user_group_ids:
            shared_book_ids_result = await db.execute(
                select(AddressBookPermission.book_id).where(
                    AddressBookPermission.user_group_id.in_(user_group_ids)
                ).distinct()
            )
            shared_book_ids = [row[0] for row in shared_book_ids_result.all()]

            if shared_book_ids:
                shared_result = await db.execute(
                    select(AddressBook).where(
                        AddressBook.id.in_(shared_book_ids)
                    ).order_by(AddressBook.name.asc())
                )
                shared_books = list(shared_result.scalars().all())

        # Combine and deduplicate
        seen_ids = set()
        books = []
        for b in personal_books + shared_books:
            if b.id not in seen_ids:
                seen_ids.add(b.id)
                books.append(b)

    book_responses = []
    for b in books:
        book_responses.append(await _book_to_response(db, b))

    return AddressBookListResponse(books=book_responses)


@router.post("", response_model=AddressBookResponse, status_code=status.HTTP_201_CREATED)
async def create_address_book(
    body: AddressBookCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an address book.

    Personal books: any authenticated user (owner_id = current user).
    Shared books: admin only (owner_id = null).
    """
    if body.is_personal:
        owner_id = current_user.id
    else:
        # Shared books require admin
        if current_user.role != UserRole.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required to create shared address books",
            )
        owner_id = None

    book = AddressBook(
        name=body.name,
        description=body.description,
        is_personal=body.is_personal,
        owner_id=owner_id,
    )
    db.add(book)
    await db.commit()
    await db.refresh(book)
    return await _book_to_response(db, book)


@router.get("/{book_id}", response_model=AddressBookResponse)
async def get_address_book(
    book_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get an address book by ID (must have access)."""
    result = await db.execute(
        select(AddressBook).where(AddressBook.id == book_id)
    )
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address book not found",
        )

    await check_book_access(db, book, current_user)
    resp = await _book_to_response(db, book)

    # Include entries in the detail response
    entries_result = await db.execute(
        select(AddressBookEntry)
        .where(AddressBookEntry.book_id == book_id)
        .order_by(AddressBookEntry.created_at.asc())
    )
    resp.entries = [
        AddressBookEntryResponse.model_validate(e)
        for e in entries_result.scalars().all()
    ]
    return resp


@router.patch("/{book_id}", response_model=AddressBookResponse)
async def update_address_book(
    book_id: uuid.UUID,
    body: AddressBookUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an address book's name or description (owner or admin)."""
    result = await db.execute(
        select(AddressBook).where(AddressBook.id == book_id)
    )
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address book not found",
        )

    # Only owner or admin can update
    if current_user.role != UserRole.admin and book.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner or an admin can update this address book",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(book, field, value)

    db.add(book)
    await db.commit()
    await db.refresh(book)
    return await _book_to_response(db, book)


@router.delete("/{book_id}", status_code=204)
async def delete_address_book(
    book_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an address book (owner for personal, admin for shared)."""
    result = await db.execute(
        select(AddressBook).where(AddressBook.id == book_id)
    )
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address book not found",
        )

    if book.is_personal:
        if current_user.role != UserRole.admin and book.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner or an admin can delete this address book",
            )
    else:
        if current_user.role != UserRole.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required to delete shared address books",
            )

    await db.delete(book)
    await db.commit()


# ---------------------------------------------------------------------------
# Entries
# ---------------------------------------------------------------------------


@router.post(
    "/{book_id}/entries",
    response_model=AddressBookEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_address_book_entry(
    book_id: uuid.UUID,
    body: AddressBookEntryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an entry to an address book (owner, admin, or write permission)."""
    result = await db.execute(
        select(AddressBook).where(AddressBook.id == book_id)
    )
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address book not found",
        )

    await check_book_access(db, book, current_user, require_write=True)

    # Check for duplicate entry
    existing = await db.execute(
        select(AddressBookEntry).where(
            AddressBookEntry.book_id == book_id,
            AddressBookEntry.device_id == body.device_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device '{body.device_id}' is already in this address book",
        )

    entry = AddressBookEntry(
        book_id=book_id,
        device_id=body.device_id,
        alias=body.alias,
        tags=body.tags,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch(
    "/{book_id}/entries/{entry_id}",
    response_model=AddressBookEntryResponse,
)
async def update_address_book_entry(
    book_id: uuid.UUID,
    entry_id: uuid.UUID,
    body: AddressBookEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an address book entry's alias or tags (owner, admin, or write permission)."""
    result = await db.execute(
        select(AddressBook).where(AddressBook.id == book_id)
    )
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address book not found",
        )

    await check_book_access(db, book, current_user, require_write=True)

    entry_result = await db.execute(
        select(AddressBookEntry).where(
            AddressBookEntry.id == entry_id,
            AddressBookEntry.book_id == book_id,
        )
    )
    entry = entry_result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entry not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(entry, field, value)

    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{book_id}/entries/{entry_id}", status_code=204)
async def remove_address_book_entry(
    book_id: uuid.UUID,
    entry_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an entry from an address book (owner, admin, or write permission)."""
    result = await db.execute(
        select(AddressBook).where(AddressBook.id == book_id)
    )
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address book not found",
        )

    await check_book_access(db, book, current_user, require_write=True)

    entry_result = await db.execute(
        select(AddressBookEntry).where(
            AddressBookEntry.id == entry_id,
            AddressBookEntry.book_id == book_id,
        )
    )
    entry = entry_result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entry not found",
        )

    await db.delete(entry)
    await db.commit()


# ---------------------------------------------------------------------------
# Permissions (shared books only, admin only)
# ---------------------------------------------------------------------------


@router.get(
    "/{book_id}/permissions",
    response_model=list[AddressBookPermissionResponse],
)
async def list_address_book_permissions(
    book_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List permissions for an address book (admin only)."""
    result = await db.execute(
        select(AddressBook).where(AddressBook.id == book_id)
    )
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address book not found",
        )

    perm_result = await db.execute(
        select(AddressBookPermission).where(
            AddressBookPermission.book_id == book_id
        )
    )
    permissions = perm_result.scalars().all()

    responses = []
    for p in permissions:
        # Resolve user group name
        group_result = await db.execute(
            select(UserGroup.name).where(UserGroup.id == p.user_group_id)
        )
        group_name = group_result.scalar_one_or_none()

        responses.append(
            AddressBookPermissionResponse(
                id=p.id,
                book_id=p.book_id,
                user_group_id=p.user_group_id,
                user_group_name=group_name,
                permission=p.permission,
                created_at=p.created_at,
            )
        )

    return responses


@router.post(
    "/{book_id}/permissions",
    response_model=AddressBookPermissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_address_book_permission(
    book_id: uuid.UUID,
    body: AddressBookPermissionCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add a permission to an address book (admin only)."""
    # Verify book exists
    result = await db.execute(
        select(AddressBook).where(AddressBook.id == book_id)
    )
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address book not found",
        )

    # Verify user group exists
    group_result = await db.execute(
        select(UserGroup).where(UserGroup.id == body.user_group_id)
    )
    group = group_result.scalar_one_or_none()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User group not found",
        )

    # Check for duplicate
    existing = await db.execute(
        select(AddressBookPermission).where(
            AddressBookPermission.book_id == book_id,
            AddressBookPermission.user_group_id == body.user_group_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Permission for this user group already exists",
        )

    perm = AddressBookPermission(
        book_id=book_id,
        user_group_id=body.user_group_id,
        permission=body.permission,
    )
    db.add(perm)
    await db.commit()
    await db.refresh(perm)

    return AddressBookPermissionResponse(
        id=perm.id,
        book_id=perm.book_id,
        user_group_id=perm.user_group_id,
        user_group_name=group.name,
        permission=perm.permission,
        created_at=perm.created_at,
    )


@router.delete("/{book_id}/permissions/{perm_id}", status_code=204)
async def remove_address_book_permission(
    book_id: uuid.UUID,
    perm_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a permission from an address book (admin only)."""
    result = await db.execute(
        select(AddressBookPermission).where(
            AddressBookPermission.id == perm_id,
            AddressBookPermission.book_id == book_id,
        )
    )
    perm = result.scalar_one_or_none()
    if perm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found",
        )
    await db.delete(perm)
    await db.commit()
