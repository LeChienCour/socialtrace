from typing import Annotated

from fastapi import Header, HTTPException, Request


async def require_api_token(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    expected = getattr(request.app.state, "api_token", None)
    if not expected or authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="missing or invalid API token")
