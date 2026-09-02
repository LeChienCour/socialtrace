import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { EditPostModal } from "@/components/EditPostModal";
import { EditSnapshotModal } from "@/components/EditSnapshotModal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type ContentType, type Post, type PostSnapshot } from "@/lib/api";

const CONTENT_TYPES: ContentType[] = [
  "reel",
  "story",
  "carousel",
  "video",
  "image",
  "text",
  "short",
];

function PostSnapshotHistory({ postId }: { postId: string }) {
  const { data: snapshots, isPending } = useQuery({
    queryKey: ["post-snapshots", postId],
    queryFn: () => api.listPostSnapshots(postId),
  });
  const [editing, setEditing] = useState<PostSnapshot | null>(null);

  if (isPending) {
    return <p className="text-xs text-muted-foreground">Loading captures…</p>;
  }
  if (!snapshots?.length) {
    return (
      <p className="text-xs text-muted-foreground">No captures logged yet.</p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-1">
        {snapshots.map((snapshot) => (
          <li
            key={snapshot.id}
            className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs"
          >
            <span>
              {snapshot.window_key ? `${snapshot.window_key} · ` : "ad-hoc · "}
              {new Date(snapshot.captured_at).toLocaleString()} ·{" "}
              {snapshot.views ?? "–"} views · {snapshot.likes ?? "–"} likes
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setEditing(snapshot)}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>
      {editing && (
        <EditSnapshotModal
          kind="post"
          postId={postId}
          snapshot={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PostsScreen() {
  const queryClient = useQueryClient();
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: api.listAccounts,
  });
  const { data: posts, isPending } = useQuery({
    queryKey: ["posts"],
    queryFn: () => api.listPosts(),
  });

  const [accountId, setAccountId] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [hook, setHook] = useState("");
  const [contentType, setContentType] = useState<ContentType | "">("");
  const [campaign, setCampaign] = useState("");
  const [tags, setTags] = useState("");
  const [publishedAt, setPublishedAt] = useState(() =>
    toDatetimeLocal(new Date()),
  );
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const createPost = useMutation({
    mutationFn: api.createPost,
    onSuccess: () => {
      setUrl("");
      setDescription("");
      setHook("");
      setContentType("");
      setCampaign("");
      setTags("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accountId || (!url.trim() && !description.trim())) return;
    createPost.mutate({
      account_id: accountId,
      url: url.trim() || null,
      description: description.trim() || null,
      hook: hook.trim() || null,
      content_type: contentType || null,
      campaign: campaign.trim() || null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      published_at: new Date(publishedAt).toISOString(),
    });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <h2 className="text-lg font-medium">Posts</h2>

      <form
        className="flex flex-col gap-3 rounded-lg border p-4"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account">Account</Label>
          <select
            id="account"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="" disabled>
              Select an account
            </option>
            {accounts?.map((account) => (
              <option key={account.id} value={account.id}>
                {account.display_name || account.handle} ({account.platform})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Title / description</Label>
          <Input
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this post is about — shown everywhere instead of the raw link"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://instagram.com/p/..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hook">Hook</Label>
          <Input
            id="hook"
            value={hook}
            onChange={(event) => setHook(event.target.value)}
            placeholder="The opening line/attention-grabber"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content_type">Content type</Label>
            <select
              id="content_type"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={contentType}
              onChange={(event) =>
                setContentType(event.target.value as ContentType | "")
              }
            >
              <option value="">—</option>
              {CONTENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign">Campaign</Label>
            <Input
              id="campaign"
              value={campaign}
              onChange={(event) => setCampaign(event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="launch, ugc, promo"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="published_at">Published at</Label>
          <Input
            id="published_at"
            type="datetime-local"
            value={publishedAt}
            onChange={(event) => setPublishedAt(event.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={createPost.isPending || !accounts?.length}
        >
          Add post
        </Button>
        {!accounts?.length && (
          <p className="text-sm text-muted-foreground">Add an account first.</p>
        )}
      </form>

      <ul className="flex flex-col gap-2">
        {isPending && (
          <li className="text-sm text-muted-foreground">Loading…</li>
        )}
        {posts?.map((post) => (
          <li key={post.id} className="rounded-lg border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {post.description || post.hook || "Untitled post"}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {post.content_type && <Badge>{post.content_type}</Badge>}
                  {post.campaign && <Badge>{post.campaign}</Badge>}
                  {post.tags.map((tag) => (
                    <Badge key={tag}>#{tag}</Badge>
                  ))}
                </div>
                <div className="mt-1 text-muted-foreground">
                  published {new Date(post.published_at).toLocaleString()}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Open <ExternalLink className="size-3.5" />
                  </a>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpanded(expanded === post.id ? null : post.id)
                    }
                  >
                    {expanded === post.id ? "Hide captures" : "Captures"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(post)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </div>
            {expanded === post.id && (
              <div className="mt-3 border-t pt-3">
                <PostSnapshotHistory postId={post.id} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {editing && (
        <EditPostModal post={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
