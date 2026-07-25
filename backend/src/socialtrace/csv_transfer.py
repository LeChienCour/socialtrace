"""Column definitions and row (de)serialization shared by the export and
import endpoints, so the two stay in lockstep by construction.

Scope note: this is a round-trip format (import reads exactly what export
produces), not an attempt at parsing undocumented, versioned platform-native
CSV layouts (Instagram/TikTok/YouTube Studio). Those formats aren't
specified anywhere and change without notice; mapping them "close enough"
would risk silently wrong data. This format is for migration/restore and is
the extensibility point a future platform-specific importer would build on.
"""

import json
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from socialtrace.models import Account, AccountSnapshot, Post, PostSnapshot

ACCOUNTS_COLUMNS = [
    "id",
    "platform",
    "handle",
    "display_name",
    "timezone",
    "is_active",
    "capture_cadence",
    "created_by",
    "created_at",
]
POSTS_COLUMNS = [
    "id",
    "account_id",
    "url",
    "description",
    "content_type",
    "campaign",
    "tags",
    "published_at",
    "created_by",
    "created_at",
]
ACCOUNT_SNAPSHOTS_COLUMNS = [
    "id",
    "account_id",
    "captured_at",
    "period_start",
    "period_end",
    "followers",
    "following",
    "posts_count",
    "reach",
    "impressions",
    "profile_visits",
    "link_clicks",
    "raw",
    "source",
    "note",
    "created_at",
]
POST_SNAPSHOTS_COLUMNS = [
    "id",
    "post_id",
    "captured_at",
    "window_key",
    "views",
    "reach",
    "impressions",
    "likes",
    "comments",
    "shares",
    "saves",
    "clicks",
    "watch_time_sec",
    "raw",
    "source",
    "created_at",
]


