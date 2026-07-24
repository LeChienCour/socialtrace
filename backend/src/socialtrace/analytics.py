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
