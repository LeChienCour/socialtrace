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


async def test_create_post_requires_url_or_description(
    client: AsyncClient, account_id: str
) -> None:
    response = await client.post(
        "/posts",
        json={"account_id": account_id, "published_at": "2026-01-01T00:00:00Z"},
    )
    assert response.status_code == 422


async def test_create_and_list_post(client: AsyncClient, account_id: str) -> None:
    response = await client.post(
        "/posts",
        json={
            "account_id": account_id,
            "url": "https://instagram.com/p/abc",
            "content_type": "reel",
            "published_at": "2026-01-01T00:00:00Z",
        },
    )
    assert response.status_code == 201
    post = response.json()
    assert post["url"] == "https://instagram.com/p/abc"
    assert post["tags"] == []

    listed = await client.get("/posts", params={"account_id": account_id})
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_update_post_clearing_only_field_rejected(
    client: AsyncClient, account_id: str
) -> None:
    created = await client.post(
        "/posts",
        json={
            "account_id": account_id,
            "url": "https://instagram.com/p/xyz",
            "published_at": "2026-01-01T00:00:00Z",
        },
    )
    post_id = created.json()["id"]

    response = await client.patch(f"/posts/{post_id}", json={"url": None})
    assert response.status_code == 400


async def test_delete_post(client: AsyncClient, account_id: str) -> None:
    created = await client.post(
        "/posts",
        json={
            "account_id": account_id,
            "description": "no url, just a caption",
            "published_at": "2026-01-01T00:00:00Z",
        },
    )
    post_id = created.json()["id"]

    deleted = await client.delete(f"/posts/{post_id}")
    assert deleted.status_code == 204

    missing = await client.delete(f"/posts/{post_id}")
    assert missing.status_code == 404