def _s(value: Any) -> str:
    """None -> empty string; everything else -> its CSV text form."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, dict | list):
        return json.dumps(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    return str(value)


def _dt_or_now(value: str) -> datetime:
    return datetime.fromisoformat(value) if value else datetime.now(UTC)


def account_to_row(account: Account) -> dict[str, str]:
    return {
        "id": _s(account.id),
        "platform": _s(account.platform),
        "handle": _s(account.handle),
        "display_name": _s(account.display_name),
        "timezone": _s(account.timezone),
        "is_active": _s(account.is_active),
        "capture_cadence": _s(account.capture_cadence),
        "created_by": _s(account.created_by),
        "created_at": _s(account.created_at),
    }


def row_to_account_fields(row: dict[str, str]) -> dict[str, Any]:
    return {
        "id": UUID(row["id"]),
        "platform": row["platform"],
        "handle": row["handle"],
        "display_name": row["display_name"] or None,
        "timezone": row["timezone"] or "UTC",
        "is_active": row["is_active"].strip().lower() == "true",
        "capture_cadence": row["capture_cadence"] or "weekly",
        "created_by": row["created_by"] or None,
        "created_at": _dt_or_now(row["created_at"]),
    }


def post_to_row(post: Post) -> dict[str, str]:
    return {
        "id": _s(post.id),
        "account_id": _s(post.account_id),
        "url": _s(post.url),
        "description": _s(post.description),
        "content_type": _s(post.content_type),
        "campaign": _s(post.campaign),
        "tags": _s(post.tags),
        "published_at": _s(post.published_at),
        "created_by": _s(post.created_by),
        "created_at": _s(post.created_at),
    }


def row_to_post_fields(row: dict[str, str]) -> dict[str, Any]:
    return {
        "id": UUID(row["id"]),
        "account_id": UUID(row["account_id"]),
        "url": row["url"] or None,
        "description": row["description"] or None,
        "content_type": row["content_type"] or None,
        "campaign": row["campaign"] or None,
        "tags": json.loads(row["tags"]) if row["tags"] else [],
        "published_at": datetime.fromisoformat(row["published_at"]),
        "created_by": row["created_by"] or None,
        "created_at": _dt_or_now(row["created_at"]),
    }


def account_snapshot_to_row(snapshot: AccountSnapshot) -> dict[str, str]:
    return {
        "id": _s(snapshot.id),
        "account_id": _s(snapshot.account_id),
        "captured_at": _s(snapshot.captured_at),
        "period_start": _s(snapshot.period_start),
        "period_end": _s(snapshot.period_end),
        "followers": _s(snapshot.followers),
        "following": _s(snapshot.following),
        "posts_count": _s(snapshot.posts_count),
        "reach": _s(snapshot.reach),
        "impressions": _s(snapshot.impressions),
        "profile_visits": _s(snapshot.profile_visits),
        "link_clicks": _s(snapshot.link_clicks),
        "raw": _s(snapshot.raw),
        "source": _s(snapshot.source),
        "note": _s(snapshot.note),
        "created_at": _s(snapshot.created_at),
    }


def _int_or_none(value: str) -> int | None:
    return int(value) if value else None


def row_to_account_snapshot_fields(row: dict[str, str]) -> dict[str, Any]:
    return {
        "id": UUID(row["id"]),
        "account_id": UUID(row["account_id"]),
        "captured_at": datetime.fromisoformat(row["captured_at"]),
        "period_start": date.fromisoformat(row["period_start"]) if row["period_start"] else None,
        "period_end": date.fromisoformat(row["period_end"]) if row["period_end"] else None,
        "followers": _int_or_none(row["followers"]),
        "following": _int_or_none(row["following"]),
        "posts_count": _int_or_none(row["posts_count"]),
        "reach": _int_or_none(row["reach"]),
        "impressions": _int_or_none(row["impressions"]),
        "profile_visits": _int_or_none(row["profile_visits"]),
        "link_clicks": _int_or_none(row["link_clicks"]),
        "raw": json.loads(row["raw"]) if row["raw"] else {},
        "source": row["source"] or "manual",
        "note": row["note"] or None,
        "created_at": _dt_or_now(row["created_at"]),
    }


def post_snapshot_to_row(snapshot: PostSnapshot) -> dict[str, str]:
    return {
        "id": _s(snapshot.id),
        "post_id": _s(snapshot.post_id),
        "captured_at": _s(snapshot.captured_at),
        "window_key": _s(snapshot.window_key),
        "views": _s(snapshot.views),
        "reach": _s(snapshot.reach),
        "impressions": _s(snapshot.impressions),
        "likes": _s(snapshot.likes),
        "comments": _s(snapshot.comments),
        "shares": _s(snapshot.shares),
        "saves": _s(snapshot.saves),
        "clicks": _s(snapshot.clicks),
        "watch_time_sec": _s(snapshot.watch_time_sec),
        "raw": _s(snapshot.raw),
        "source": _s(snapshot.source),
        "created_at": _s(snapshot.created_at),
    }


def row_to_post_snapshot_fields(row: dict[str, str]) -> dict[str, Any]:
    return {
        "id": UUID(row["id"]),
        "post_id": UUID(row["post_id"]),
        "captured_at": datetime.fromisoformat(row["captured_at"]),
        "window_key": row["window_key"] or None,
        "views": _int_or_none(row["views"]),
        "reach": _int_or_none(row["reach"]),
        "impressions": _int_or_none(row["impressions"]),
        "likes": _int_or_none(row["likes"]),
        "comments": _int_or_none(row["comments"]),
        "shares": _int_or_none(row["shares"]),
        "saves": _int_or_none(row["saves"]),
        "clicks": _int_or_none(row["clicks"]),
        "watch_time_sec": _int_or_none(row["watch_time_sec"]),
        "raw": json.loads(row["raw"]) if row["raw"] else {},
        "source": row["source"] or "manual",
        "created_at": _dt_or_now(row["created_at"]),
    }
