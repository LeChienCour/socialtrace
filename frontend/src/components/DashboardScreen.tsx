import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { api, type GrowthGranularity } from "@/lib/api";

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
  const { data: posts } = useQuery({
    queryKey: ["posts"],
    queryFn: () => api.listPosts(),
  });

  const [accountId, setAccountId] = useState("");
  const [granularity, setGranularity] = useState<GrowthGranularity>("day");
  const { data: growth } = useQuery({
    queryKey: ["analytics", "growth", accountId, granularity],
    queryFn: () => api.getGrowth(accountId, granularity),
    enabled: !!accountId,
  });

  const [postId, setPostId] = useState("");
  const { data: curves } = useQuery({
    queryKey: ["analytics", "post-curves", postId],
    queryFn: () => api.getPostCurves([postId]),
    enabled: !!postId,
  });
  const curve = curves?.[0];

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
          <h2 className="text-lg font-medium">Post curve</h2>
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={postId}
            onChange={(event) => setPostId(event.target.value)}
          >
            <option value="">Select post</option>
            {posts?.map((post) => (
              <option key={post.id} value={post.id}>
                {post.description || post.url}
              </option>
            ))}
          </select>
        </div>
        {!postId && (
          <p className="text-sm text-muted-foreground">Select a post.</p>
        )}
        {postId && (!curve || curve.points.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No snapshots captured yet.
          </p>
        )}
        {curve && curve.points.length > 0 && (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={curve.points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="hours_since_published"
                tick={{ fontSize: 12 }}
                label={{
                  value: "hours since published",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="views"
                stroke="#8884d8"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="likes"
                stroke="#82ca9d"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Benchmarks</h2>
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
                  <Tooltip formatter={formatPercentTooltip} />
                  <Bar dataKey="avg_engagement_rate" fill="#8884d8" />
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
                  <Tooltip formatter={formatPercentTooltip} />
                  <Bar dataKey="avg_engagement_rate" fill="#82ca9d" />
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
