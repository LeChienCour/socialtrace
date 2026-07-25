import csv
import io
import json
import zipfile
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from socialtrace.api.auth import require_api_token
from socialtrace.csv_transfer import (
    ACCOUNT_SNAPSHOTS_COLUMNS,
    ACCOUNTS_COLUMNS,
    POST_SNAPSHOTS_COLUMNS,
    POSTS_COLUMNS,
    account_snapshot_to_row,
    account_to_row,
    post_snapshot_to_row,
    post_to_row,
    row_to_account_fields,
    row_to_account_snapshot_fields,
    row_to_post_fields,
    row_to_post_snapshot_fields,
)
from socialtrace.db.base import Base
from socialtrace.db.session import get_db_session
from socialtrace.models import Account, AccountSnapshot, Post, PostSnapshot
from socialtrace.schemas.account import AccountRead
from socialtrace.schemas.account_snapshot import AccountSnapshotRead
from socialtrace.schemas.post import PostRead
from socialtrace.schemas.post_snapshot import PostSnapshotRead

router = APIRouter(tags=["export"], dependencies=[Depends(require_api_token)])

DbSession = Annotated[AsyncSession, Depends(get_db_session)]

TABLES = ("accounts", "posts", "account_snapshots", "post_snapshots")


def _write_csv(columns: list[str], rows: list[dict[str, str]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns)
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


@router.get("/export")
async def export_data(session: DbSession, format: Literal["json", "csv"] = "json") -> Response:
    accounts = (await session.execute(select(Account))).scalars().all()
    posts = (await session.execute(select(Post))).scalars().all()
    account_snapshots = (await session.execute(select(AccountSnapshot))).scalars().all()
    post_snapshots = (await session.execute(select(PostSnapshot))).scalars().all()

    if format == "json":
        payload = {
            "accounts": [AccountRead.model_validate(a).model_dump(mode="json") for a in accounts],
            "posts": [PostRead.model_validate(p).model_dump(mode="json") for p in posts],
            "account_snapshots": [
                AccountSnapshotRead.model_validate(s).model_dump(mode="json")
                for s in account_snapshots
            ],
            "post_snapshots": [
                PostSnapshotRead.model_validate(s).model_dump(mode="json") for s in post_snapshots
            ],
        }
        body = json.dumps(payload, indent=2).encode("utf-8")
        return Response(
            content=body,
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="socialtrace-export.json"'},
        )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "accounts.csv", _write_csv(ACCOUNTS_COLUMNS, [account_to_row(a) for a in accounts])
        )
        archive.writestr("posts.csv", _write_csv(POSTS_COLUMNS, [post_to_row(p) for p in posts]))
        archive.writestr(
            "account_snapshots.csv",
            _write_csv(
                ACCOUNT_SNAPSHOTS_COLUMNS,
                [account_snapshot_to_row(s) for s in account_snapshots],
            ),
        )
        archive.writestr(
            "post_snapshots.csv",
            _write_csv(POST_SNAPSHOTS_COLUMNS, [post_snapshot_to_row(s) for s in post_snapshots]),
        )
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="socialtrace-export.zip"'},
    )


def _read_csv_from_zip(archive: zipfile.ZipFile, name: str) -> list[dict[str, str]]:
    if name not in archive.namelist():
        return []
    with archive.open(name) as fh:
        text = io.TextIOWrapper(fh, encoding="utf-8")
        return list(csv.DictReader(text))


async def _upsert[ModelT: Base](
    session: DbSession, model: type[ModelT], id_value: Any, fields: dict[str, Any]
) -> None:
    existing = await session.get(model, id_value)
    if existing is None:
        session.add(model(**fields))
    else:
        for key, value in fields.items():
            if key != "id":
                setattr(existing, key, value)


@router.post("/import/csv")
async def import_csv(session: DbSession, file: UploadFile) -> dict[str, int]:
    """Round-trips exactly what /export?format=csv produces. Not a parser
    for platform-native CSV layouts — see csv_transfer.py."""
    raw = await file.read()
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="not a valid socialtrace export zip") from exc

    counts = dict.fromkeys(TABLES, 0)

    for row in _read_csv_from_zip(archive, "accounts.csv"):
        fields = row_to_account_fields(row)
        await _upsert(session, Account, fields["id"], fields)
        counts["accounts"] += 1
    await session.flush()

    for row in _read_csv_from_zip(archive, "posts.csv"):
        fields = row_to_post_fields(row)
        await _upsert(session, Post, fields["id"], fields)
        counts["posts"] += 1
    await session.flush()

    for row in _read_csv_from_zip(archive, "account_snapshots.csv"):
        fields = row_to_account_snapshot_fields(row)
        await _upsert(session, AccountSnapshot, fields["id"], fields)
        counts["account_snapshots"] += 1

    for row in _read_csv_from_zip(archive, "post_snapshots.csv"):
        fields = row_to_post_snapshot_fields(row)
        await _upsert(session, PostSnapshot, fields["id"], fields)
        counts["post_snapshots"] += 1

    await session.commit()
    return counts
