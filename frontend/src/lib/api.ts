import { clearStoredToken, getStoredToken } from "./token";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
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
};
