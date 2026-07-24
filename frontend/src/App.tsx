import { useState } from "react";
import { AccountsScreen } from "@/components/AccountsScreen";
import { DashboardScreen } from "@/components/DashboardScreen";
import { PostsScreen } from "@/components/PostsScreen";
import { TaskTray } from "@/components/TaskTray";
import { TokenGate } from "@/components/TokenGate";
import { cn } from "@/lib/utils";

type View = "tasks" | "dashboard" | "accounts" | "posts";

const TABS: { key: View; label: string }[] = [
  { key: "tasks", label: "Tasks" },
  { key: "dashboard", label: "Dashboard" },
  { key: "accounts", label: "Accounts" },
  { key: "posts", label: "Posts" },
];

function App() {
  const [view, setView] = useState<View>("tasks");

  return (
    <TokenGate>
      <div className="min-h-svh">
        <header className="border-b">
          <div className="mx-auto flex max-w-3xl items-center gap-1 px-6 py-3">
            <span className="mr-4 text-sm font-medium">socialtrace</span>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                  view === tab.key && "bg-muted font-medium",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {view === "tasks" && <TaskTray />}
        {view === "dashboard" && <DashboardScreen />}
        {view === "accounts" && <AccountsScreen />}
        {view === "posts" && <PostsScreen />}
      </div>
    </TokenGate>
  );
}

export default App;
