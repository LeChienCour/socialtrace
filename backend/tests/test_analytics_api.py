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


@pytest.fixture
async def post_id(client: AsyncClient, account_id: str) -> str:
    response = await client.post(
        "/posts",
        json={
            "account_id": account_id,
            "url": "https://instagram.com/p/abc",
            "content_type": "reel",
            "published_at": "2026-01-01T00:00:00Z",
        },
    )
    id_: str = response.json()["id"]
    return id_


async def test_overview_empty(client: AsyncClient) -> None:
    response = await client.get("/analytics/overview")
    assert response.status_code == 200
    body = response.json()
    assert body["total_accounts"] == 0
    assert body["avg_engagement_rate"] is None


async def test_overview_counts_accounts_and_posts(
    client: AsyncClient, account_id: str, post_id: str
) -> None:
    response = await client.get("/analytics/overview")
    body = response.json()
    assert body["total_accounts"] == 1
    assert body["total_posts"] == 1


async def test_post_curves_returns_points_with_engagement_rate(
    client: AsyncClient, post_id: str
) -> None:
    await client.post(
        f"/posts/{post_id}/snapshots",
        json={"window_key": "h24", "likes": 10, "comments": 5, "reach": 100},
    )

    response = await client.get("/analytics/post-curves", params={"ids": post_id})
    assert response.status_code == 200
    curves = response.json()
    assert len(curves) == 1
    assert curves[0]["post_id"] == post_id
    point = curves[0]["points"][0]
    assert point["window_key"] == "h24"
    assert point["engagement_rate"] == 15 / 100
    assert point["hours_since_published"] > 0


async def test_benchmarks_groups_by_platform_and_content_type(
    client: AsyncClient, post_id: str
) -> None:
    await client.post(
        f"/posts/{post_id}/snapshots",
        json={"window_key": "h24", "likes": 10, "reach": 100},
    )

    response = await client.get("/analytics/benchmarks")
    body = response.json()
    assert any(g["key"] == "instagram" for g in body["by_platform"])
    assert any(g["key"] == "reel" for g in body["by_content_type"])


async def test_benchmarks_groups_by_hour_and_weekday(client: AsyncClient, post_id: str) -> None:
    await client.post(
        f"/posts/{post_id}/snapshots",
        json={"window_key": "h24", "likes": 10, "reach": 100},
    )

    response = await client.get("/analytics/benchmarks")
    body = response.json()
    # The fixture publishes at 2026-01-01T00:00:00Z on a UTC account, so the
    # slot is midnight Thursday in the account's own timezone.
    assert [g["key"] for g in body["by_hour"]] == ["00:00"]
    assert [g["key"] for g in body["by_weekday"]] == ["Thu"]


async def test_benchmarks_filtered_by_account(client: AsyncClient, post_id: str) -> None:
    other = await client.post("/accounts", json={"platform": "tiktok", "handle": "other"})
    other_id = other.json()["id"]
    other_post = await client.post(
        "/posts",
        json={
            "account_id": other_id,
            "url": "https://tiktok.com/@other/video/1",
            "content_type": "short",
            "published_at": "2026-01-02T00:00:00Z",
        },
    )
    await client.post(
        f"/posts/{other_post.json()['id']}/snapshots",
        json={"window_key": "h24", "likes": 5, "reach": 50},
    )
    await client.post(
        f"/posts/{post_id}/snapshots",
        json={"window_key": "h24", "likes": 10, "reach": 100},
    )

    unfiltered = (await client.get("/analytics/benchmarks")).json()
    assert len(unfiltered["by_platform"]) == 2

    filtered = (await client.get("/analytics/benchmarks", params={"account_id": other_id})).json()
    assert [g["key"] for g in filtered["by_platform"]] == ["tiktok"]


async def test_posts_timeline_without_account_covers_every_account(
    client: AsyncClient, post_id: str
) -> None:
    await client.post(
        f"/posts/{post_id}/snapshots",
        json={"window_key": "h24", "likes": 10, "reach": 100},
    )

    response = await client.get("/analytics/posts-timeline")
    assert response.status_code == 200
    points = response.json()
    assert len(points) == 1
    assert points[0]["account_label"] == "acme"
    assert points[0]["platform"] == "instagram"
    assert points[0]["content_type"] == "reel"
    assert points[0]["published_hour"] == 0
    assert points[0]["published_weekday"] == "Thu"
    assert points[0]["engagement_rate"] == 10 / 100


async def test_overview_filtered_by_account(client: AsyncClient, post_id: str) -> None:
    other = await client.post("/accounts", json={"platform": "tiktok", "handle": "other"})
    other_id = other.json()["id"]

    body = (await client.get("/analytics/overview", params={"account_id": other_id})).json()
    assert body["total_accounts"] == 1
    assert body["total_posts"] == 0


async def test_growth_returns_bucketed_points(client: AsyncClient, account_id: str) -> None:
    await client.post(
        f"/accounts/{account_id}/snapshots",
        json={"followers": 1000, "captured_at": "2026-01-01T00:00:00Z"},
    )
    await client.post(
        f"/accounts/{account_id}/snapshots",
        json={"followers": 1100, "captured_at": "2026-01-08T00:00:00Z"},
    )

    response = await client.get(
        "/analytics/growth", params={"account_id": account_id, "granularity": "day"}
    )
    assert response.status_code == 200
    points = response.json()
    assert len(points) == 2
    assert points[0]["followers"] == 1000
    assert points[1]["followers"] == 1100


async def test_growth_missing_account_404(client: AsyncClient) -> None:
    response = await client.get(
        "/analytics/growth", params={"account_id": "00000000-0000-0000-0000-000000000000"}
    )
    assert response.status_code == 404
