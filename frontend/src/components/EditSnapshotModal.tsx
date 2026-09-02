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
import { type AccountSnapshot, api, type PostSnapshot } from "@/lib/api";

const POST_FIELDS = [
  "views",
  "reach",
  "impressions",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "watch_time_sec",
] as const;

const ACCOUNT_FIELDS = [
  "followers",
  "following",
  "posts_count",
  "reach",
  "impressions",
  "profile_visits",
  "link_clicks",
] as const;

type Props =
  | {
      kind: "post";
      postId: string;
      snapshot: PostSnapshot;
      onClose: () => void;
    }
  | {
      kind: "account";
      accountId: string;
      snapshot: AccountSnapshot;
      onClose: () => void;
    };

export function EditSnapshotModal(props: Props) {
  const queryClient = useQueryClient();
  const fields = props.kind === "post" ? POST_FIELDS : ACCOUNT_FIELDS;
  const snapshot = props.snapshot as unknown as Record<string, unknown>;

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      const raw = snapshot[field];
      if (typeof raw === "number") initial[field] = String(raw);
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    if (props.kind === "post") {
      queryClient.invalidateQueries({
        queryKey: ["post-snapshots", props.postId],
      });
    } else {
      queryClient.invalidateQueries({
        queryKey: ["account-snapshots", props.accountId],
      });
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, number | null> = {};
      for (const field of fields) {
        const raw = values[field];
        payload[field] =
          raw !== undefined && raw.trim() !== "" ? Number(raw) : null;
      }
      if (props.kind === "post") {
        return api.updatePostSnapshot(props.postId, props.snapshot.id, payload);
      }
      return api.updateAccountSnapshot(
        props.accountId,
        props.snapshot.id,
        payload,
      );
    },
    onSuccess: () => {
      invalidate();
      props.onClose();
    },
    onError: (err) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (props.kind === "post") {
        return api.deletePostSnapshot(props.postId, props.snapshot.id);
      }
      return api.deleteAccountSnapshot(props.accountId, props.snapshot.id);
    },
    onSuccess: () => {
      invalidate();
      props.onClose();
    },
    onError: (err) => setError(err.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit capture —{" "}
            {new Date(props.snapshot.captured_at).toLocaleString()}
          </DialogTitle>
        </DialogHeader>

        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          {fields.map((field) => (
            <div key={field} className="flex flex-col gap-1.5">
              <Label htmlFor={field}>{field.replace(/_/g, " ")}</Label>
              <Input
                id={field}
                type="number"
                value={values[field] ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    [field]: event.target.value,
                  }))
                }
              />
            </div>
          ))}

          {error && (
            <p className="col-span-2 text-sm text-destructive">{error}</p>
          )}

          <DialogFooter className="col-span-2 flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm("Delete this capture? This can't be undone.")) {
                  remove.mutate();
                }
              }}
            >
              Delete
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
