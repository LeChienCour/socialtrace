from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class OverviewResponse(BaseModel):
    total_accounts: int
    total_posts: int
    captures_last_7d: int
    avg_engagement_rate: float | None


class BenchmarkGroup(BaseModel):
    key: str
    avg_engagement_rate: float
    avg_views: float | None
    avg_reach: float | None
    avg_likes: float | None
    sample_size: int


class BenchmarksResponse(BaseModel):
    """Every dimension a post can be sliced by, in one payload — the groups
    are small (24 hours, 7 weekdays, a handful of formats), so shipping them
    together beats a round-trip per dimension switch in the dashboard."""

    by_platform: list[BenchmarkGroup]
    by_content_type: list[BenchmarkGroup]
    # Hour/weekday come from each post's publish time in its *account's*
    # timezone — "posts at 9am do best" is meaningless in UTC for a CM
    # working in another zone.
    by_hour: list[BenchmarkGroup]
    by_weekday: list[BenchmarkGroup]
    by_campaign: list[BenchmarkGroup]
    by_tag: list[BenchmarkGroup]


class PostTimelinePoint(BaseModel):
    post_id: UUID
    label: str
    account_id: UUID
    account_label: str
    platform: str
    content_type: str | None
    campaign: str | None
    published_at: datetime
    published_hour: int
    published_weekday: str
    views: int | None
    likes: int | None
    comments: int | None
    shares: int | None
    saves: int | None
    reach: int | None
    engagement_rate: float | None


class MonthlyPointResponse(BaseModel):
    month_start: date
    post_count: int
    total_views: int
    total_likes: int
    total_comments: int
    total_shares: int
    total_saves: int
    avg_engagement_rate: float | None


class GrowthPointResponse(BaseModel):
    period_start: date
    followers: int | None
    reach: int | None
    impressions: int | None
    profile_visits: int | None


class PostCurvePoint(BaseModel):
    captured_at: datetime
    hours_since_published: float
    window_key: str | None
    views: int | None
    likes: int | None
    comments: int | None
    shares: int | None
    saves: int | None
    reach: int | None
    impressions: int | None
    engagement_rate: float | None


class PostCurve(BaseModel):
    post_id: UUID
    label: str
    points: list[PostCurvePoint]
