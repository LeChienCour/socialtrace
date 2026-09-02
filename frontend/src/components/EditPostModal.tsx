import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type ContentType, type Post } from "@/lib/api";

const CONTENT_TYPES: ContentType[] = [
  "reel",
  "story",
  "carousel",
  "video",
  "image",
  "text",
  "short",
];

function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EditPostModal({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(post.url ?? "");
  const [description, setDescription] = useState(post.description ?? "");
  const [hook, setHook] = useState(post.hook ?? "");
  const [contentType, setContentType] = useState<ContentType | "">(
    (post.content_type as ContentType | null) ?? "",
  );
  const [campaign, setCampaign] = useState(post.campaign ?? "");
  const [tags, setTags] = useState(post.tags.join(", "));
  const [publishedAt, setPublishedAt] = useState(() =>
    toDatetimeLocal(post.published_at),
  );
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: () =>
      api.updatePost(post.id, {
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
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: () => api.deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-description">Title / description</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-url">URL</Label>
            <Input
              id="edit-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-hook">Hook</Label>
            <Input
              id="edit-hook"
              value={hook}
              onChange={(event) => setHook(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-content_type">Content type</Label>
              <select
                id="edit-content_type"
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
              <Label htmlFor="edit-campaign">Campaign</Label>
              <Input
                id="edit-campaign"
                value={campaign}
                onChange={(event) => setCampaign(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
            <Input
              id="edit-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-published_at">Published at</Label>
            <Input
              id="edit-published_at"
              type="datetime-local"
              value={publishedAt}
              onChange={(event) => setPublishedAt(event.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="justify-between sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (
                  window.confirm("Delete this post? This cannot be undone.")
                ) {
                  remove.mutate();
                }
              }}
            >
              Delete
            </Button>
            <Button type="submit" disabled={update.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
