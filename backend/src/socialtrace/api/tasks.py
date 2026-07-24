import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from socialtrace.api.auth import require_api_token
from socialtrace.capture_windows import TaskStatus, compute_account_task, compute_post_tasks
from socialtrace.db.session import get_db_session
from socialtrace.models import Account, AccountSnapshot, Post, PostSnapshot
from socialtrace.schemas.task import TaskItem

router = APIRouter(prefix="/tasks", tags=["tasks"], dependencies=[Depends(require_api_token)])

DbSession = Annotated[AsyncSession, Depends(get_db_session)]

_STATUS_PRIORITY = {TaskStatus.overdue: 0, TaskStatus.due: 1}


@router.get("", response_model=list[TaskItem])
async def list_tasks(session: DbSession) -> list[TaskItem]:
    """The unified capture tray: due/overdue posts and accounts, most urgent
    first. This is a query over raw facts, not a read of stored state — see
    docs/adr/0003."""
    now = datetime.now(UTC)
    items: list[TaskItem] = []

    posts = (await session.execute(select(Post))).scalars().all()

    captured_rows = await session.execute(
        select(PostSnapshot.post_id, PostSnapshot.window_key).where(
            PostSnapshot.window_key.is_not(None)
        )
    )
    captured_by_post: dict[uuid.UUID, set[str]] = {}
    for post_id, window_key in captured_rows.all():
        captured_by_post.setdefault(post_id, set()).add(window_key)

    for post in posts:
        for post_task in compute_post_tasks(
            post_id=post.id,
            published_at=post.published_at,
            captured_window_keys=captured_by_post.get(post.id, set()),
            now=now,
        ):
            items.append(
                TaskItem(
                    type="post",
                    target_id=post_task.post_id,
                    label=post.description or post.url or str(post.id),
                    window_key=post_task.window_key,
                    status=post_task.status.value,
                    due_since=post_task.due_since,
                )
            )

    # Inactive accounts don't generate capture tasks — no point nagging the
    # CM about an account they've explicitly stopped tracking.
    accounts = (
        (await session.execute(select(Account).where(Account.is_active.is_(True)))).scalars().all()
    )

    latest_rows = await session.execute(
        select(AccountSnapshot.account_id, func.max(AccountSnapshot.captured_at)).group_by(
            AccountSnapshot.account_id
        )
    )
    latest_by_account: dict[uuid.UUID, datetime] = {row[0]: row[1] for row in latest_rows.all()}

    for account in accounts:
        reference_at = latest_by_account.get(account.id, account.created_at)
        account_task = compute_account_task(
            account_id=account.id,
            cadence=account.capture_cadence,
            reference_at=reference_at,
            now=now,
        )
        if account_task is not None:
            items.append(
                TaskItem(
                    type="account",
                    target_id=account_task.account_id,
                    label=account.display_name or account.handle,
                    window_key=account.capture_cadence,
                    status=account_task.status.value,
                    due_since=account_task.due_since,
                )
            )

    items.sort(key=lambda item: (_STATUS_PRIORITY[TaskStatus(item.status)], item.due_since))
    return items
