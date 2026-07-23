from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

from tests.conftest import make_test_app


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient]:
    app = make_test_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_accounts_requires_token(client: AsyncClient) -> None:
    response = await client.get("/accounts")
    assert response.status_code == 401


async def test_accounts_rejects_wrong_token(client: AsyncClient) -> None:
    response = await client.get("/accounts", headers={"Authorization": "Bearer wrong-token"})
    assert response.status_code == 401


async def test_healthz_does_not_require_token(client: AsyncClient) -> None:
    response = await client.get("/healthz")
    assert response.status_code == 200
