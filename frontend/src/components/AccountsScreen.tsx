import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EditSnapshotModal } from "@/components/EditSnapshotModal";
import { LogAccountSnapshotModal } from "@/components/LogAccountSnapshotModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type Account,
  type AccountSnapshot,
  api,
  type Platform,
} from "@/lib/api";

function AccountSnapshotHistory({ accountId }: { accountId: string }) {
  const { data: snapshots, isPending } = useQuery({
    queryKey: ["account-snapshots", accountId],
    queryFn: () => api.listAccountSnapshots(accountId),
  });
  const [editing, setEditing] = useState<AccountSnapshot | null>(null);

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
              {new Date(snapshot.captured_at).toLocaleString()} ·{" "}
              {snapshot.followers ?? "–"} followers
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
          kind="account"
          accountId={accountId}
          snapshot={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

const PLATFORMS: Platform[] = [
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "linkedin",
  "youtube",
  "website",
];

export function AccountsScreen() {
  const queryClient = useQueryClient();
  const { data: accounts, isPending } = useQuery({
    queryKey: ["accounts"],
    queryFn: api.listAccounts,
  });

  const [snapshotAccount, setSnapshotAccount] = useState<Account | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [platform, setPlatform] = useState<Platform>("instagram");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createAccount = useMutation({
    mutationFn: api.createAccount,
    onSuccess: () => {
      setHandle("");
      setDisplayName("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!handle.trim()) return;
    createAccount.mutate({
      platform,
      handle: handle.trim(),
      display_name: displayName.trim() || null,
    });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <h2 className="text-lg font-medium">Accounts</h2>

      <form
        className="flex flex-col gap-3 rounded-lg border p-4"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="platform">Platform</Label>
          <select
            id="platform"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={platform}
            onChange={(event) => setPlatform(event.target.value as Platform)}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="handle">Handle</Label>
          <Input
            id="handle"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="acme"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="display_name">Display name (optional)</Label>
          <Input
            id="display_name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Acme Corp"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={createAccount.isPending}>
          Add account
        </Button>
      </form>

      <ul className="flex flex-col gap-2">
        {isPending && (
          <li className="text-sm text-muted-foreground">Loading…</li>
        )}
        {accounts?.map((account) => (
          <li key={account.id} className="rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="font-medium">
                  {account.display_name || account.handle}
                </span>{" "}
                <span className="text-muted-foreground">
                  @{account.handle} · {account.platform}
                </span>
              </span>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setExpanded(expanded === account.id ? null : account.id)
                  }
                >
                  {expanded === account.id ? "Hide captures" : "Captures"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSnapshotAccount(account)}
                >
                  Log snapshot
                </Button>
              </div>
            </div>
            {expanded === account.id && (
              <div className="mt-3 border-t pt-3">
                <AccountSnapshotHistory accountId={account.id} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {snapshotAccount && (
        <LogAccountSnapshotModal
          account={snapshotAccount}
          onClose={() => setSnapshotAccount(null)}
        />
      )}
    </div>
  );
}
