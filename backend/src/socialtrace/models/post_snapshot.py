import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from socialtrace.db.base import Base


class PostSnapshot(Base):
    __tablename__ = "post_snapshots"
    __table_args__ = (
        # NULL window_key means an ad-hoc capture, not tied to h24/d7/d30.
        # Postgres treats each NULL as distinct under UNIQUE, so this
        # constraint enforces "one snapshot per named window per post"
        # while still allowing unlimited ad-hoc snapshots — which is the
        # "adhoc se maneja aparte" (handled separately) behavior the spec
        # calls for, achieved without a special-cased column.
        UniqueConstraint("post_id", "window_key"),
        Index("ix_post_snapshots_post_id_captured_at", "post_id", "captured_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
    )
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # 'h24' | 'd7' | 'd30' | None (ad-hoc) — validated at the app layer.
    window_key: Mapped[str | None] = mapped_column(String, nullable=True)
    views: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reach: Mapped[int | None] = mapped_column(Integer, nullable=True)
    impressions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    likes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shares: Mapped[int | None] = mapped_column(Integer, nullable=True)
    saves: Mapped[int | None] = mapped_column(Integer, nullable=True)
    clicks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    watch_time_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, server_default="{}")
    source: Mapped[str] = mapped_column(String, nullable=False, server_default="manual")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
