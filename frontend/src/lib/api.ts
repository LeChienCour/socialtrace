import { clearStoredToken, getStoredToken } from "./token";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function authFetch(
  path: string,
  options: RequestInit = {},
): Promise<globalThis.Response> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`/api${path}`, { ...options, headers });

  if (response.status === 401) {
    // Stale/wrong token — clear it and force the token prompt back up
    // rather than leaving the user stuck looking at silent failures.
    clearStoredToken();
    window.location.reload();
    throw new ApiError(401, "invalid API token");
  }

  return response;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const response = await authFetch(path, { ...options, headers });

  if (response.status === 204) {
    return undefined as T;
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : response.statusText;
    throw new ApiError(response.status, detail);
  }

  return body as T;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadFile(
  path: string,
  fallbackFilename: string,
): Promise<void> {
  const response = await authFetch(path);
  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackFilename;
  triggerBrowserDownload(await response.blob(), filename);
}

export type Platform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "x"
  | "linkedin"
  | "youtube"
  | "website";

export type ContentType =
  | "reel"
  | "story"
  | "carousel"
  | "video"
  | "image"
  | "text"
  | "short";

export interface Account {
  id: string;
  platform: Platform;
  handle: string;
  display_name: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export interface AccountCreate {
  platform: Platform;
  handle: string;
  display_name?: string | null;
}

export interface Post {
  id: string;
  account_id: string;
  url: string | null;
  description: string | null;
  content_type: string | null;
  campaign: string | null;
  tags: string[];
  published_at: string;
  created_at: string;
}

export interface PostCreate {
  account_id: string;
  url?: string | null;
  description?: string | null;
  content_type?: ContentType | null;
  published_at: string;
}

export interface PostUpdate {
  url?: string | null;
  description?: string | null;
  content_type?: ContentType | null;
  campaign?: string | null;
  published_at?: string;
}

export interface TaskItem {
  type: "account" | "post";
  target_id: string;
  label: string;
  window_key: string;
  status: "due" | "overdue";
  due_since: string;
}

export interface AccountSnapshotCreate {
  captured_at?: string | null;
  followers?: number | null;
  following?: number | null;
  posts_count?: number | null;
  reach?: number | null;
  impressions?: number | null;
  profile_visits?: number | null;
  link_clicks?: number | null;
  note?: string | null;
}

export interface PostSnapshotCreate {
  captured_at?: string | null;
  window_key?: "h24" | "d7" | "d30" | null;
  views?: number | null;
  reach?: number | null;
  impressions?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
  watch_time_sec?: number | null;
}

export interface OverviewResponse {
  total_accounts: number;
  total_posts: number;
  captures_last_7d: number;
  avg_engagement_rate: number | null;
}

export interface BenchmarkGroup {
  key: string;
  avg_engagement_rate: number;
  avg_views: number | null;
  avg_reach: number | null;
  avg_likes: number | null;
  sample_size: number;
}

export interface BenchmarksResponse {
  by_platform: BenchmarkGroup[];
  by_content_type: BenchmarkGroup[];
}

export type BenchmarkMetric =
  | "avg_engagement_rate"
  | "avg_views"
  | "avg_reach"
  | "avg_likes";

export interface MonthlyPoint {
  month_start: string;
  post_count: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_saves: number;
  avg_engagement_rate: number | null;
}

export type MonthlyMetric =
  | "total_views"
  | "total_likes"
  | "total_comments"
  | "total_shares"
  | "total_saves"
  | "avg_engagement_rate";

export type GrowthGranularity = "day" | "week" | "month";

export interface GrowthPoint {
  period_start: string;
  followers: number | null;
  reach: number | null;
  impressions: number | null;
  profile_visits: number | null;
}

export interface PostTimelinePoint {
  post_id: string;
  label: string;
  published_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reach: number | null;
  engagement_rate: number | null;
}

export type PostTimelineMetric =
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "reach"
  | "engagement_rate";

export interface BackupInfo {
  filename: string;
  size_bytes: number;
  modified_at: string;
}

export interface ImportResult {
  accounts: number;
  posts: number;
  account_snapshots: number;
  post_snapshots: number;
}

export const api = {
  listAccounts: (): Promise<Account[]> => apiFetch("/accounts"),
  createAccount: (payload: AccountCreate): Promise<Account> =>
    apiFetch("/accounts", { method: "POST", body: JSON.stringify(payload) }),
  listPosts: (accountId?: string): Promise<Post[]> =>
    apiFetch(`/posts${accountId ? `?account_id=${accountId}` : ""}`),
  createPost: (payload: PostCreate): Promise<Post> =>
    apiFetch("/posts", { method: "POST", body: JSON.stringify(payload) }),
  updatePost: (postId: string, payload: PostUpdate): Promise<Post> =>
    apiFetch(`/posts/${postId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deletePost: (postId: string): Promise<void> =>
    apiFetch(`/posts/${postId}`, { method: "DELETE" }),
  listTasks: (): Promise<TaskItem[]> => apiFetch("/tasks"),
  createAccountSnapshot: (
    accountId: string,
    payload: AccountSnapshotCreate,
  ): Promise<unknown> =>
    apiFetch(`/accounts/${accountId}/snapshots`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createPostSnapshot: (
    postId: string,
    payload: PostSnapshotCreate,
  ): Promise<unknown> =>
    apiFetch(`/posts/${postId}/snapshots`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getOverview: (): Promise<OverviewResponse> => apiFetch("/analytics/overview"),
  getBenchmarks: (): Promise<BenchmarksResponse> =>
    apiFetch("/analytics/benchmarks"),
  getGrowth: (
    accountId: string,
    granularity: GrowthGranularity = "day",
  ): Promise<GrowthPoint[]> =>
    apiFetch(
      `/analytics/growth?account_id=${accountId}&granularity=${granularity}`,
    ),
  getMonthly: (accountId: string): Promise<MonthlyPoint[]> =>
    apiFetch(`/analytics/monthly?account_id=${accountId}`),
  getPostsTimeline: (accountId: string): Promise<PostTimelinePoint[]> =>
    apiFetch(`/analytics/posts-timeline?account_id=${accountId}`),
  exportJson: (): Promise<void> =>
    downloadFile("/export?format=json", "socialtrace-export.json"),
  exportCsv: (): Promise<void> =>
    downloadFile("/export?format=csv", "socialtrace-export.zip"),
  listBackups: (): Promise<BackupInfo[]> => apiFetch("/backups"),
  downloadLatestBackup: (): Promise<void> =>
    downloadFile("/backups/latest", "socialtrace-backup.sql.gz"),
  importCsv: async (file: File): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    const response = await authFetch("/import/csv", {
      method: "POST",
      body: form,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        body && typeof body === "object" && "detail" in body
          ? String((body as { detail: unknown }).detail)
          : response.statusText;
      throw new ApiError(response.status, detail);
    }
    return body as ImportResult;
  },
};
