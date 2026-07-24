"""The capture-window engine — socialtrace's core differentiator.

Deliberately pure functions with no DB access: "due" / "overdue" is always
computed from raw facts (publish time, existing snapshots, now), never
persisted as a status column. See docs/adr/0003. Callers (the /tasks router)
fetch the raw facts via a query and pass them in here.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum


class TaskStatus(StrEnum):
    due = "due"
    overdue = "overdue"


@dataclass(frozen=True)
class Window:
    key: str
    offset: timedelta
    grace: timedelta


POST_WINDOWS: tuple[Window, ...] = (
    Window(key="h24", offset=timedelta(hours=24), grace=timedelta(hours=12)),
    Window(key="d7", offset=timedelta(days=7), grace=timedelta(days=2)),
    Window(key="d30", offset=timedelta(days=30), grace=timedelta(days=5)),
)

# Configurable per account (accounts.capture_cadence). No grace period is
# defined for account cadence in the spec — unlike post windows, an account
# is always just "due" once past cadence, never "overdue".
CADENCE_INTERVALS: dict[str, timedelta] = {
    "weekly": timedelta(days=7),
    "biweekly": timedelta(days=14),
    "monthly": timedelta(days=30),
}


@dataclass(frozen=True)
class PostTask:
    post_id: uuid.UUID
    window_key: str
    status: TaskStatus
    due_since: datetime


def compute_post_tasks(
    post_id: uuid.UUID,
    published_at: datetime,
    captured_window_keys: set[str],
    now: datetime,
) -> list[PostTask]:
    """One task per named window that's due/overdue and not yet captured.

    Windows not yet reached (`now < due_at`) are "upcoming" and intentionally
    excluded — the spec is explicit that upcoming windows aren't tasks.
    """
    tasks = []
    for window in POST_WINDOWS:
        if window.key in captured_window_keys:
            continue
        due_at = published_at + window.offset
        if now < due_at:
            continue
        overdue_at = due_at + window.grace
        status = TaskStatus.overdue if now >= overdue_at else TaskStatus.due
        tasks.append(
            PostTask(post_id=post_id, window_key=window.key, status=status, due_since=due_at)
        )
    return tasks


@dataclass(frozen=True)
class AccountTask:
    account_id: uuid.UUID
    status: TaskStatus
    due_since: datetime


def compute_account_task(
    account_id: uuid.UUID,
    cadence: str,
    reference_at: datetime,
    now: datetime,
) -> AccountTask | None:
    """`reference_at` is the account's last snapshot's `captured_at`, or its
    `created_at` if it has never been captured."""
    due_at = reference_at + CADENCE_INTERVALS[cadence]
    if now < due_at:
        return None
    return AccountTask(account_id=account_id, status=TaskStatus.due, due_since=due_at)
