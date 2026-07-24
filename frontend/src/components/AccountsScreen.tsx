import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Platform } from "@/lib/api";

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
            <span className="font-medium">
              {account.display_name || account.handle}
            </span>{" "}
            <span className="text-muted-foreground">
              @{account.handle} · {account.platform}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
