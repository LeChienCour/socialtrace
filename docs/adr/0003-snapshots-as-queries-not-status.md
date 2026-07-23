# 3. Capture status is a query, never a stored column

## Status

Accepted

## Context

Every version of this kind of tool is tempted to add a `status` column
(`pending`/`captured`/`overdue`) to `posts` or `accounts` for a fast, simple
read in the UI. That column inevitably drifts from reality: a snapshot gets
inserted directly via SQL, a backfill import runs, a cron job fails silently
— and the cached status column now lies. This is exactly the "yellow
indicator" failure mode of the throwaway prototype this project replaces.

Capture windows (`h24`, `d7`, `d30` for posts; a configurable cadence for
accounts) are relative to `published_at` / cadence config and a grace
period — they are inherently a function of "now," not a fact that can be
frozen into a row.

## Decision

There is no `status` column anywhere in the schema. "Pending" / "due" /
"overdue" / "captured" / "missed" are always computed by a query joining
`posts`/`accounts` against their snapshots and the window configuration, at
read time. The `/api/tasks` endpoint is this query, exposed as an endpoint,
not a table.

## Consequences

- Inserting a snapshot via any path (manual capture, CSV import, future API
  provider) automatically and correctly changes what the task tray shows —
  there is no second place to update.
- The query is slightly more expensive than a column read, but the dataset
  size for a single-tenant CM tool never justifies denormalizing this.
- Future contributors will be tempted to "just cache it" for performance;
  don't, without first proving the query is actually a bottleneck — the
  correctness guarantee is the point of this ADR.
