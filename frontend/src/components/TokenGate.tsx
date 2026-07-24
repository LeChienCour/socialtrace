import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredToken, setStoredToken } from "@/lib/token";

export function TokenGate({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [draft, setDraft] = useState("");

  if (token) {
    return <>{children}</>;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setStoredToken(trimmed);
    setToken(trimmed);
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-medium">socialtrace</h1>
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Paste the API token to continue. Find it in the backend logs (
        <code>podman compose logs backend</code>) or in your{" "}
        <code>SOCIALTRACE_API_TOKEN</code> if you set one.
      </p>
      <form className="flex w-full max-w-sm gap-2" onSubmit={handleSubmit}>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="API token"
          autoFocus
        />
        <Button type="submit">Save</Button>
      </form>
    </div>
  );
}
