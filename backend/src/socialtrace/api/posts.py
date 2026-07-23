import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from socialtrace.api.auth import require_api_token
from socialtrace.db.session import get_db_session
from socialtrace.models import Post
from socialtrace.schemas.post import PostCreate, PostRead, PostUpdate

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
    # `status` (due/overdue/captured) is a phase 2 concern — it's computed
    # from capture windows, which don't exist yet. Not a query param here.
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
