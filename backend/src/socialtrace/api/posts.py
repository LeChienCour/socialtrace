import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from socialtrace.api.auth import require_api_token
from socialtrace.db.session import get_db_session
from socialtrace.models import Post, PostSnapshot
from socialtrace.schemas.post import PostCreate, PostRead, PostUpdate
from socialtrace.schemas.post_snapshot import (
    PostSnapshotCreate,
    PostSnapshotRead,
    PostSnapshotUpdate,
)

router = APIRouter(prefix="/posts", tags=["posts"], dependencies=[Depends(require_api_token)])

DbSession = Annotated[AsyncSession, Depends(get_db_session)]


@router.get("", response_model=list[PostRead])
async def list_posts(
    session: DbSession,
    account_id: uuid.UUID | None = None,
    campaign: str | None = None,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
) -> list[Post]:
    # `status` (due/overdue/captured) lives at /tasks — a unified tray query
    # over all posts/accounts, not a per-listing filter here.
    stmt = select(Post).order_by(Post.published_at.desc())
    if account_id is not None:
        stmt = stmt.where(Post.account_id == account_id)
    if campaign is not None:
        stmt = stmt.where(Post.campaign == campaign)
    if from_ is not None:
        stmt = stmt.where(Post.published_at >= from_)
    if to is not None:
        stmt = stmt.where(Post.published_at <= to)
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=PostRead, status_code=201)
async def create_post(payload: PostCreate, session: DbSession) -> Post:
    post = Post(**payload.model_dump())
    session.add(post)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=400, detail="invalid post (check that account_id exists)"
        ) from exc
    await session.refresh(post)
    return post


@router.patch("/{post_id}", response_model=PostRead)
async def update_post(post_id: uuid.UUID, payload: PostUpdate, session: DbSession) -> Post:
    post = await session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    if not post.url and not post.description:
        raise HTTPException(status_code=400, detail="post requires a url or a description")
    await session.commit()
    await session.refresh(post)
    return post


@router.delete("/{post_id}", status_code=204)
async def delete_post(post_id: uuid.UUID, session: DbSession) -> Response:
    post = await session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    await session.delete(post)
    await session.commit()
    return Response(status_code=204)


@router.get("/{post_id}/snapshots", response_model=list[PostSnapshotRead])
async def list_post_snapshots(post_id: uuid.UUID, session: DbSession) -> list[PostSnapshot]:
    post = await session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    result = await session.execute(
        select(PostSnapshot)
        .where(PostSnapshot.post_id == post_id)
        .order_by(PostSnapshot.captured_at)
    )
    return list(result.scalars().all())


@router.post("/{post_id}/snapshots", response_model=PostSnapshotRead, status_code=201)
async def create_post_snapshot(
    post_id: uuid.UUID, payload: PostSnapshotCreate, session: DbSession
) -> PostSnapshot:
    post = await session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    data = payload.model_dump()
    data["captured_at"] = data["captured_at"] or datetime.now(UTC)
    snapshot = PostSnapshot(post_id=post_id, **data)
    session.add(snapshot)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="a snapshot for this window already exists for this post"
        ) from exc
    await session.refresh(snapshot)
    return snapshot


@router.patch("/{post_id}/snapshots/{snapshot_id}", response_model=PostSnapshotRead)
async def update_post_snapshot(
    post_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    payload: PostSnapshotUpdate,
    session: DbSession,
) -> PostSnapshot:
    snapshot = await session.get(PostSnapshot, snapshot_id)
    if snapshot is None or snapshot.post_id != post_id:
        raise HTTPException(status_code=404, detail="snapshot not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(snapshot, field, value)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="a snapshot for this window already exists for this post"
        ) from exc
    await session.refresh(snapshot)
    return snapshot


@router.delete("/{post_id}/snapshots/{snapshot_id}", status_code=204)
async def delete_post_snapshot(
    post_id: uuid.UUID, snapshot_id: uuid.UUID, session: DbSession
) -> Response:
    snapshot = await session.get(PostSnapshot, snapshot_id)
    if snapshot is None or snapshot.post_id != post_id:
        raise HTTPException(status_code=404, detail="snapshot not found")
    await session.delete(snapshot)
    await session.commit()
    return Response(status_code=204)
