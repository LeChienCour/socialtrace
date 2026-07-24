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
    sample_size: int


class BenchmarksResponse(BaseModel):
    by_platform: list[BenchmarkGroup]
    by_content_type: list[BenchmarkGroup]


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
