

# Add `source` Column and Unmatched Imports Filter

## What you'll get
- CSV-imported items that didn't match existing transactions get tagged automatically
- A new "Unmatched Imports" tab on the Dashboard to view only those items
- A small "CSV" badge on unmatched items when viewing "All"

## Technical Steps

### 1. Database migration
Add a `source` text column to `transactions` with default `'manual'`:
```sql
ALTER TABLE public.transactions ADD COLUMN source text NOT NULL DEFAULT 'manual';
```

### 2. Update `src/hooks/use-data.ts`
- Add `source: string` to the `Transaction` type
- Add `source?: string` to the bulk insert mutation type

### 3. Update `src/components/CSVImportModal.tsx`
- Add `source: 'csv_unmatched'` to newItems in the `onApply` data type and pass it through for each new row

### 4. Update `src/pages/Dashboard.tsx`
- Accept `source` in `handleCSVApply` and pass it through to `bulkInsert`
- Add a tab bar ("All" | "Unmatched Imports") with state
- Filter `outstanding` and `pending` lists based on selected tab

### 5. Update `src/components/TransactionTable.tsx`
- Show a small `<Badge variant="info">CSV</Badge>` next to the name when `source === 'csv_unmatched'`

### Files modified
- New migration (1 file)
- `src/hooks/use-data.ts`
- `src/components/CSVImportModal.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/TransactionTable.tsx`

