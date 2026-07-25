#!/usr/bin/env python3
"""Seeds ~6 months of realistic synthetic demo data through the live API —
accounts, posts, and the snapshots that reconstruct their curves. Run
against an empty dev instance (`make seed`); safe to re-run, but re-running
adds a second batch of demo accounts/posts rather than resetting anything.

Talks to the real HTTP API (not the DB directly) so it exercises the same
validation every other client goes through, and works identically whether
the stack is running via compose or Quadlet.
"""

import os
import random
import sys
from datetime import UTC, datetime, timedelta

import httpx

BASE_URL = os.environ.get("SOCIALTRACE_SEED_URL", "http://localhost:8080/api")
API_TOKEN = os.environ.get("SOCIALTRACE_API_TOKEN")

RUN_TAG = datetime.now(UTC).strftime("%Y%m%d%H%M%S")

DEMO_ACCOUNTS = [
    {"platform": "instagram", "handle": f"demo-acme-ig-{RUN_TAG}", "display_name": "Acme (demo)"},
    {"platform": "tiktok", "handle": f"demo-acme-tt-{RUN_TAG}", "display_name": "Acme (demo)"},
    {"platform": "youtube", "handle": f"demo-acme-yt-{RUN_TAG}", "display_name": "Acme (demo)"},
]

CONTENT_TYPES_BY_PLATFORM = {
    "instagram": ["reel", "carousel", "image", "story"],
    "tiktok": ["short", "video"],
    "youtube": ["video", "short"],
}

WEEKS_OF_HISTORY = 26
POSTS_PER_WEEK_RANGE = (1, 3)

random.seed(42)


def die(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    sys.exit(1)


def make_client() -> httpx.Client:
    if not API_TOKEN:
        die(
            "SOCIALTRACE_API_TOKEN is not set. Find it with "
            "`podman compose logs backend | grep Token`, then re-run:\n"
            "  SOCIALTRACE_API_TOKEN=<token> make seed"
        )
    return httpx.Client(
        base_url=BASE_URL, headers={"Authorization": f"Bearer {API_TOKEN}"}, timeout=10.0
    )


def create_account(client: httpx.Client, payload: dict[str, str]) -> dict[str, object]:
    response = client.post("/accounts", json=payload)
    response.raise_for_status()
    result: dict[str, object] = response.json()
    return result


def seed_account_growth(client: httpx.Client, account_id: str, base_followers: int) -> None:
    """Weekly snapshots for the last WEEKS_OF_HISTORY weeks, gently growing
    with noise — not a straight line, real accounts wobble week to week."""
    now = datetime.now(UTC)
    followers = base_followers
    for week_ago in range(WEEKS_OF_HISTORY, 0, -1):
        captured_at = now - timedelta(weeks=week_ago)
        followers += random.randint(-15, 60)
        followers = max(followers, 10)
        reach = int(followers * random.uniform(0.15, 0.4))
        impressions = int(reach * random.uniform(1.2, 2.0))
        client.post(
            f"/accounts/{account_id}/snapshots",
            json={
                "captured_at": captured_at.isoformat(),
                "followers": followers,
                "reach": reach,
                "impressions": impressions,
                "profile_visits": int(reach * random.uniform(0.02, 0.08)),
            },
        ).raise_for_status()


def seed_post_with_curve(
    client: httpx.Client, account_id: str, platform: str, published_at: datetime
) -> None:
    content_type = random.choice(CONTENT_TYPES_BY_PLATFORM[platform])
    post = client.post(
        "/posts",
        json={
            "account_id": account_id,
            "url": f"https://{platform}.example/p/{random.randint(100000, 999999)}",
            "content_type": content_type,
            "published_at": published_at.isoformat(),
        },
    )
    post.raise_for_status()
    post_id = post.json()["id"]

    # Eventual total views this post would reach, and how much of that total
    # each window has accumulated — the decay curve the whole product exists
    # to reconstruct. h24 grabs most of it; d30 is a long, small tail.
    eventual_views = random.randint(500, 50000)
    fractions = {"h24": random.uniform(0.55, 0.75), "d7": random.uniform(0.85, 0.95), "d30": 1.0}

    now = datetime.now(UTC)
    offsets = {"h24": timedelta(hours=24), "d7": timedelta(days=7), "d30": timedelta(days=30)}

    for window_key, offset in offsets.items():
        captured_at = published_at + offset
        if captured_at > now:
            continue  # window hasn't elapsed yet for this post — skip it
        views = int(eventual_views * fractions[window_key])
        likes = int(views * random.uniform(0.03, 0.09))
        comments = int(views * random.uniform(0.002, 0.01))
        shares = int(views * random.uniform(0.001, 0.006))
        saves = int(views * random.uniform(0.005, 0.02))
        reach = int(views * random.uniform(0.7, 0.95))
        client.post(
            f"/posts/{post_id}/snapshots",
            json={
                "captured_at": captured_at.isoformat(),
                "window_key": window_key,
                "views": views,
                "likes": likes,
                "comments": comments,
                "shares": shares,
                "saves": saves,
                "reach": reach,
                "impressions": int(reach * random.uniform(1.1, 1.5)),
            },
        ).raise_for_status()


def main() -> None:
    client = make_client()
    total_posts = 0

    for account_payload in DEMO_ACCOUNTS:
        account = create_account(client, account_payload)
        account_id = str(account["id"])
        platform = str(account["platform"])
        print(f"created account {account_payload['handle']} ({platform})")

        seed_account_growth(client, account_id, base_followers=random.randint(500, 5000))

        now = datetime.now(UTC)
        for week_ago in range(WEEKS_OF_HISTORY, 0, -1):
            week_start = now - timedelta(weeks=week_ago)
            for _ in range(random.randint(*POSTS_PER_WEEK_RANGE)):
                published_at = week_start + timedelta(
                    days=random.randint(0, 6), hours=random.randint(0, 23)
                )
                seed_post_with_curve(client, account_id, platform, published_at)
                total_posts += 1

    print(
        f"done: {len(DEMO_ACCOUNTS)} accounts, {total_posts} posts, "
        f"{WEEKS_OF_HISTORY} weeks of history"
    )


if __name__ == "__main__":
    main()
