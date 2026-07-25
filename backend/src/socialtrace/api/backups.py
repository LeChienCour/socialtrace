from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from socialtrace.api.auth import require_api_token
from socialtrace.schemas.backup import BackupInfo
from socialtrace.settings import settings

router = APIRouter(prefix="/backups", tags=["backups"], dependencies=[Depends(require_api_token)])


def _daily_dir() -> Path:
    return Path(settings.backup_dir) / "daily"


def _sorted_dumps() -> list[Path]:
    daily_dir = _daily_dir()
    if not daily_dir.is_dir():
        return []
    return sorted(daily_dir.glob("*.sql.gz"), key=lambda p: p.stat().st_mtime, reverse=True)


@router.get("", response_model=list[BackupInfo])
async def list_backups() -> list[BackupInfo]:
    return [
        BackupInfo(
            filename=f.name,
            size_bytes=f.stat().st_size,
            modified_at=datetime.fromtimestamp(f.stat().st_mtime, tz=UTC),
        )
        for f in _sorted_dumps()
    ]


@router.get("/latest")
async def download_latest_backup() -> FileResponse:
    """Streams the newest pre-generated pg_dump — never generates one
    on-demand. That's the whole point: no subprocess execution triggered
    by an HTTP request, no auth-less pg_dump endpoint. See docs/adr/0004."""
    dumps = _sorted_dumps()
    if not dumps:
        raise HTTPException(status_code=404, detail="no backups available yet")
    latest = dumps[0]
    return FileResponse(latest, media_type="application/gzip", filename=latest.name)
