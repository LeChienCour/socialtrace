from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Source = Literal["manual", "api", "import"]


class AccountSnapshotCreate(BaseModel):
    captured_at: datetime | None = None
    period_start: date | None = None
    period_end: date | None = None
    followers: int | None = None
    following: int | None = None
    posts_count: int | None = None
    reach: int | None = None
    impressions: int | None = None
    profile_visits: int | None = None
    link_clicks: int | None = None
    raw: dict[str, object] = Field(default_factory=dict)
    source: Source = "manual"
    note: str | None = None


class AccountSnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    captured_at: datetime
    period_start: date | None
    period_end: date | None
    followers: int | None
    following: int | None
    posts_count: int | None
    reach: int | None
    impressions: int | None
    profile_visits: int | None
    link_clicks: int | None
    raw: dict[str, object]
    source: str
    note: str | None
    created_at: datetime
