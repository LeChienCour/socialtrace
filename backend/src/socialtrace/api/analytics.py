import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from socialtrace.analytics import (
    WEEKDAY_NAMES,
    GrowthGranularity,
    PostMetricsLike,
    bucket_account_snapshots,
    bucket_posts_by_month,
    compute_engagement_rate,
    local_publish_slot,
)
from socialtrace.api.auth import require_api_token
from socialtrace.db.session import get_db_session
from socialtrace.models import Account, AccountSnapshot, Post, PostSnapshot
from socialtrace.schemas.analytics import (
    BenchmarkGroup,
    BenchmarksResponse,
    GrowthPointResponse,
    MonthlyPointResponse,
    OverviewResponse,
    PostCurve,
    PostCurvePoint,
    PostTimelinePoint,
)

router = APIRouter(
    prefix="/analytics", tags=["analytics"], dependencies=[Depends(require_api_token)]
)

DbSession = Annotated[AsyncSession, Depends(get_db_session)]


def _posts_query(account_id: uuid.UUID | None) -> Select[tuple[Post]]:
    stmt = select(Post)
    if account_id is not None:
        stmt = stmt.where(Post.account_id == account_id)
    return stmt


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
async def overview(session: DbSession, account_id: uuid.UUID | None = None) -> OverviewResponse:
    """Headline numbers, optionally narrowed to one account so the dashboard's
    stat row follows the same filter as every chart below it."""
    accounts_stmt = select(func.count()).select_from(Account)
    posts_stmt = select(func.count()).select_from(Post)
    if account_id is not None:
        accounts_stmt = accounts_stmt.where(Account.id == account_id)
        posts_stmt = posts_stmt.where(Post.account_id == account_id)
    total_accounts = (await session.execute(accounts_stmt)).scalar_one()
    total_posts = (await session.execute(posts_stmt)).scalar_one()

    week_ago = datetime.now(UTC) - timedelta(days=7)
    post_snaps_stmt = (
        select(func.count()).select_from(PostSnapshot).where(PostSnapshot.captured_at >= week_ago)
    )
    account_snaps_stmt = (
        select(func.count())
        .select_from(AccountSnapshot)
        .where(AccountSnapshot.captured_at >= week_ago)
    )
    if account_id is not None:
        post_snaps_stmt = post_snaps_stmt.where(
            PostSnapshot.post_id.in_(select(Post.id).where(Post.account_id == account_id))
        )
        account_snaps_stmt = account_snaps_stmt.where(AccountSnapshot.account_id == account_id)
    post_snaps_7d = (await session.execute(post_snaps_stmt)).scalar_one()
    account_snaps_7d = (await session.execute(account_snaps_stmt)).scalar_one()

    posts = (await session.execute(_posts_query(account_id))).scalars().all()
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


_Row = tuple[float | None, int | None, int | None, int | None]


@router.get("/benchmarks", response_model=BenchmarksResponse)
async def benchmarks(session: DbSession, account_id: uuid.UUID | None = None) -> BenchmarksResponse:
    """What performs best, sliced every way we can slice it: platform, format,
    publish hour, weekday, campaign and tag — optionally narrowed to a single
    account."""
    posts = (await session.execute(_posts_query(account_id))).scalars().all()
    accounts = {a.id: a for a in (await session.execute(select(Account))).scalars().all()}
    latest_snapshots = await _latest_post_snapshots(session)
    followers_by_account = await _latest_account_followers(session)

    # Benchmarks answer "which slice performs best, and by what measure" —
    # engagement rate alone hides whether that rate comes from a handful of
    # views or tens of thousands, so track raw views/reach/likes alongside it
    # per group.
    by_platform: dict[str, list[_Row]] = defaultdict(list)
    by_content_type: dict[str, list[_Row]] = defaultdict(list)
    by_hour: dict[str, list[_Row]] = defaultdict(list)
    by_weekday: dict[str, list[_Row]] = defaultdict(list)
    by_campaign: dict[str, list[_Row]] = defaultdict(list)
    by_tag: dict[str, list[_Row]] = defaultdict(list)

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
        row: _Row = (rate, snapshot.views, snapshot.reach, snapshot.likes)
        by_platform[account.platform].append(row)
        if post.content_type:
            by_content_type[post.content_type].append(row)
        hour, _, weekday_name = local_publish_slot(post.published_at, account.timezone)
        by_hour[f"{hour:02d}:00"].append(row)
        by_weekday[weekday_name].append(row)
        if post.campaign:
            by_campaign[post.campaign].append(row)
        for tag in post.tags:
            by_tag[tag].append(row)

    def avg(values: list[int | None]) -> float | None:
        present = [v for v in values if v is not None]
        return sum(present) / len(present) if present else None

    def summarize(
        groups: dict[str, list[_Row]], order: list[str] | None = None
    ) -> list[BenchmarkGroup]:
        # Hour and weekday have a natural order that isn't alphabetical
        # ("Fri" before "Mon" would make the chart unreadable), so callers
        # pass the sequence those keys belong in.
        keys = [k for k in order if k in groups] if order is not None else sorted(groups)
        result = []
        for key in keys:
            rows = groups[key]
            rates = [r for r, _, _, _ in rows if r is not None]
            if not rates:
                continue
            result.append(
                BenchmarkGroup(
                    key=key,
                    avg_engagement_rate=sum(rates) / len(rates),
                    avg_views=avg([v for _, v, _, _ in rows]),
                    avg_reach=avg([re for _, _, re, _ in rows]),
                    avg_likes=avg([lk for _, _, _, lk in rows]),
                    sample_size=len(rows),
                )
            )
        return result

    return BenchmarksResponse(
        by_platform=summarize(by_platform),
        by_content_type=summarize(by_content_type),
        by_hour=summarize(by_hour, order=[f"{h:02d}:00" for h in range(24)]),
        by_weekday=summarize(by_weekday, order=list(WEEKDAY_NAMES)),
        by_campaign=summarize(by_campaign),
        by_tag=summarize(by_tag),
    )


