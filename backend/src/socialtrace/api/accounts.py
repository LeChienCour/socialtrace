import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from socialtrace.api.auth import require_api_token
from socialtrace.db.session import get_db_session
from socialtrace.models import Account, AccountSnapshot
from socialtrace.schemas.account import AccountCreate, AccountRead, AccountUpdate
from socialtrace.schemas.account_snapshot import AccountSnapshotCreate, AccountSnapshotRead

router = APIRouter(prefix="/accounts", tags=["accounts"], dependencies=[Depends(require_api_token)])

DbSession = Annotated[AsyncSession, Depends(get_db_session)]


@router.get("", response_model=list[AccountRead])
async def list_accounts(session: DbSession) -> list[Account]:
    result = await session.execute(select(Account).order_by(Account.created_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=AccountRead, status_code=201)
async def create_account(payload: AccountCreate, session: DbSession) -> Account:
    account = Account(**payload.model_dump())
    session.add(account)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="an account with this platform and handle already exists"
        ) from exc
    await session.refresh(account)
    return account


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: uuid.UUID, payload: AccountUpdate, session: DbSession
) -> Account:
    account = await session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    await session.commit()
    await session.refresh(account)
    return account


@router.get("/{account_id}/snapshots", response_model=list[AccountSnapshotRead])
async def list_account_snapshots(
    account_id: uuid.UUID,
    session: DbSession,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
) -> list[AccountSnapshot]:
    account = await session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")
    stmt = (
        select(AccountSnapshot)
        .where(AccountSnapshot.account_id == account_id)
        .order_by(AccountSnapshot.captured_at.desc())
    )
    if from_ is not None:
        stmt = stmt.where(AccountSnapshot.captured_at >= from_)
    if to is not None:
        stmt = stmt.where(AccountSnapshot.captured_at <= to)
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("/{account_id}/snapshots", response_model=AccountSnapshotRead, status_code=201)
async def create_account_snapshot(
    account_id: uuid.UUID, payload: AccountSnapshotCreate, session: DbSession
) -> AccountSnapshot:
    account = await session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")
    data = payload.model_dump()
    data["captured_at"] = data["captured_at"] or datetime.now(UTC)
    snapshot = AccountSnapshot(account_id=account_id, **data)
    session.add(snapshot)
    await session.commit()
    await session.refresh(snapshot)
    return snapshot
