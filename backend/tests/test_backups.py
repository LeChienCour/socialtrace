import gzip
from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from socialtrace.settings import settings
from tests.conftest import AUTH_HEADERS, make_test_app


@pytest.fixture
async def client_and_dir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> AsyncGenerator[tuple[AsyncClient, Path]]:
    daily_dir = tmp_path / "daily"
    daily_dir.mkdir()
    monkeypatch.setattr(settings, "backup_dir", str(tmp_path))

    app = make_test_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS) as ac:
        yield ac, daily_dir


async def test_list_backups_empty(client_and_dir: tuple[AsyncClient, Path]) -> None:
    client, _ = client_and_dir
    response = await client.get("/backups")
    assert response.status_code == 200
    assert response.json() == []


async def test_download_latest_backup(client_and_dir: tuple[AsyncClient, Path]) -> None:
    client, daily_dir = client_and_dir
    dump_path = daily_dir / "socialtrace-20260101-000000.sql.gz"
    with gzip.open(dump_path, "wb") as f:
        f.write(b"-- fake dump")

    listed = await client.get("/backups")
    assert listed.status_code == 200
    assert listed.json()[0]["filename"] == dump_path.name

    response = await client.get("/backups/latest")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/gzip"
    assert gzip.decompress(response.content) == b"-- fake dump"


async def test_download_latest_backup_404_when_none(
    client_and_dir: tuple[AsyncClient, Path],
) -> None:
    client, _ = client_and_dir
    response = await client.get("/backups/latest")
    assert response.status_code == 404
