"""Pure computation helpers for the analytics endpoints.

Engagement rate math lives in exactly one place, with the denominator
preference documented per spec: reach, then impressions, then account
followers — because every platform under- or over-reports differently, and
mixing formulas silently would make cross-platform benchmarks meaningless.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal, Protocol

GrowthGranularity = Literal["day", "week", "month"]


def compute_engagement_rate(
    likes: int | None,
    comments: int | None,
    shares: int | None,
    saves: int | None,
    reach: int | None,
    impressions: int | None,
    followers: int | None,
) -> float | None:
    engagement_fields = (likes, comments, shares, saves)
    if not any(v is not None for v in engagement_fields):
        return None
    numerator = sum(v for v in engagement_fields if v is not None)

    denominator: int | None
    if reach is not None:
        denominator = reach
    elif impressions is not None:
        denominator = impressions
    else:
        denominator = followers
    if not denominator:
        return None

    return numerator / denominator


@dataclass(frozen=True)
class PostMetricsLike:
    """The subset of a post's latest snapshot needed to fold it into a
    monthly aggregate — decoupled from the ORM model so this stays a pure
    function callers can unit-test without a DB."""

    published_at: datetime
    views: int | None
    likes: int | None
    comments: int | None
    shares: int | None
    saves: int | None
    engagement_rate: float | None


@dataclass(frozen=True)
class MonthlyPoint:
    month_start: date
    post_count: int
    total_views: int
    total_likes: int
    total_comments: int
    total_shares: int
    total_saves: int
    avg_engagement_rate: float | None


def bucket_posts_by_month(posts: list[PostMetricsLike]) -> list[MonthlyPoint]:
    """One point per calendar month a post was published in, summing raw
    interaction counts (a real total, unlike account snapshots which can
    only take the latest reading) and averaging engagement rate across the
    posts published that month."""
    by_month: dict[date, list[PostMetricsLike]] = {}
    for post in posts:
        key = post.published_at.date().replace(day=1)
        by_month.setdefault(key, []).append(post)

    def total(values: list[int | None]) -> int:
        return sum(v for v in values if v is not None)

    points = []
    for month_start, group in sorted(by_month.items()):
        rates = [p.engagement_rate for p in group if p.engagement_rate is not None]
        points.append(
            MonthlyPoint(
                month_start=month_start,
                post_count=len(group),
                total_views=total([p.views for p in group]),
                total_likes=total([p.likes for p in group]),
                total_comments=total([p.comments for p in group]),
                total_shares=total([p.shares for p in group]),
                total_saves=total([p.saves for p in group]),
                avg_engagement_rate=sum(rates) / len(rates) if rates else None,
            )
        )
    return points


class AccountSnapshotLike(Protocol):
    captured_at: datetime
    followers: int | None
    reach: int | None
    impressions: int | None
    profile_visits: int | None


@dataclass(frozen=True)
class GrowthPoint:
    period_start: date
    followers: int | None
    reach: int | None
    impressions: int | None
    profile_visits: int | None


def _bucket_start(captured_at: datetime, granularity: GrowthGranularity) -> date:
    day = captured_at.date()
    if granularity == "day":
        return day
    if granularity == "week":
        return day - timedelta(days=day.weekday())
    return day.replace(day=1)


def bucket_account_snapshots(
    snapshots: list[AccountSnapshotLike], granularity: GrowthGranularity
) -> list[GrowthPoint]:
    """One point per bucket: the latest snapshot captured within it. Sparse,
    manually-captured data doesn't support real aggregation (averaging two
    follower counts from different days is meaningless) — "latest wins" is
    the only bucketing that makes sense here.
    """
    latest_by_bucket: dict[date, AccountSnapshotLike] = {}
    for snapshot in snapshots:
        key = _bucket_start(snapshot.captured_at, granularity)
        current = latest_by_bucket.get(key)
        if current is None or snapshot.captured_at > current.captured_at:
            latest_by_bucket[key] = snapshot

    return [
        GrowthPoint(
            period_start=key,
            followers=snapshot.followers,
            reach=snapshot.reach,
            impressions=snapshot.impressions,
            profile_visits=snapshot.profile_visits,
        )
        for key, snapshot in sorted(latest_by_bucket.items())
    ]
