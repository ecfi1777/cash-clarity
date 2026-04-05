

# History as Full Ledger with Quick Filters

## Concept
History becomes a **complete ledger of all transactions** — cleared or not, payments and deposits alike. Two quick-filter toggles let the user narrow down to deposits-only or unmatched-imports-only for verification.

## Changes — `src/pages/History.tsx`

### 1. Show all transactions
- Remove `.filter(t => t.cleared)` — every transaction appears
- Remove `opacity-35` from rows so everything is readable

### 2. Add quick-filter buttons
Simple toggle buttons (or tabs) above the table:
- **All** (default) — full ledger
- **Deposits** — filters to `direction === 'dep'`
- **Unmatched Imports** — filters to `source === 'csv_unmatched'`

### 3. Update summary line
Dynamically reflect the active filter — show count, total out, total in for whichever subset is displayed.

### 4. Show source badge
For any row with `source === 'csv_unmatched'`, display a small yellow "CSV" badge next to the description so the user can spot imported items even in the "All" view.

## Also fix — `src/components/CSVImportModal.tsx`

### Default unmatched rows to selected
Change `selected: false` → `selected: true` when initializing unmatched import rows, so deposits and other new items are actually saved when the user clicks Apply.

## Files
- `src/pages/History.tsx`
- `src/components/CSVImportModal.tsx`

No database changes needed.