@router.get("/monthly", response_model=list[MonthlyPointResponse])
async def monthly(session: DbSession, account_id: uuid.UUID) -> list[MonthlyPointResponse]:
    """Month-by-month rollup of every post published under one account —
    totals for size (views/likes/comments/shares/saves) plus an average
    engagement rate, so a CM can compare "how did this account do this
    month vs last month" instead of only ever looking at one post."""
    account = await session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")

    posts = (
        (await session.execute(select(Post).where(Post.account_id == account_id))).scalars().all()
    )
    latest_snapshots = await _latest_post_snapshots(session)
    followers = (await _latest_account_followers(session)).get(account_id)

    metrics = []
    for post in posts:
        snapshot = latest_snapshots.get(post.id)
        rate = (
            compute_engagement_rate(
                snapshot.likes,
                snapshot.comments,
                snapshot.shares,
                snapshot.saves,
                snapshot.reach,
                snapshot.impressions,
                followers,
            )
            if snapshot is not None
            else None
        )
        metrics.append(
            PostMetricsLike(
                published_at=post.published_at,
                views=snapshot.views if snapshot else None,
                likes=snapshot.likes if snapshot else None,
                comments=snapshot.comments if snapshot else None,
                shares=snapshot.shares if snapshot else None,
                saves=snapshot.saves if snapshot else None,
                engagement_rate=rate,
            )
        )

    return [
        MonthlyPointResponse(
            month_start=point.month_start,
            post_count=point.post_count,
            total_views=point.total_views,
            total_likes=point.total_likes,
            total_comments=point.total_comments,
            total_shares=point.total_shares,
            total_saves=point.total_saves,
            avg_engagement_rate=point.avg_engagement_rate,
        )
        for point in bucket_posts_by_month(metrics)
    ]


@router.get("/posts-timeline", response_model=list[PostTimelinePoint])
async def posts_timeline(
    session: DbSession, account_id: uuid.UUID | None = None
) -> list[PostTimelinePoint]:
    """Every post (of one account, or all of them), oldest to newest, with its
    latest captured metrics and the attributes worth slicing by. It backs both
    the trend line and the side-by-side post comparison table, so it carries
    account/format/publish-slot context rather than metrics alone."""
    if account_id is not None and await session.get(Account, account_id) is None:
        raise HTTPException(status_code=404, detail="account not found")

    posts = (
        (await session.execute(_posts_query(account_id).order_by(Post.published_at)))
        .scalars()
        .all()
    )
    accounts = {a.id: a for a in (await session.execute(select(Account))).scalars().all()}
    latest_snapshots = await _latest_post_snapshots(session)
    followers_by_account = await _latest_account_followers(session)

    points = []
    for post in posts:
        account = accounts.get(post.account_id)
        if account is None:
            continue
        snapshot = latest_snapshots.get(post.id)
        rate = (
            compute_engagement_rate(
                snapshot.likes,
                snapshot.comments,
                snapshot.shares,
                snapshot.saves,
                snapshot.reach,
                snapshot.impressions,
                followers_by_account.get(post.account_id),
            )
            if snapshot is not None
            else None
        )
        hour, _, weekday_name = local_publish_slot(post.published_at, account.timezone)
        points.append(
            PostTimelinePoint(
                post_id=post.id,
                label=post.description or post.hook or post.url or str(post.id),
                account_id=account.id,
                account_label=account.display_name or account.handle,
                platform=account.platform,
                content_type=post.content_type,
                campaign=post.campaign,
                published_at=post.published_at,
                published_hour=hour,
                published_weekday=weekday_name,
                views=snapshot.views if snapshot else None,
                likes=snapshot.likes if snapshot else None,
                comments=snapshot.comments if snapshot else None,
                shares=snapshot.shares if snapshot else None,
                saves=snapshot.saves if snapshot else None,
                reach=snapshot.reach if snapshot else None,
                engagement_rate=rate,
            )
        )
    return points


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
