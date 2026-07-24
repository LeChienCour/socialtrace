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
        {tasks?.map((task) => (
          <li key={`${task.type}-${task.target_id}-${task.window_key}`}>
            <button
              type="button"
              onClick={() => setSelected(task)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted",
                task.status === "overdue" &&
                  "border-destructive/50 bg-destructive/10",
              )}
            >
              <span>
                <span className="font-medium">{task.label}</span>{" "}
                <span className="text-muted-foreground">
                  {task.type === "account" ? "account · " : ""}
                  {task.window_key}
                </span>
              </span>
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
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <CaptureModal task={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
