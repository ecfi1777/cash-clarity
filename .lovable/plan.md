

# Fix ImportDetail Tab Classification and Add Apply Success Toast

## Problem
1. `ImportDetail.tsx` lines 71-74 classify rows using heuristic field checks (`suggested_match_confidence`, `suggested_amount_difference`, `suggested_match_id`) instead of persisted match/adjustment data.
2. No success toast after apply completes in `CSVImportModal.tsx` (line 461 just closes the dialog silently).

## Changes

### 1. `src/pages/ImportDetail.tsx` — Tab classification using persisted data

Replace the current heuristic filtering (lines 71-74) with a join-based approach:

- Import `useImportBatchMatches` (already exported from `use-import.ts`)
- Query `transaction_matches` for the batch to get the set of `bank_import_row_id` values and their `amount_difference`
- Query `transaction_adjustments` for the batch (add a new simple query hook or inline query) to identify partial match rows

**Tab classification logic:**
- **Matched tab**: rows whose `id` appears in `transaction_matches` AND do NOT have a corresponding `transaction_adjustments` entry
- **Partial tab**: rows whose `id` appears in `transaction_matches` AND have a corresponding `transaction_adjustments` entry
- **Unmatched tab**: rows with `review_status = 'applied'` whose `id` does NOT appear in `transaction_matches` (these are the inserted new transactions)
- **Duplicates tab**: rows where `is_duplicate = true` (unchanged — this is persisted data, not a heuristic)

### 2. `src/hooks/use-import.ts` — Add `useImportBatchAdjustments` query

New query hook fetching `transaction_adjustments` for a batch, returning `{ id, batch_id, transaction_match_id, bank_import_row_id }` (need to join through matches to get `bank_import_row_id`, or just return `transaction_match_id` and cross-reference with matches data already fetched).

Simpler approach: fetch adjustments by `batch_id`, each has `transaction_match_id`. Cross-reference with the matches query (which has `bank_import_row_id`) to determine which rows are partial.

### 3. `src/components/CSVImportModal.tsx` — Add success toast

After line 460 (successful `applyBatch.mutateAsync`), add:
```typescript
toast.success('Import applied successfully');
```
The `toast` import from `sonner` is already present in `CSVImportModal.tsx` (used elsewhere — need to verify, otherwise add import).

Actually, checking the imports at line 1-30: `toast` from `sonner` is not imported in CSVImportModal. Will add `import { toast } from 'sonner';`.

## Files Modified
- `src/pages/ImportDetail.tsx` — use `useImportBatchMatches` + new adjustments query for tab classification
- `src/hooks/use-import.ts` — add `useImportBatchAdjustments` query hook
- `src/components/CSVImportModal.tsx` — add sonner import + success toast after apply

