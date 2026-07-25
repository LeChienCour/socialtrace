import { useQuery } from "@tanstack/react-query";
import { FileText, Users } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
  type BenchmarkMetric,
  type GrowthGranularity,
  type MonthlyMetric,
  type PostTimelineMetric,
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
  { value: "reach", label: "Reach" },
];

const BENCHMARK_METRICS: { value: BenchmarkMetric; label: string }[] = [
  { value: "avg_engagement_rate", label: "Avg. engagement rate" },
  { value: "avg_views", label: "Avg. views per post" },
  { value: "avg_reach", label: "Avg. reach per post" },
  { value: "avg_likes", label: "Avg. likes per post" },
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
      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
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

export function DashboardScreen() {
  const gradientId = useId();

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

  const followersGradientId = `${gradientId}-followers`;
  const reachGradientId = `${gradientId}-reach`;
  const postTimelineGradientId = `${gradientId}-post-timeline`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
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
          <CardTitle>Account growth</CardTitle>
          <CardDescription>
            Followers and reach for the selected account over time.
          </CardDescription>
          <div className="mt-1 flex gap-2">
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
            <p className="text-sm text-muted-foreground">Select an account.</p>
          )}
          {accountId && (!growth || growth.length === 0) && (
            <p className="text-sm text-muted-foreground">
              No snapshots captured yet.
            </p>
          )}
          {growth && growth.length > 0 && (
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Monthly performance</CardTitle>
              <CardDescription>
                All posts of the selected account, totaled by the month they
                were published — how did this month go, and how does it compare
                to last month.
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

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Post performance over time</CardTitle>
              <CardDescription>
                Every post of the selected account, oldest to newest — one line
                across the account's whole history, so you can see whether posts
                are trending up or down, not just one post's own growth.
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Benchmarks</CardTitle>
              <CardDescription>
                Compares platforms and content types against each other, using
                every post with captured data — pick a metric to see which
                format or platform performs best by that measure.
              </CardDescription>
            </div>
            <ChartSelect
              value={benchmarkMetric}
              onChange={setBenchmarkMetric}
              options={BENCHMARK_METRICS}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                By platform
              </h3>
              {benchmarks && benchmarks.by_platform.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={benchmarks.by_platform}>
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
                    <Bar
                      dataKey={benchmarkMetric}
                      fill={CHART_COLORS.violet}
                      radius={[6, 6, 0, 0]}
                    />
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
                    <Bar
                      dataKey={benchmarkMetric}
                      fill={CHART_COLORS.pink}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
