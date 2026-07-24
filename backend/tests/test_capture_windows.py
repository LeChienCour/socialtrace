import uuid
from datetime import UTC, datetime, timedelta

from socialtrace.capture_windows import (
    TaskStatus,
    compute_account_task,
    compute_post_tasks,
)

POST_ID = uuid.uuid4()
ACCOUNT_ID = uuid.uuid4()


def test_upcoming_window_is_not_a_task() -> None:
    published_at = datetime(2026, 1, 1, tzinfo=UTC)
    now = published_at + timedelta(hours=1)  # well before h24
    tasks = compute_post_tasks(POST_ID, published_at, set(), now)
    assert tasks == []


def test_window_past_offset_is_due() -> None:
    published_at = datetime(2026, 1, 1, tzinfo=UTC)
    now = published_at + timedelta(hours=25)  # past h24 offset, within grace
    tasks = compute_post_tasks(POST_ID, published_at, set(), now)
    assert len(tasks) == 1
    assert tasks[0].window_key == "h24"
    assert tasks[0].status == TaskStatus.due


def test_window_past_grace_is_overdue() -> None:
    published_at = datetime(2026, 1, 1, tzinfo=UTC)
    now = published_at + timedelta(hours=24 + 12 + 1)  # past h24 offset + grace
    tasks = compute_post_tasks(POST_ID, published_at, set(), now)
    assert tasks[0].status == TaskStatus.overdue


def test_captured_window_is_not_a_task() -> None:
    published_at = datetime(2026, 1, 1, tzinfo=UTC)
    now = published_at + timedelta(hours=25)
    tasks = compute_post_tasks(POST_ID, published_at, {"h24"}, now)
    assert tasks == []


def test_multiple_windows_due_at_once() -> None:
    published_at = datetime(2026, 1, 1, tzinfo=UTC)
    now = published_at + timedelta(days=8)  # past both h24 and d7
    tasks = compute_post_tasks(POST_ID, published_at, set(), now)
    assert {t.window_key for t in tasks} == {"h24", "d7"}


def test_account_not_yet_due() -> None:
    reference_at = datetime(2026, 1, 1, tzinfo=UTC)
    now = reference_at + timedelta(days=1)
    assert compute_account_task(ACCOUNT_ID, "weekly", reference_at, now) is None


def test_account_due_after_cadence() -> None:
    reference_at = datetime(2026, 1, 1, tzinfo=UTC)
    now = reference_at + timedelta(days=8)
    task = compute_account_task(ACCOUNT_ID, "weekly", reference_at, now)
    assert task is not None
    assert task.status == TaskStatus.due
