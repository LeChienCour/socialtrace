from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

from tests.conftest import AUTH_HEADERS, make_test_app


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient]:
    app = make_test_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS) as ac:
        yield ac


async def test_create_and_list_account(client: AsyncClient) -> None:
    response = await client.post("/accounts", json={"platform": "instagram", "handle": "acme"})
    assert response.status_code == 201
    body = response.json()
    assert body["platform"] == "instagram"
    assert body["handle"] == "acme"
    assert body["timezone"] == "UTC"
    assert body["is_active"] is True

    response = await client.get("/accounts")
    assert response.status_code == 200
    assert len(response.json()) == 1


async def test_duplicate_platform_handle_rejected(client: AsyncClient) -> None:
    payload = {"platform": "tiktok", "handle": "dup"}
    first = await client.post("/accounts", json=payload)
    assert first.status_code == 201

    second = await client.post("/accounts", json=payload)
    assert second.status_code == 409


async def test_update_account(client: AsyncClient) -> None:
    created = await client.post("/accounts", json={"platform": "x", "handle": "someone"})
    account_id = created.json()["id"]

    updated = await client.patch(
        f"/accounts/{account_id}", json={"display_name": "Someone Official"}
    )
    assert updated.status_code == 200
    assert updated.json()["display_name"] == "Someone Official"


async def test_update_missing_account_404(client: AsyncClient) -> None:
    response = await client.patch(
        "/accounts/00000000-0000-0000-0000-000000000000",
        json={"display_name": "nope"},
    )
    assert response.status_code == 404
