from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class TaskItem(BaseModel):
    type: Literal["account", "post"]
    target_id: UUID
    label: str
    # Named window key ('h24'/'d7'/'d30') for posts; cadence key
    # ('weekly'/'biweekly'/'monthly') for accounts.
    window_key: str
    status: Literal["due", "overdue"]
    due_since: datetime
    # Account context so a post task is identifiable without opening its
    # link — which account it belongs to and, for posts, the link itself.
    account_label: str
    url: str | None = None
