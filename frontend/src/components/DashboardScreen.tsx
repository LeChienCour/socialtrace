import { useQuery } from "@tanstack/react-query";
import { FileText, Users } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  api,
  type BenchmarkDimension,
  type BenchmarkMetric,
  type GrowthGranularity,
  type MonthlyMetric,
  type PostTimelineMetric,
  type PostTimelinePoint,
} from "@/lib/api";
import {
  CHART_COLORS,
  chartAxisColor,
  chartGridColor,
  chartTooltipStyle,
} from "@/lib/chart-theme";

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
  { value: "saves", label: "Saves" },
  { value: "reach", label: "Reach" },
];

const BENCHMARK_METRICS: { value: BenchmarkMetric; label: string }[] = [
  { value: "avg_engagement_rate", label: "Avg. engagement rate" },
  { value: "avg_views", label: "Avg. views per post" },
  { value: "avg_reach", label: "Avg. reach per post" },
  { value: "avg_likes", label: "Avg. likes per post" },
];

const BENCHMARK_DIMENSIONS: {
  value: BenchmarkDimension;
  label: string;
  question: string;
}[] = [
  {
    value: "by_content_type",
    label: "Content type",
    question: "which format earns the most",
  },
  {
    value: "by_hour",
    label: "Hour published",
    question: "what time of day to post",
  },
  {
    value: "by_weekday",
    label: "Weekday published",
    question: "which day to post",
  },
  {
    value: "by_platform",
    label: "Platform",
    question: "where the audience responds",
  },
  {
    value: "by_campaign",
    label: "Campaign",
    question: "which campaign landed",
  },
  { value: "by_tag", label: "Tag", question: "which themes land" },
];

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

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

