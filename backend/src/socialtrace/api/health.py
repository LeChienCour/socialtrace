from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from socialtrace.db.session import get_db_session

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness: no DB call, must always return fast."""
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(session: Annotated[AsyncSession, Depends(get_db_session)]) -> dict[str, str]:
    """Readiness: proves the app can reach the database."""
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="database unreachable") from exc
    return {"status": "ok"}
