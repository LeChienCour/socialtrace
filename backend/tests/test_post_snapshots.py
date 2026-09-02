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
async def post_id(client: AsyncClient) -> str:
    account = await client.post("/accounts", json={"platform": "instagram", "handle": "acme"})
    account_id = account.json()["id"]
    post = await client.post(
        "/posts",
        json={
            "account_id": account_id,
            "url": "https://instagram.com/p/abc",
            "published_at": "2026-01-01T00:00:00Z",
        },
    )
    id_: str = post.json()["id"]
    return id_


async def test_create_and_list_post_snapshot(client: AsyncClient, post_id: str) -> None:
    response = await client.post(
        f"/posts/{post_id}/snapshots",
        json={"window_key": "h24", "views": 100, "likes": 10},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["window_key"] == "h24"
    assert body["views"] == 100

    listed = await client.get(f"/posts/{post_id}/snapshots")
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_duplicate_window_rejected(client: AsyncClient, post_id: str) -> None:
    payload = {"window_key": "h24", "views": 100}
    first = await client.post(f"/posts/{post_id}/snapshots", json=payload)
    assert first.status_code == 201

    second = await client.post(f"/posts/{post_id}/snapshots", json=payload)
    assert second.status_code == 409


async def test_multiple_adhoc_snapshots_allowed(client: AsyncClient, post_id: str) -> None:
    """window_key=None (ad-hoc) isn't subject to the one-per-window UNIQUE
    constraint — Postgres treats each NULL as distinct."""
    first = await client.post(f"/posts/{post_id}/snapshots", json={"views": 10})
    second = await client.post(f"/posts/{post_id}/snapshots", json={"views": 20})
    assert first.status_code == 201
    assert second.status_code == 201


async def test_update_post_snapshot_fixes_mistyped_value(client: AsyncClient, post_id: str) -> None:
    created = await client.post(
        f"/posts/{post_id}/snapshots", json={"window_key": "h24", "views": 100}
    )
    snapshot_id = created.json()["id"]

    response = await client.patch(f"/posts/{post_id}/snapshots/{snapshot_id}", json={"views": 1000})
    assert response.status_code == 200
    assert response.json()["views"] == 1000

    listed = await client.get(f"/posts/{post_id}/snapshots")
    assert listed.json()[0]["views"] == 1000


async def test_update_post_snapshot_missing_returns_404(client: AsyncClient, post_id: str) -> None:
    response = await client.patch(
        f"/posts/{post_id}/snapshots/00000000-0000-0000-0000-000000000000",
        json={"views": 1},
    )
    assert response.status_code == 404


async def test_delete_post_snapshot(client: AsyncClient, post_id: str) -> None:
    created = await client.post(
        f"/posts/{post_id}/snapshots", json={"window_key": "h24", "views": 100}
    )
    snapshot_id = created.json()["id"]

    response = await client.delete(f"/posts/{post_id}/snapshots/{snapshot_id}")
    assert response.status_code == 204

    listed = await client.get(f"/posts/{post_id}/snapshots")
    assert listed.json() == []
