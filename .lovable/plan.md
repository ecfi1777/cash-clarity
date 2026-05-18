## Problem

"Today" and several date conversions use `new Date().toISOString().split('T')[0]`, which returns the **UTC** date. After ~8pm Eastern, UTC has already rolled to the next day, so:

- Newly created transactions get tomorrow's date
- "Today" markers / cleared-today logic land on the wrong day
- CSV-parsed dates can shift by 1 day depending on how the source string was interpreted
- Recurring generation can produce dates one day ahead

Fix: force all "date-only" stringification to **America/New_York** (Eastern, automatically handles EST/EDT — true year-round Eastern wall-clock time).

## Changes

### 1. `src/lib/format.ts` — add a single source of truth

Add a helper and rewrite `todayStr` to use it:

```ts
// Format a Date as YYYY-MM-DD in America/New_York (Eastern) wall-clock time.
export function toEasternDateStr(d: Date): string {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

export function todayStr(): string {
  return toEasternDateStr(new Date());
}
```

### 2. Replace remaining `toISOString().split('T')[0]` calls

All six locations swap to `toEasternDateStr(d)`:

- `src/pages/Dashboard.tsx:204` — `next_due_date` after generating recurring
- `src/components/GenerateRecurringModal.tsx:58` — recurring cursor dates
- `src/pages/History.tsx:27` — date normalization helper
- `src/pages/History.tsx:174` — CSV export filename
- `src/components/CSVImportModal.tsx:184` — parsed CSV posted_date

### 3. Sanity-pass on other `new Date(...)` usages

`parseDate` in `format.ts` already constructs dates via `new Date(year, month-1, day)` (local-time, no TZ shift) — keep as is. `new Date(yyyy-mm-dd + 'T00:00:00')` patterns (e.g. GenerateRecurringModal:49) are also local-time safe — keep as is.

No DB schema changes. No RLS changes. Pure client-side date-string fix.

## Notes

- This forces Eastern regardless of the user's browser timezone, so behavior is consistent if you ever open the app while traveling.
- Existing rows already saved with a UTC-shifted date are **not** rewritten — only future writes are corrected. If you want, after applying I can run a one-shot SQL check to list any suspiciously off-by-one rows so you can decide whether to adjust them.