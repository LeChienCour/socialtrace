import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CaptureModal } from "@/components/CaptureModal";
import { api, type TaskItem } from "@/lib/api";
import { cn } from "@/lib/utils";

export function TaskTray() {
  const { data: tasks, isPending } = useQuery({
    queryKey: ["tasks"],
    queryFn: api.listTasks,
  });
  const [selected, setSelected] = useState<TaskItem | null>(null);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <h2 className="text-lg font-medium">Tasks</h2>

      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {tasks?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing due right now. Add accounts and posts to start tracking.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {tasks?.map((task) => {
          // The label falls back to the raw URL when a post has no
          // description — showing it as the headline is exactly the "just
          // a link" confusion this is meant to fix, so lead with the
          // account instead whenever that's the case.
          const hasOwnLabel = !(
            task.type === "post" && task.label.startsWith("http")
          );
          const headline = hasOwnLabel ? task.label : task.account_label;
          const subtitle = hasOwnLabel
            ? `${task.account_label} · ${task.window_key}`
            : task.window_key;

          return (
            <li key={`${task.type}-${task.target_id}-${task.window_key}`}>
              <div
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                  task.status === "overdue" &&
                    "border-destructive/50 bg-destructive/10",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(task)}
                  className="flex min-w-0 flex-1 flex-col items-start text-left hover:opacity-80"
                >
                  <span className="font-medium">{headline}</span>
                  <span className="truncate text-muted-foreground">
                    {subtitle}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-3">
                  {task.url && (
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="text-xs text-primary underline-offset-4 hover:underline"
                    >
                      Open post
                    </a>
                  )}
                  <span
                    className={cn(
                      "text-xs font-medium uppercase",
                      task.status === "overdue"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {task.status}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {selected && (
        <CaptureModal task={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
