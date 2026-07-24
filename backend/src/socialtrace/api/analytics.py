import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from socialtrace.analytics import (
    GrowthGranularity,
    bucket_account_snapshots,
    compute_engagement_rate,
)
from socialtrace.api.auth import require_api_token
from socialtrace.db.session import get_db_session
from socialtrace.models import Account, AccountSnapshot, Post, PostSnapshot
from socialtrace.schemas.analytics import (
    BenchmarkGroup,
    BenchmarksResponse,
    GrowthPointResponse,
    OverviewResponse,
    PostCurve,
    PostCurvePoint,
)

router = APIRouter(
    prefix="/analytics", tags=["analytics"], dependencies=[Depends(require_api_token)]
)

DbSession = Annotated[AsyncSession, Depends(get_db_session)]


async def _latest_post_snapshots(session: DbSession) -> dict[uuid.UUID, PostSnapshot]:
    rows = (await session.execute(select(PostSnapshot))).scalars().all()
    latest: dict[uuid.UUID, PostSnapshot] = {}
    for row in rows:
        current = latest.get(row.post_id)
        if current is None or row.captured_at > current.captured_at:
            latest[row.post_id] = row
    return latest


async def _latest_account_followers(session: DbSession) -> dict[uuid.UUID, int | None]:
    rows = (await session.execute(select(AccountSnapshot))).scalars().all()
    latest: dict[uuid.UUID, AccountSnapshot] = {}
    for row in rows:
        current = latest.get(row.account_id)
        if current is None or row.captured_at > current.captured_at:
            latest[row.account_id] = row
    return {account_id: snapshot.followers for account_id, snapshot in latest.items()}


@router.get("/overview", response_model=OverviewResponse)
async def overview(session: DbSession) -> OverviewResponse:
    total_accounts = (await session.execute(select(func.count()).select_from(Account))).scalar_one()
    total_posts = (await session.execute(select(func.count()).select_from(Post))).scalar_one()

    week_ago = datetime.now(UTC) - timedelta(days=7)
    post_snaps_7d = (
        await session.execute(
            select(func.count())
            .select_from(PostSnapshot)
            .where(PostSnapshot.captured_at >= week_ago)
        )
    ).scalar_one()
    account_snaps_7d = (
        await session.execute(
            select(func.count())
            .select_from(AccountSnapshot)
            .where(AccountSnapshot.captured_at >= week_ago)
        )
    ).scalar_one()

    posts = (await session.execute(select(Post))).scalars().all()
    latest_snapshots = await _latest_post_snapshots(session)
    followers_by_account = await _latest_account_followers(session)

    rates: list[float] = []
    for post in posts:
        snapshot = latest_snapshots.get(post.id)
        if snapshot is None:
            continue
        rate = compute_engagement_rate(
            snapshot.likes,
            snapshot.comments,
            snapshot.shares,
            snapshot.saves,
            snapshot.reach,
            snapshot.impressions,
            followers_by_account.get(post.account_id),
        )
        if rate is not None:
            rates.append(rate)

    return OverviewResponse(
        total_accounts=total_accounts,
        total_posts=total_posts,
        captures_last_7d=post_snaps_7d + account_snaps_7d,
        avg_engagement_rate=sum(rates) / len(rates) if rates else None,
    )


@router.get("/benchmarks", response_model=BenchmarksResponse)
async def benchmarks(session: DbSession) -> BenchmarksResponse:
    posts = (await session.execute(select(Post))).scalars().all()
    accounts = {a.id: a for a in (await session.execute(select(Account))).scalars().all()}
    latest_snapshots = await _latest_post_snapshots(session)
    followers_by_account = await _latest_account_followers(session)

    by_platform: dict[str, list[float]] = defaultdict(list)
    by_content_type: dict[str, list[float]] = defaultdict(list)

    for post in posts:
        snapshot = latest_snapshots.get(post.id)
        if snapshot is None:
            continue
        account = accounts.get(post.account_id)
        if account is None:
            continue
        rate = compute_engagement_rate(
            snapshot.likes,
            snapshot.comments,
            snapshot.shares,
            snapshot.saves,
            snapshot.reach,
            snapshot.impressions,
            followers_by_account.get(post.account_id),
        )
        if rate is None:
            continue
        by_platform[account.platform].append(rate)
        if post.content_type:
            by_content_type[post.content_type].append(rate)

    def summarize(groups: dict[str, list[float]]) -> list[BenchmarkGroup]:
        return [
            BenchmarkGroup(
                key=key, avg_engagement_rate=sum(values) / len(values), sample_size=len(values)
            )
            for key, values in sorted(groups.items())
        ]

    return BenchmarksResponse(
        by_platform=summarize(by_platform), by_content_type=summarize(by_content_type)
    )


@router.get("/growth", response_model=list[GrowthPointResponse])
async def growth(
    session: DbSession,
    account_id: uuid.UUID,
    granularity: GrowthGranularity = "day",
) -> list[GrowthPointResponse]:
    account = await session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")

    rows = (
        (
            await session.execute(
                select(AccountSnapshot)
                .where(AccountSnapshot.account_id == account_id)
                .order_by(AccountSnapshot.captured_at)
            )
        )
        .scalars()
        .all()
    )

    return [
        GrowthPointResponse(
            period_start=point.period_start,
            followers=point.followers,
            reach=point.reach,
            impressions=point.impressions,
            profile_visits=point.profile_visits,
        )
        for point in bucket_account_snapshots(list(rows), granularity)
    ]


@router.get("/post-curves", response_model=list[PostCurve])
async def post_curves(
    session: DbSession,
    ids: Annotated[str, Query(description="comma-separated post ids")],
) -> list[PostCurve]:
    post_ids = [uuid.UUID(raw.strip()) for raw in ids.split(",") if raw.strip()]
    posts_by_id = {
        p.id: p
        for p in (await session.execute(select(Post).where(Post.id.in_(post_ids)))).scalars().all()
    }

    snapshots = (
        (
            await session.execute(
                select(PostSnapshot)
                .where(PostSnapshot.post_id.in_(post_ids))
                .order_by(PostSnapshot.captured_at)
            )
        )
        .scalars()
        .all()
    )

    followers_by_account = await _latest_account_followers(session)

    points_by_post: dict[uuid.UUID, list[PostCurvePoint]] = defaultdict(list)
    for snapshot in snapshots:
        post = posts_by_id.get(snapshot.post_id)
        if post is None:
            continue
        hours_since_published = (snapshot.captured_at - post.published_at).total_seconds() / 3600
        rate = compute_engagement_rate(
            snapshot.likes,
            snapshot.comments,
            snapshot.shares,
            snapshot.saves,
            snapshot.reach,
            snapshot.impressions,
            followers_by_account.get(post.account_id),
        )
        points_by_post[snapshot.post_id].append(
            PostCurvePoint(
                captured_at=snapshot.captured_at,
                hours_since_published=hours_since_published,
                window_key=snapshot.window_key,
                views=snapshot.views,
                likes=snapshot.likes,
                comments=snapshot.comments,
                shares=snapshot.shares,
                saves=snapshot.saves,
                reach=snapshot.reach,
                impressions=snapshot.impressions,
                engagement_rate=rate,
            )
        )

    return [
        PostCurve(
            post_id=post_id,
            label=posts_by_id[post_id].description or posts_by_id[post_id].url or str(post_id),
            points=points,
        )
        for post_id, points in points_by_post.items()
    ]
