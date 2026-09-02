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
import { api, type TaskItem } from "@/lib/api";

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

export function CaptureModal({
  task,
  onClose,
}: {
  task: TaskItem;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const fields = task.type === "post" ? POST_FIELDS : ACCOUNT_FIELDS;

  const capture = useMutation({
    mutationFn: async () => {
      const payload: Record<string, number> = {};
      for (const field of fields) {
        const raw = values[field];
        if (raw !== undefined && raw.trim() !== "") {
          payload[field] = Number(raw);
        }
      }
      if (task.type === "post") {
        return api.createPostSnapshot(task.target_id, {
          window_key: task.window_key as "h24" | "d7" | "d30",
          ...payload,
        });
      }
      return api.createAccountSnapshot(task.target_id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Capture {task.window_key} — {task.account_label}
          </DialogTitle>
          {task.type === "post" && (
            <p className="text-sm text-muted-foreground">
              {task.label}
              {task.url && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={task.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    open post
                  </a>
                </>
              )}
            </p>
          )}
        </DialogHeader>

        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            capture.mutate();
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

          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={capture.isPending}>
              Save capture
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