function formatPercent(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

function formatPercentTooltip(value: unknown): string {
  return typeof value === "number" ? formatPercent(value) : "—";
}

function formatCount(value: number | null): string {
  return value === null ? "—" : value.toLocaleString();
}

function GradientStat({
  label,
  value,
  gradient,
}: {
  label: string;
  value: string;
  gradient: "1" | "2";
}) {
  return (
    <div
      className="flex flex-col justify-between rounded-2xl p-4 text-white shadow-sm"
      style={{ background: `var(--gradient-${gradient})` }}
    >
      <span className="text-xs font-medium text-white/80">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
}

function IconStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

function ChartSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <select
      className="h-8 shrink-0 rounded-lg border border-input bg-transparent px-2.5 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function metricValue(
  post: PostTimelinePoint,
  metric: PostTimelineMetric,
): number | null {
  return post[metric];
}

function ComparisonTable({
  posts,
  metric,
}: {
  posts: PostTimelinePoint[];
  metric: PostTimelineMetric;
}) {
  // Ranked by the selected metric so "which post did best" is the first row
  // rather than something the reader has to scan for. Posts with no captured
  // value for that metric sort last — they aren't zero, they're unknown.
  const ranked = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const left = metricValue(a, metric);
        const right = metricValue(b, metric);
        if (left === null && right === null) return 0;
        if (left === null) return 1;
        if (right === null) return -1;
        return right - left;
      }),
    [posts, metric],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Post</th>
            <th className="py-2 pr-3 font-medium">Account</th>
            <th className="py-2 pr-3 font-medium">Format</th>
            <th className="py-2 pr-3 font-medium">Published</th>
            <th className="py-2 pr-3 text-right font-medium">Views</th>
            <th className="py-2 pr-3 text-right font-medium">Likes</th>
            <th className="py-2 text-right font-medium">Engagement</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((post, index) => (
            <tr
              key={post.post_id}
              className="border-b border-border/50 last:border-0"
            >
              <td className="py-2 pr-3 text-muted-foreground">{index + 1}</td>
              <td className="max-w-56 truncate py-2 pr-3 font-medium">
                {post.label}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">
                {post.account_label}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">
                {post.content_type ?? "—"}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                {post.published_weekday}{" "}
                {String(post.published_hour).padStart(2, "0")}:00
              </td>
              <td className="py-2 pr-3 text-right">
                {formatCount(post.views)}
              </td>
              <td className="py-2 pr-3 text-right">
                {formatCount(post.likes)}
              </td>
              <td className="py-2 text-right">
                {formatPercent(post.engagement_rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardScreen() {
  const gradientId = useId();

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: api.listAccounts,
  });
  // "" means every account — the whole dashboard follows this one filter.
  const [accountId, setAccountId] = useState("");
  const accountFilter = accountId || undefined;

  const { data: overview } = useQuery({
    queryKey: ["analytics", "overview", accountId],
    queryFn: () => api.getOverview(accountFilter),
  });
  const { data: benchmarks } = useQuery({
    queryKey: ["analytics", "benchmarks", accountId],
    queryFn: () => api.getBenchmarks(accountFilter),
  });
  const { data: postsTimeline } = useQuery({
    queryKey: ["analytics", "posts-timeline", accountId],
    queryFn: () => api.getPostsTimeline(accountFilter),
  });

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
  const [dimension, setDimension] =
    useState<BenchmarkDimension>("by_content_type");
  const dimensionMeta = BENCHMARK_DIMENSIONS.find((d) => d.value === dimension);
  const formatBenchmarkValue = (value: number): string =>
    benchmarkMetric === "avg_engagement_rate"
      ? formatPercent(value)
      : value.toFixed(1);

  const benchmarkGroups = benchmarks?.[dimension] ?? [];
  // Hour/weekday keep their chronological order; everything else reads best
  // ranked by the metric being compared.
  const benchmarkChartData = useMemo(() => {
    const chronological = dimension === "by_hour" || dimension === "by_weekday";
    const rows = [...benchmarkGroups];
    if (!chronological) {
      rows.sort(
        (a, b) => (b[benchmarkMetric] ?? 0) - (a[benchmarkMetric] ?? 0),
      );
    }
    return rows;
  }, [benchmarkGroups, benchmarkMetric, dimension]);
  const bestGroup = useMemo(() => {
    const scored = benchmarkGroups.filter((g) => g[benchmarkMetric] !== null);
    if (scored.length === 0) return null;
    return scored.reduce((best, group) =>
      (group[benchmarkMetric] ?? 0) > (best[benchmarkMetric] ?? 0)
        ? group
        : best,
    );
  }, [benchmarkGroups, benchmarkMetric]);

  const [postTimelineMetric, setPostTimelineMetric] =
    useState<PostTimelineMetric>("engagement_rate");
  const postsTimelineChartData = useMemo(
    () =>
      postsTimeline?.map((point, index) => ({
        ...point,
        label: `${formatShortDate(point.published_at)} #${index + 1}`,
      })) ?? [],
    [postsTimeline],
  );

  const followersGradientId = `${gradientId}-followers`;
  const reachGradientId = `${gradientId}-reach`;
  const postTimelineGradientId = `${gradientId}-post-timeline`;
  const scopeLabel = accountId
    ? (accounts?.find((a) => a.id === accountId)?.display_name ??
      accounts?.find((a) => a.id === accountId)?.handle ??
      "this account")
    : "all accounts";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Showing {scopeLabel}.</p>
        </div>
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          <option value="">All accounts</option>
          {accounts?.map((account) => (
            <option key={account.id} value={account.id}>
              {account.display_name || account.handle} ({account.platform})
            </option>
          ))}
        </select>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <GradientStat
          label="Avg. engagement"
          value={overview ? formatPercent(overview.avg_engagement_rate) : "—"}
          gradient="1"
        />
        <GradientStat
          label="Captures (7d)"
          value={String(overview?.captures_last_7d ?? "—")}
          gradient="2"
        />
        <IconStat
          label="Accounts"
          value={String(overview?.total_accounts ?? "—")}
          icon={Users}
        />
        <IconStat
          label="Posts"
          value={String(overview?.total_posts ?? "—")}
          icon={FileText}
        />
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>What works best</CardTitle>
              <CardDescription>
                Every post with captured data, grouped by one attribute —{" "}
                {dimensionMeta?.question ?? "what performs best"}.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <ChartSelect
                value={dimension}
                onChange={setDimension}
                options={BENCHMARK_DIMENSIONS}
              />
              <ChartSelect
                value={benchmarkMetric}
                onChange={setBenchmarkMetric}
                options={BENCHMARK_METRICS}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {benchmarkChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No posts with captured data for this grouping yet.
            </p>
          ) : (
            <>
              {bestGroup && (
                <p className="mb-2 text-sm">
                  Best: <span className="font-medium">{bestGroup.key}</span> at{" "}
                  {formatBenchmarkValue(bestGroup[benchmarkMetric] ?? 0)}{" "}
                  <span className="text-muted-foreground">
                    ({bestGroup.sample_size}{" "}
                    {bestGroup.sample_size === 1 ? "post" : "posts"})
                  </span>
                </p>
              )}
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={benchmarkChartData}>
                  <CartesianGrid
                    stroke={chartGridColor}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="key"
                    tick={{ fontSize: 12, fill: chartAxisColor }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: chartAxisColor }} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value: unknown) =>
                      typeof value === "number"
                        ? formatBenchmarkValue(value)
                        : "—"
                    }
                  />
                  <Bar dataKey={benchmarkMetric} radius={[6, 6, 0, 0]}>
                    {benchmarkChartData.map((group) => (
                      <Cell
                        key={group.key}
                        fill={
                          group.key === bestGroup?.key
                            ? CHART_COLORS.pink
                            : CHART_COLORS.violet
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Post comparison</CardTitle>
              <CardDescription>
                Every post side by side, ranked by the selected metric — the top
                row is the best performer for {scopeLabel}.
              </CardDescription>
            </div>
            <ChartSelect
              value={postTimelineMetric}
              onChange={setPostTimelineMetric}
              options={POST_TIMELINE_METRICS}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!postsTimeline || postsTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No posts with captured data yet.
            </p>
          ) : (
            <ComparisonTable
              posts={postsTimeline}
              metric={postTimelineMetric}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Post performance over time</CardTitle>
              <CardDescription>
                The same posts and metric as the table above, oldest to newest —
                one line across the whole history, so you can see whether posts
                are trending up or down, not just one post's own growth.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!postsTimeline || postsTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No posts with captured data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={postsTimelineChartData}>
                <defs>
                  <linearGradient
                    id={postTimelineGradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS.pink}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS.pink}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: chartAxisColor }}
                />
                <YAxis tick={{ fontSize: 12, fill: chartAxisColor }} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={
                    postTimelineMetric === "engagement_rate"
                      ? formatPercentTooltip
                      : undefined
                  }
                />
                <Area
                  type="monotone"
                  dataKey={postTimelineMetric}
                  stroke={CHART_COLORS.pink}
                  fill={`url(#${postTimelineGradientId})`}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Account growth</CardTitle>
              <CardDescription>
                Followers and reach over time. Account snapshots are per
                account, so pick one above.
              </CardDescription>
            </div>
            <ChartSelect
              value={granularity}
              onChange={setGranularity}
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!accountId && (
            <p className="text-sm text-muted-foreground">
              Pick a single account to see its growth.
            </p>
          )}
          {accountId && (!growth || growth.length === 0) && (
            <p className="text-sm text-muted-foreground">
              No snapshots captured yet.
            </p>
          )}
          {accountId && growth && growth.length > 0 && (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={growth}>
                <defs>
                  <linearGradient
                    id={followersGradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS.violet}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS.violet}
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient
                    id={reachGradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS.cyan}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS.cyan}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                <XAxis
                  dataKey="period_start"
                  tick={{ fontSize: 12, fill: chartAxisColor }}
                />
                <YAxis tick={{ fontSize: 12, fill: chartAxisColor }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="followers"
                  stroke={CHART_COLORS.violet}
                  fill={`url(#${followersGradientId})`}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="reach"
                  stroke={CHART_COLORS.cyan}
                  fill={`url(#${reachGradientId})`}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Monthly performance</CardTitle>
              <CardDescription>
                Posts totaled by the month they were published — how did this
                month go, and how does it compare to last month.
              </CardDescription>
            </div>
            <ChartSelect
              value={monthlyMetric}
              onChange={setMonthlyMetric}
              options={MONTHLY_METRICS}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!accountId && (
            <p className="text-sm text-muted-foreground">
              Pick a single account to see its monthly rollup.
            </p>
          )}
          {accountId && (!monthly || monthly.length === 0) && (
            <p className="text-sm text-muted-foreground">
              No posts with captured data yet.
            </p>
          )}
          {accountId && monthly && monthly.length > 0 && (
            <>
              {monthlyDelta && (
                <p className="mb-2 text-sm font-medium">{monthlyDelta}</p>
              )}
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyChartData}>
                  <CartesianGrid
                    stroke={chartGridColor}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: chartAxisColor }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: chartAxisColor }} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={
                      monthlyMetric === "avg_engagement_rate"
                        ? formatPercentTooltip
                        : undefined
                    }
                  />
                  <Bar
                    dataKey={monthlyMetric}
                    fill={CHART_COLORS.violet}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
