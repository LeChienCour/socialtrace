from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from tests.conftest import AUTH_HEADERS, make_test_app


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient]:
    app = make_test_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS) as ac:
        yield ac


async def test_empty_tray(client: AsyncClient) -> None:
    response = await client.get("/tasks")
    assert response.status_code == 200
    assert response.json() == []


async def test_post_due_appears_in_tray(client: AsyncClient) -> None:
    account = await client.post("/accounts", json={"platform": "instagram", "handle": "acme"})
    account_id = account.json()["id"]

    published_at = datetime.now(UTC) - timedelta(hours=25)
    post = await client.post(
        "/posts",
        json={
            "account_id": account_id,
            "url": "https://instagram.com/p/abc",
            "published_at": published_at.isoformat(),
        },
    )
    post_id = post.json()["id"]

    response = await client.get("/tasks")
    tasks = response.json()
    post_tasks = [t for t in tasks if t["type"] == "post" and t["target_id"] == post_id]
    assert len(post_tasks) == 1
    assert post_tasks[0]["window_key"] == "h24"
    assert post_tasks[0]["status"] == "due"
    assert post_tasks[0]["url"] == "https://instagram.com/p/abc"
    assert "acme" in post_tasks[0]["account_label"]


async def test_captured_window_excluded_from_tray(client: AsyncClient) -> None:
    account = await client.post("/accounts", json={"platform": "instagram", "handle": "acme"})
    account_id = account.json()["id"]

    published_at = datetime.now(UTC) - timedelta(hours=25)
    post = await client.post(
        "/posts",
        json={
            "account_id": account_id,
            "url": "https://instagram.com/p/abc",
            "published_at": published_at.isoformat(),
        },
    )
    post_id = post.json()["id"]

    await client.post(f"/posts/{post_id}/snapshots", json={"window_key": "h24", "views": 10})

    response = await client.get("/tasks")
    tasks = response.json()
    post_tasks = [t for t in tasks if t["type"] == "post" and t["target_id"] == post_id]
    assert post_tasks == []


async def test_account_due_appears_in_tray(client: AsyncClient) -> None:
    account = await client.post("/accounts", json={"platform": "instagram", "handle": "acme"})
    account_id = account.json()["id"]

    stale_capture = datetime.now(UTC) - timedelta(days=8)
    await client.post(
        f"/accounts/{account_id}/snapshots",
        json={"followers": 100, "captured_at": stale_capture.isoformat()},
    )

    response = await client.get("/tasks")
    tasks = response.json()
    account_tasks = [t for t in tasks if t["type"] == "account" and t["target_id"] == account_id]
    assert len(account_tasks) == 1
    assert account_tasks[0]["status"] == "due"


async def test_inactive_account_excluded_from_tray(client: AsyncClient) -> None:
    account = await client.post("/accounts", json={"platform": "instagram", "handle": "acme"})
    account_id = account.json()["id"]
    await client.patch(f"/accounts/{account_id}", json={"is_active": False})

    response = await client.get("/tasks")
    tasks = response.json()
    account_tasks = [t for t in tasks if t["type"] == "account" and t["target_id"] == account_id]
    assert account_tasks == []
