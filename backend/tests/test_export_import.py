import zipfile
from collections.abc import AsyncGenerator
from io import BytesIO

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from tests.conftest import AUTH_HEADERS, make_test_app


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient]:
    app = make_test_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS) as ac:
        yield ac


@pytest.fixture
async def seeded(client: AsyncClient) -> dict[str, str]:
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
    post_id = post.json()["id"]
    await client.post(
        f"/accounts/{account_id}/snapshots",
        json={"followers": 1000, "captured_at": "2026-01-01T00:00:00Z"},
    )
    await client.post(
        f"/posts/{post_id}/snapshots",
        json={"window_key": "h24", "views": 100, "likes": 10},
    )
    return {"account_id": account_id, "post_id": post_id}


async def test_export_json_contains_seeded_data(
    client: AsyncClient, seeded: dict[str, str]
) -> None:
    response = await client.get("/export", params={"format": "json"})
    assert response.status_code == 200
    body = response.json()
    assert len(body["accounts"]) == 1
    assert len(body["posts"]) == 1
    assert len(body["account_snapshots"]) == 1
    assert len(body["post_snapshots"]) == 1
    assert body["accounts"][0]["id"] == seeded["account_id"]


async def test_export_csv_is_zip_with_four_files(
    client: AsyncClient, seeded: dict[str, str]
) -> None:
    response = await client.get("/export", params={"format": "csv"})
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    archive = zipfile.ZipFile(BytesIO(response.content))
    assert set(archive.namelist()) == {
        "accounts.csv",
        "posts.csv",
        "account_snapshots.csv",
        "post_snapshots.csv",
    }
    accounts_csv = archive.read("accounts.csv").decode()
    assert seeded["account_id"] in accounts_csv


async def test_import_csv_round_trip_restores_data(
    client: AsyncClient, seeded: dict[str, str]
) -> None:
    export_response = await client.get("/export", params={"format": "csv"})
    export_bytes = export_response.content

    from socialtrace.db.session import engine

    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE posts, accounts RESTART IDENTITY CASCADE"))

    empty = await client.get("/accounts")
    assert empty.json() == []

    import_response = await client.post(
        "/import/csv",
        files={"file": ("socialtrace-export.zip", export_bytes, "application/zip")},
    )
    assert import_response.status_code == 200
    assert import_response.json() == {
        "accounts": 1,
        "posts": 1,
        "account_snapshots": 1,
        "post_snapshots": 1,
    }

    restored_accounts = await client.get("/accounts")
    assert restored_accounts.json()[0]["id"] == seeded["account_id"]

    restored_snapshots = await client.get(f"/posts/{seeded['post_id']}/snapshots")
    assert restored_snapshots.json()[0]["views"] == 100


async def test_import_rejects_invalid_zip(client: AsyncClient) -> None:
    response = await client.post(
        "/import/csv",
        files={"file": ("not-a-zip.zip", b"this is not a zip file", "application/zip")},
    )
    assert response.status_code == 400
