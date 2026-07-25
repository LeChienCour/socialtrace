import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataScreen() {
  const queryClient = useQueryClient();
  const { data: backups } = useQuery({
    queryKey: ["backups"],
    queryFn: api.listBackups,
  });

  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportJson = useMutation({
    mutationFn: api.exportJson,
    onError: (err) => setError(err.message),
  });
  const exportCsv = useMutation({
    mutationFn: api.exportCsv,
    onError: (err) => setError(err.message),
  });
  const downloadBackup = useMutation({
    mutationFn: api.downloadLatestBackup,
    onError: (err) => setError(err.message),
  });

  const [importResult, setImportResult] = useState<string | null>(null);
  const importCsv = useMutation({
    mutationFn: api.importCsv,
    onSuccess: (result) => {
      setError(null);
      setImportResult(
        `Imported: ${result.accounts} accounts, ${result.posts} posts, ` +
          `${result.account_snapshots} account snapshots, ${result.post_snapshots} post snapshots`,
      );
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err) => {
      setImportResult(null);
      setError(err.message);
    },
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 p-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Export data</h2>
        <p className="text-sm text-muted-foreground">
          Full logical export via the API — every account, post, and snapshot.
          More portable than a raw database dump, and what you actually want to
          open in Excel.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={exportJson.isPending}
            onClick={() => exportJson.mutate()}
          >
            Download JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={exportCsv.isPending}
            onClick={() => exportCsv.mutate()}
          >
            Download CSV
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Import data</h2>
        <p className="text-sm text-muted-foreground">
          Restores exactly what "Download CSV" above produces — a round-trip
          format for migration/restore, not a parser for platform-native export
          layouts.
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importCsv.mutate(file);
            }}
          />
          {importCsv.isPending && (
            <span className="text-sm text-muted-foreground">Importing…</span>
          )}
        </div>
        {importResult && (
          <p className="text-sm text-muted-foreground">{importResult}</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Backups</h2>
        <p className="text-sm text-muted-foreground">
          Daily automated <code>pg_dump</code>, 7 daily / 4 weekly retention.
          Downloads the latest pre-generated dump — never generates one on
          demand.
        </p>
        <Button
          type="button"
          disabled={downloadBackup.isPending || !backups?.length}
          onClick={() => downloadBackup.mutate()}
        >
          Download latest backup
        </Button>
        {backups && backups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No backups yet — the sidecar runs its first dump shortly after
            startup.
          </p>
        )}
        {backups && backups.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {backups.map((backup) => (
              <li key={backup.filename} className="flex justify-between">
                <span>{backup.filename}</span>
                <span>{formatBytes(backup.size_bytes)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
