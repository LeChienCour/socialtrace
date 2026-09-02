from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Source = Literal["manual", "api", "import"]
WindowKey = Literal["h24", "d7", "d30"]


class PostSnapshotCreate(BaseModel):
    captured_at: datetime | None = None
    # None = ad-hoc capture, not tied to a named window (see
    # models.post_snapshot for why this is NULL rather than a literal
    # "adhoc" string).
    window_key: WindowKey | None = None
    views: int | None = None
    reach: int | None = None
    impressions: int | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    saves: int | None = None
    clicks: int | None = None
    watch_time_sec: int | None = None
    raw: dict[str, object] = Field(default_factory=dict)
    source: Source = "manual"


class PostSnapshotUpdate(BaseModel):
    captured_at: datetime | None = None
    window_key: WindowKey | None = None
    views: int | None = None
    reach: int | None = None
    impressions: int | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    saves: int | None = None
    clicks: int | None = None
    watch_time_sec: int | None = None
    raw: dict[str, object] | None = None
    source: Source | None = None


class PostSnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    post_id: UUID
    captured_at: datetime
    window_key: str | None
    views: int | None
    reach: int | None
    impressions: int | None
    likes: int | None
    comments: int | None
    shares: int | None
    saves: int | None
    clicks: int | None
    watch_time_sec: int | None
    raw: dict[str, object]
    source: str
    created_at: datetime
