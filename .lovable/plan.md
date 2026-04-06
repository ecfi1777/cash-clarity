

# Wire CSVImportModal Apply to useApplyBatch

## Problem
`CSVImportModal.handleApply` (line 351) builds a legacy payload and calls `onApply` → `Dashboard.handleCSVApply` (line 180), which directly calls `bulkUpdate`/`bulkInsert`. This bypasses `useApplyBatch`, so `transaction_matches`, `batch_change_log`, and batch status updates are never written.

## Changes

### 1. `src/hooks/use-import.ts` — useInsertImportRows returns IDs

Line 114: change `.insert(rows as any)` to `.insert(rows as any).select('id')` and return the data array. This gives stable-order row IDs for match mapping.

Also enhance `useApplyBatch` step 2 (new transaction inserts) to use `.select('id')` and return inserted IDs, then append additional `batch_change_log` entries for each inserted row with `action_type: 'insert'` and `after_state` containing the new entity.

Add a batch-level change log entry for the status update (`entity_type: 'batch'`).

### 2. `src/components/CSVImportModal.tsx`

**State additions:**
- `batchId: string | null` — set during `processCSV`
- `importRowIds: string[]` — set from `insertRows` response (stable order matching `bankRows`)
- `matchResultsRef` — store match results from `findMatches` so they're available at apply time

**processCSV changes:**
- After `insertRows.mutateAsync(importRows)`, capture returned IDs into `importRowIds` state
- Store `batchId` from batch creation
- Store match results for later use

**Import `useApplyBatch`** from `use-import.ts`

**Rewrite `handleApply` (lines 351-367):**
Build payload and call `applyBatch.mutateAsync()`:

- `matchedUpdates`: for each selected matched row, find the actual transaction from `transactions` prop and use its real current state as `before_state` (not assumed `'outstanding'`)
- `newTransactions`: selected unmatched rows → `{ name, expected_amount, direction, type, scheduled_date, status: 'cleared_manual', cleared_at, source: 'import_unmatched', source_batch_id: batchId }`
- `matchRecords`: one per selected matched row → `{ batch_id, bank_import_row_id (from importRowIds), expected_transaction_id, match_status: 'confirmed', match_confidence, days_difference, amount_difference }`
- `changeLog`: 
  - Per matched update: `{ batch_id, entity_type: 'expected_transaction', entity_id, action_type: 'status_update', before_state: { status: tx.status, cleared_at: tx.cleared_at, ... actual fields }, after_state: { status: 'matched', cleared_at: row.date } }`
  - Insert change logs are written inside `useApplyBatch` after getting inserted IDs
  - Batch status change log written inside `useApplyBatch`
- `counts`: `{ matched_count: selectedMatchCount, partial_match_count: 0, unmatched_count: selectedNewCount, duplicate_count }`
- On success: `onOpenChange(false)`

**Remove `onApply` from Props type** (line 45-53). The modal handles apply internally and closes itself.

**Map importRowIds to matchRecords:** The `importRowIds` array corresponds to all `bankRows` (including duplicates). Each matched row traces back to a non-duplicate bank row index, which maps to an `importRowIds` entry. Store a `bankRowIndexMap` during processCSV to make this deterministic.

### 3. `src/pages/Dashboard.tsx`

- Remove `handleCSVApply` function (lines 180-204)
- Remove `onApply={handleCSVApply}` from `<CSVImportModal>` (line 358)
- Keep `bulkInsert`/`bulkUpdate` imports (still used by `handleGenerateApply` and `handleToggleCleared`)

## Files Modified
- `src/hooks/use-import.ts`
- `src/components/CSVImportModal.tsx`
- `src/pages/Dashboard.tsx`

