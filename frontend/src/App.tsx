import {
  Database,
  FileText,
  LayoutDashboard,
  ListTodo,
  Users,
} from "lucide-react";
import { useState } from "react";
import { AccountsScreen } from "@/components/AccountsScreen";
import { DashboardScreen } from "@/components/DashboardScreen";
import { DataScreen } from "@/components/DataScreen";
import { PostsScreen } from "@/components/PostsScreen";
import { TaskTray } from "@/components/TaskTray";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TokenGate } from "@/components/TokenGate";
import { cn } from "@/lib/utils";

type View = "tasks" | "dashboard" | "accounts" | "posts" | "data";

const TABS: { key: View; label: string; icon: typeof ListTodo }[] = [
  { key: "tasks", label: "Tasks", icon: ListTodo },
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "accounts", label: "Accounts", icon: Users },
  { key: "posts", label: "Posts", icon: FileText },
  { key: "data", label: "Data", icon: Database },
];

function App() {
  const [view, setView] = useState<View>("tasks");

  return (
    <TokenGate>
      <div className="flex min-h-svh bg-background">
        <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4">
          <div className="flex items-center gap-2.5 px-1">
            <div
              className="flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: "var(--gradient-1)" }}
            >
              S
            </div>
            <span className="text-sm font-semibold">socialtrace</span>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  view === tab.key &&
                    "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <ThemeToggle />
        </aside>

        <main className="flex-1 overflow-y-auto">
          {view === "tasks" && <TaskTray />}
          {view === "dashboard" && <DashboardScreen />}
          {view === "accounts" && <AccountsScreen />}
          {view === "posts" && <PostsScreen />}
          {view === "data" && <DataScreen />}
        </main>
      </div>
    </TokenGate>
  );
}

export default App;
