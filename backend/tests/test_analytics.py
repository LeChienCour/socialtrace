from datetime import UTC, datetime

from socialtrace.analytics import bucket_account_snapshots, compute_engagement_rate


def test_no_engagement_data_returns_none() -> None:
    assert compute_engagement_rate(None, None, None, None, 1000, None, None) is None


def test_reach_preferred_over_impressions_and_followers() -> None:
    rate = compute_engagement_rate(10, 5, 0, 0, reach=100, impressions=1000, followers=10000)
    assert rate == 15 / 100


def test_falls_back_to_impressions_without_reach() -> None:
    rate = compute_engagement_rate(10, 0, 0, 0, reach=None, impressions=200, followers=10000)
    assert rate == 10 / 200


def test_falls_back_to_followers_without_reach_or_impressions() -> None:
    rate = compute_engagement_rate(10, 0, 0, 0, reach=None, impressions=None, followers=500)
    assert rate == 10 / 500


def test_zero_denominator_returns_none() -> None:
    assert compute_engagement_rate(10, 0, 0, 0, reach=0, impressions=None, followers=None) is None


def test_no_denominator_available_returns_none() -> None:
    rate = compute_engagement_rate(10, 0, 0, 0, reach=None, impressions=None, followers=None)
    assert rate is None


class _FakeSnapshot:
    def __init__(
        self,
        captured_at: datetime,
        followers: int | None = None,
        reach: int | None = None,
        impressions: int | None = None,
        profile_visits: int | None = None,
    ) -> None:
        self.captured_at = captured_at
        self.followers = followers
        self.reach = reach
        self.impressions = impressions
        self.profile_visits = profile_visits


def test_bucket_by_day_keeps_latest_per_day() -> None:
    morning = _FakeSnapshot(datetime(2026, 1, 1, 8, tzinfo=UTC), followers=100)
    evening = _FakeSnapshot(datetime(2026, 1, 1, 20, tzinfo=UTC), followers=110)
    points = bucket_account_snapshots([morning, evening], "day")
    assert len(points) == 1
    assert points[0].followers == 110


def test_bucket_by_week_groups_across_days() -> None:
    monday = _FakeSnapshot(datetime(2026, 1, 5, tzinfo=UTC), followers=100)  # Monday
    wednesday = _FakeSnapshot(datetime(2026, 1, 7, tzinfo=UTC), followers=105)
    points = bucket_account_snapshots([monday, wednesday], "week")
    assert len(points) == 1
    assert points[0].followers == 105
    assert points[0].period_start.weekday() == 0  # bucketed to Monday


def test_bucket_by_month_groups_across_weeks() -> None:
    early = _FakeSnapshot(datetime(2026, 1, 2, tzinfo=UTC), followers=100)
    late = _FakeSnapshot(datetime(2026, 1, 28, tzinfo=UTC), followers=130)
    points = bucket_account_snapshots([early, late], "month")
    assert len(points) == 1
    assert points[0].followers == 130
    assert points[0].period_start.day == 1
