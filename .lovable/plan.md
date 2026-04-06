

# Phase 2: Review Workflow, Import History, and Rollback

## Overview

Expand the 4-step CSV wizard to 6 steps with partial match and duplicate review, add import history/detail pages with rollback, and extend `useApplyBatch` to handle adjustments. Each `transaction_adjustment` links to its specific `transaction_match_id`.

---

## 1. `src/hooks/use-import.ts` — Hook Additions

### Extend `useApplyBatch` params
- Add `adjustments` array: `{ batch_id, transaction_match_id, expected_amount_before, bank_amount, accepted_final_amount, adjustment_amount, apply_to_future_template, recurring_template_id }`
- Add `templateUpdates` array: `{ template_id, new_default_amount }`
- Step 3 (match insert): use `.select('id')` to get inserted match IDs
- After match insert: map adjustment records to their match IDs, insert into `transaction_adjustments`
- For each `templateUpdates` entry: update `recurring_templates.default_amount`
- Adjustment change log entries use `action_type: 'adjustment'`

### New: `useRollbackBatch`
Full batch rollback using `batch_change_log` as source of truth:
1. Fetch change log entries where `rollback_state = 'pending'`
2. `status_update` entries → restore `expected_transactions` to `before_state`
3. `insert` entries → delete `expected_transactions` by `entity_id`
4. Delete `transaction_adjustments` for batch
5. Delete `transaction_matches` for batch
6. Update change log: `rollback_state = 'rolled_back'`
7. Update batch: `status = 'rolled_back'`, `rollback_notes`
8. Reset import rows: `applied_at = null`, `review_status = 'pending'`
9. On any error: set `status = 'partial_rollback'`, record reason, re-throw

### New query hooks
- `useImportBatchDetail(batchId)` — single batch
- `useImportBatchRows(batchId)` — rows for batch
- `useImportBatchChangeLog(batchId)` — change log entries
- `useImportBatchMatches(batchId)` — transaction matches for batch

---

## 2. `src/components/CSVImportModal.tsx` — 6-Step Wizard

### Steps: `['Upload', 'Matched', 'Partial matches', 'Unmatched', 'Duplicates', 'Apply']`

### New state
- `partialMatchRows`: rows where `result.status === 'partial_match'`, each with `decision: null | 'accept_bank' | 'accept_expected' | 'reject'` (initially `null`)
- `duplicateRows`: duplicate bank rows with `forceIncluded: boolean` (default `false`) and `bankImportRowId`

### `processCSV` changes
- Split match results: exact matches → `matchedRows`, partial matches → `partialMatchRows`, unmatched → `newRows`
- Store duplicate rows with their `bankImportRowId` instead of discarding them

### Step 2 (Matched Review): same as current, selected by default

### Step 3 (Partial Match Review): NEW
- Show bank amount vs expected amount and difference
- Radio per row: "Accept bank amount" / "Accept expected amount" / "Reject"
- Checkbox: "Update template default" if transaction has `recurring_template_id`
- **Next button disabled until all rows have a decision**
- On advance: rejected rows move to `newRows`

### Step 4 (Unmatched Review): same as current step 2, all selected by default

### Step 5 (Duplicate Review): NEW
- All excluded by default
- "Force include" per row:
  - Updates `bank_import_rows`: `is_duplicate = false`, `review_status = 'unmatched'`
  - Moves row to `newRows` (selected by default)
  - Writes `batch_change_log` entry for the force-include action

### Step 6 (Apply Summary): enhanced
- Shows matched, partial accepted, new, duplicates excluded counts
- Single "Apply" button

### `handleApply` changes
- Partial matches with `accept_bank` or `accept_expected` treated as matched updates
- Build `adjustments` array with `transaction_match_id` placeholder (mapped after match insert inside `useApplyBatch`)
- Build `templateUpdates` for checked "update template" rows
- `counts.partial_match_count` reflects accepted partials

### Adjustment → Match ID linking
- `handleApply` sends adjustments with a temporary `bank_import_row_id` key
- Inside `useApplyBatch`, after inserting matches with `.select('id')`, map each adjustment's `bank_import_row_id` to the corresponding inserted match ID to set `transaction_match_id`

---

## 3. `src/pages/Imports.tsx` — Batch List Page (NEW)

- Table: file name, date, row count, match/partial/unmatched/duplicate counts, status badge
- Status badges: `draft` (grey), `applied` (green), `rolled_back` (red), `partial_rollback` (orange)
- Click row → navigate to `/imports/:batchId`
- Uses `useImportBatches()`

---

## 4. `src/pages/ImportDetail.tsx` — Batch Detail Page (NEW)

- Header: file name, date, status, counts
- Tabs: Matched | Partial | Unmatched | Duplicates | Change Log
- Each tab shows filtered `bank_import_rows` by `review_status`
- Change Log tab: expandable before/after JSON per entry
- "Rollback" button for `applied` batches → confirmation dialog with optional notes → calls `useRollbackBatch`
- On success: toast + navigate to `/imports`

---

## 5. Routing and Navigation

**`src/App.tsx`**: Add routes `/imports` and `/imports/:batchId`

**`src/components/AppNav.tsx`**: Add `{ to: '/imports', label: 'Imports' }` to `navItems`

---

## Files Summary

| File | Action |
|------|--------|
| `src/hooks/use-import.ts` | Modify — extend applyBatch, add rollback + query hooks |
| `src/components/CSVImportModal.tsx` | Modify — 6-step wizard with partial match + duplicate review |
| `src/pages/Imports.tsx` | Create — batch list page |
| `src/pages/ImportDetail.tsx` | Create — batch detail + rollback UI |
| `src/App.tsx` | Modify — add routes |
| `src/components/AppNav.tsx` | Modify — add nav link |

## Implementation Order

1. `use-import.ts` — hooks first (rollback, queries, applyBatch extension)
2. `CSVImportModal.tsx` — 6-step wizard
3. `Imports.tsx` + `ImportDetail.tsx` — new pages
4. `App.tsx` + `AppNav.tsx` — routing

