from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

Platform = Literal["facebook", "instagram", "tiktok", "x", "linkedin", "youtube", "website"]


class AccountCreate(BaseModel):
    platform: Platform
    handle: str
    display_name: str | None = None
    timezone: str = "UTC"
    is_active: bool = True


class AccountUpdate(BaseModel):
    """Platform and handle are the account's identity (see the accounts
    UNIQUE constraint) — changing either is a new account, not an edit."""

    display_name: str | None = None
    timezone: str | None = None
    is_active: bool | None = None


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    platform: str
    handle: str
    display_name: str | None
    timezone: str
    is_active: bool
    created_at: datetime
