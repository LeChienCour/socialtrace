from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

ContentType = Literal["reel", "story", "carousel", "video", "image", "text", "short"]


class PostCreate(BaseModel):
    account_id: UUID
    url: str | None = None
    description: str | None = None
    content_type: ContentType | None = None
    campaign: str | None = None
    tags: list[str] = Field(default_factory=list)
    published_at: datetime

    @model_validator(mode="after")
    def _require_url_or_description(self) -> "PostCreate":
        if not self.url and not self.description:
            raise ValueError("post requires a url or a description")
        return self


class PostUpdate(BaseModel):
    """Partial update — url/description presence is enforced against the
    merged row in the router, not here, since a partial payload alone can't
    tell whether the *other* field is already set."""

    url: str | None = None
    description: str | None = None
    content_type: ContentType | None = None
    campaign: str | None = None
    tags: list[str] | None = None
    published_at: datetime | None = None


class PostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    url: str | None
    description: str | None
    content_type: str | None
    campaign: str | None
    tags: list[str]
    published_at: datetime
    created_at: datetime
