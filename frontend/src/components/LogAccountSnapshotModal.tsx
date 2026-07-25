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
import { type Account, api } from "@/lib/api";

const ACCOUNT_FIELDS = [
  "followers",
  "following",
  "posts_count",
  "reach",
  "impressions",
  "profile_visits",
  "link_clicks",
] as const;

export function LogAccountSnapshotModal({
  account,
  onClose,
}: {
  account: Account;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [capturedDate, setCapturedDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);

  const capture = useMutation({
    mutationFn: async () => {
      const payload: Record<string, number> = {};
      for (const field of ACCOUNT_FIELDS) {
        const raw = values[field];
        if (raw !== undefined && raw.trim() !== "") {
          payload[field] = Number(raw);
        }
      }
      return api.createAccountSnapshot(account.id, {
        captured_at: `${capturedDate}T12:00:00.000Z`,
        ...payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Log snapshot — {account.display_name || account.handle}
          </DialogTitle>
        </DialogHeader>

        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            capture.mutate();
          }}
        >
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="captured_at">Captured on</Label>
            <Input
              id="captured_at"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={capturedDate}
              onChange={(event) => setCapturedDate(event.target.value)}
            />
          </div>

          {ACCOUNT_FIELDS.map((field) => (
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
              Save snapshot
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
