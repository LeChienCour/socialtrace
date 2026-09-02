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


@pytest.fixture
async def account_id(client: AsyncClient) -> str:
    response = await client.post("/accounts", json={"platform": "instagram", "handle": "acme"})
    id_: str = response.json()["id"]
    return id_


async def test_create_and_list_account_snapshot(client: AsyncClient, account_id: str) -> None:
    response = await client.post(
        f"/accounts/{account_id}/snapshots",
        json={"followers": 1000, "reach": 500},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["followers"] == 1000
    assert body["source"] == "manual"

    listed = await client.get(f"/accounts/{account_id}/snapshots")
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_snapshot_for_missing_account_404(client: AsyncClient) -> None:
    response = await client.post(
        "/accounts/00000000-0000-0000-0000-000000000000/snapshots",
        json={"followers": 100},
    )
    assert response.status_code == 404


async def test_update_account_snapshot_fixes_mistyped_value(
    client: AsyncClient, account_id: str
) -> None:
    created = await client.post(f"/accounts/{account_id}/snapshots", json={"followers": 1000})
    snapshot_id = created.json()["id"]

    response = await client.patch(
        f"/accounts/{account_id}/snapshots/{snapshot_id}", json={"followers": 1500}
    )
    assert response.status_code == 200
    assert response.json()["followers"] == 1500


async def test_delete_account_snapshot(client: AsyncClient, account_id: str) -> None:
    created = await client.post(f"/accounts/{account_id}/snapshots", json={"followers": 1000})
    snapshot_id = created.json()["id"]

    response = await client.delete(f"/accounts/{account_id}/snapshots/{snapshot_id}")
    assert response.status_code == 204

    listed = await client.get(f"/accounts/{account_id}/snapshots")
    assert listed.json() == []
