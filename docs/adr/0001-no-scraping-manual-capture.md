# 1. No scraping — manual capture is the defensible value prop

## Status

Accepted

## Context

Meta, TikTok, and X do not offer affordable, complete APIs for the metrics a
Community Manager actually needs (account reach, per-post decay curves). The
obvious shortcut is scraping the platforms' own analytics dashboards.

Scraping violates every major platform's Terms of Service and breaks on every
DOM change, turning the product into an unpaid, permanent maintenance burden
racing against redesigns we don't control.

## Decision

socialtrace never scrapes. Manual data entry (backed by a fast capture UI)
and legitimate CSV exports from platform-native analytics tools (Instagram,
TikTok, YouTube Studio) are the only ingestion paths in v1. The
`MetricsProvider` protocol leaves room for official APIs later, but the
product must be complete and useful without them.

## Consequences

- The core value is reconstructing the time curve (post decay, account
  growth) from periodic manual snapshots — not automating data collection.
- Capture UX (task tray, fast-capture mode) is a first-class feature, not an
  afterthought, because it's the whole product without automation to fall
  back on.
- No ToS risk, no scraper-maintenance treadmill.
