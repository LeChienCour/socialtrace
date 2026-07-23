import logging
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from socialtrace.api.accounts import router as accounts_router
from socialtrace.api.health import router as health_router
from socialtrace.api.posts import router as posts_router
from socialtrace.settings import settings

logger = logging.getLogger("socialtrace")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    token = settings.api_token or secrets.token_urlsafe(32)
    app.state.api_token = token
    if not settings.api_token:
        logger.warning(
            "No SOCIALTRACE_API_TOKEN configured — generated a temporary token "
            "for this run (it will change on restart). Set SOCIALTRACE_API_TOKEN "
            "in your .env to keep it stable. Token: %s",
            token,
        )
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="socialtrace", lifespan=lifespan)
    app.include_router(health_router)
    app.include_router(accounts_router)
    app.include_router(posts_router)
    return app


app = create_app()
