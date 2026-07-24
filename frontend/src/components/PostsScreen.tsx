import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

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
  const [publishedAt, setPublishedAt] = useState(() =>
    toDatetimeLocal(new Date()),
  );
  const [error, setError] = useState<string | null>(null);

  const createPost = useMutation({
    mutationFn: api.createPost,
    onSuccess: () => {
      setUrl("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accountId || !url.trim()) return;
    createPost.mutate({
      account_id: accountId,
      url: url.trim(),
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
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://instagram.com/p/..."
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
            <span className="font-medium">{post.description || post.url}</span>
            <div className="text-muted-foreground">
              published {new Date(post.published_at).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
