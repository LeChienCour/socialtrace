from datetime import datetime

from pydantic import BaseModel


class BackupInfo(BaseModel):
    filename: str
    size_bytes: int
    modified_at: datetime
