import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  type BenchmarkMetric,
  type GrowthGranularity,
  type MonthlyMetric,
  type PostTimelineMetric,
} from "@/lib/api";

const MONTHLY_METRICS: { value: MonthlyMetric; label: string }[] = [
  { value: "total_views", label: "Views" },
  { value: "total_likes", label: "Likes" },
  { value: "total_comments", label: "Comments" },
  { value: "total_shares", label: "Shares" },
  { value: "total_saves", label: "Saves" },
  { value: "avg_engagement_rate", label: "Avg. engagement rate" },
];

const POST_TIMELINE_METRICS: { value: PostTimelineMetric; label: string }[] = [
  { value: "engagement_rate", label: "Engagement rate" },
  { value: "views", label: "Views" },
  { value: "likes", label: "Likes" },
  { value: "comments", label: "Comments" },
  { value: "shares", label: "Shares" },
  { value: "reach", label: "Reach" },
];

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const BENCHMARK_METRICS: { value: BenchmarkMetric; label: string }[] = [
  { value: "avg_engagement_rate", label: "Avg. engagement rate" },
  { value: "avg_views", label: "Avg. views per post" },
  { value: "avg_reach", label: "Avg. reach per post" },
  { value: "avg_likes", label: "Avg. likes per post" },
];

function formatMonthLabel(monthStart: string): string {
  const [year, month] = monthStart.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short" },
  );
}

function formatDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "±0%" : "new";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}% vs last month`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-medium">{value}</div>
    </div>
  );
}

function formatPercent(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

function formatPercentTooltip(value: unknown): string {
  return typeof value === "number" ? formatPercent(value) : "—";
}

export function DashboardScreen() {
  const { data: overview } = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: api.getOverview,
  });
  const { data: benchmarks } = useQuery({
    queryKey: ["analytics", "benchmarks"],
    queryFn: api.getBenchmarks,
  });
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: api.listAccounts,
  });
  const [accountId, setAccountId] = useState("");
  const [granularity, setGranularity] = useState<GrowthGranularity>("day");
  const { data: growth } = useQuery({
    queryKey: ["analytics", "growth", accountId, granularity],
    queryFn: () => api.getGrowth(accountId, granularity),
    enabled: !!accountId,
  });

  const [monthlyMetric, setMonthlyMetric] =
    useState<MonthlyMetric>("total_views");
  const { data: monthly } = useQuery({
    queryKey: ["analytics", "monthly", accountId],
    queryFn: () => api.getMonthly(accountId),
    enabled: !!accountId,
  });
  const monthlyChartData = useMemo(
    () =>
      monthly?.map((point) => ({
        ...point,
        label: formatMonthLabel(point.month_start),
      })) ?? [],
    [monthly],
  );
  const monthlyDelta = useMemo(() => {
    if (!monthly || monthly.length < 2) return null;
    const last = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    const lastValue = last[monthlyMetric];
    const prevValue = prev[monthlyMetric];
    if (lastValue === null || prevValue === null) return null;
    return formatDelta(lastValue, prevValue);
  }, [monthly, monthlyMetric]);

  const [benchmarkMetric, setBenchmarkMetric] = useState<BenchmarkMetric>(
    "avg_engagement_rate",
  );
  const formatBenchmarkValue = (value: number): string =>
    benchmarkMetric === "avg_engagement_rate"
      ? formatPercent(value)
      : value.toFixed(1);

  const [postTimelineMetric, setPostTimelineMetric] =
    useState<PostTimelineMetric>("engagement_rate");
  const { data: postsTimeline } = useQuery({
    queryKey: ["analytics", "posts-timeline", accountId],
    queryFn: () => api.getPostsTimeline(accountId),
    enabled: !!accountId,
  });
  const postsTimelineChartData = useMemo(
    () =>
      postsTimeline?.map((point, index) => ({
        ...point,
        label: `${formatShortDate(point.published_at)} #${index + 1}`,
      })) ?? [],
    [postsTimeline],
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Accounts"
          value={String(overview?.total_accounts ?? "—")}
        />
        <StatTile label="Posts" value={String(overview?.total_posts ?? "—")} />
        <StatTile
          label="Captures (7d)"
          value={String(overview?.captures_last_7d ?? "—")}
        />
        <StatTile
          label="Avg. engagement"
          value={overview ? formatPercent(overview.avg_engagement_rate) : "—"}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Account growth</h2>
          <div className="flex gap-2">
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Select account</option>
              {accounts?.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.display_name || account.handle}
                </option>
              ))}
            </select>
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={granularity}
              onChange={(event) =>
                setGranularity(event.target.value as GrowthGranularity)
              }
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
        {!accountId && (
          <p className="text-sm text-muted-foreground">Select an account.</p>
        )}
        {accountId && (!growth || growth.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No snapshots captured yet.
          </p>
        )}
        {growth && growth.length > 0 && (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period_start" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="followers"
                stroke="#8884d8"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="reach"
                stroke="#82ca9d"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Monthly performance</h2>
            <p className="text-xs text-muted-foreground">
              All posts of the selected account, totaled by the month they were
              published — how did this month go, and how does it compare to last
              month.
            </p>
          </div>
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={monthlyMetric}
            onChange={(event) =>
              setMonthlyMetric(event.target.value as MonthlyMetric)
            }
          >
            {MONTHLY_METRICS.map((metric) => (
              <option key={metric.value} value={metric.value}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>
        {!accountId && (
          <p className="text-sm text-muted-foreground">Select an account.</p>
        )}
        {accountId && (!monthly || monthly.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No posts with captured data yet.
          </p>
        )}
        {monthly && monthly.length > 0 && (
          <>
            {monthlyDelta && (
              <p className="text-sm font-medium">{monthlyDelta}</p>
            )}
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={
                    monthlyMetric === "avg_engagement_rate"
                      ? formatPercentTooltip
                      : undefined
                  }
                />
                <Bar dataKey={monthlyMetric} fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Post performance over time</h2>
            <p className="text-xs text-muted-foreground">
              Every post of the selected account, oldest to newest — one line
              across the account's whole history, so you can see whether posts
              are trending up or down, not just one post's own growth.
            </p>
          </div>
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={postTimelineMetric}
            onChange={(event) =>
              setPostTimelineMetric(event.target.value as PostTimelineMetric)
            }
          >
            {POST_TIMELINE_METRICS.map((metric) => (
              <option key={metric.value} value={metric.value}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>
        {!accountId && (
          <p className="text-sm text-muted-foreground">Select an account.</p>
        )}
        {accountId && (!postsTimeline || postsTimeline.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No posts with captured data yet.
          </p>
        )}
        {postsTimeline && postsTimeline.length > 0 && (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={postsTimelineChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={
                  postTimelineMetric === "engagement_rate"
                    ? formatPercentTooltip
                    : undefined
                }
              />
              <Line
                type="monotone"
                dataKey={postTimelineMetric}
                stroke="#8884d8"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Benchmarks</h2>
            <p className="text-xs text-muted-foreground">
              Compares platforms and content types against each other, using
              every post with captured data — pick a metric to see which format
              or platform performs best by that measure.
            </p>
          </div>
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={benchmarkMetric}
            onChange={(event) =>
              setBenchmarkMetric(event.target.value as BenchmarkMetric)
            }
          >
            {BENCHMARK_METRICS.map((metric) => (
              <option key={metric.value} value={metric.value}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              By platform
            </h3>
            {benchmarks && benchmarks.by_platform.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={benchmarks.by_platform}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="key" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: unknown) =>
                      typeof value === "number"
                        ? formatBenchmarkValue(value)
                        : "—"
                    }
                  />
                  <Bar dataKey={benchmarkMetric} fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              By content type
            </h3>
            {benchmarks && benchmarks.by_content_type.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={benchmarks.by_content_type}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="key" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: unknown) =>
                      typeof value === "number"
                        ? formatBenchmarkValue(value)
                        : "—"
                    }
                  />
                  <Bar dataKey={benchmarkMetric} fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
