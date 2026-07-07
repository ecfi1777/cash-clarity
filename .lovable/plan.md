## Show written vs cleared dates on matched/partial rows

Instead of a "3 days off" delta badge, display both dates explicitly so it's obvious what's being compared.

### Changes (src/components/CSVImportModal.tsx)

**Matched step (Step 1):**
- Replace the current subline `{transactionName} · {transactionDate}` / `← {description} · {date}` with a clearer two-line layout:
  - Line 1: `{transactionName}` · `written {transactionDate}`
  - Line 2: `← {description}` · `cleared {date}`
- `confidenceBadge` simplified:
  - exact date → keep green `same day` badge
  - close date → neutral badge `+{days}d to clear` (no more "days off")
  - amount only → keep `amt only`

**Partial matches step (Step 2):**
- Add `written {transactionDate}` next to the transaction name.
- Keep `← {description} · cleared {date}` on the second line.

**Legend (bottom of Matched step):**
- Update the three legend chips to match new labels: `same day`, `cleared later`, `amount only`.

### Out of scope
- No changes to matching logic, scoring, or data — just labels/formatting.
- No schema changes.
