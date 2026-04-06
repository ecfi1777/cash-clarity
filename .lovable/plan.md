

# Add CSV Export to History Page

## File: `src/pages/History.tsx`

### 1. Add helper functions (before the component, ~line 10)

**`toCSVValue`** — normalizes any value to string:
```typescript
function toCSVValue(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value);
}
```

**`escapeCSV`** — wraps fields with commas/quotes/newlines:
```typescript
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

**`formatExportDate`** — consistent ISO date:
```typescript
function formatExportDate(d: string | null): string {
  if (!d) return '';
  try { return new Date(d).toISOString().split('T')[0]; }
  catch { return d; }
}
```

**`getSource`** — human-readable source:
```typescript
function getSource(tx: ExpectedTransaction): string {
  if (tx.source === 'import_unmatched') return 'CSV';
  if (tx.recurring_template_id) return 'Recurring';
  return tx.source ?? '';
}
```

### 2. Add `handleExport` function inside the component (~after `handleSaveSecondary`)

- Headers: `['Transaction ID', 'Date', 'Primary Description', 'Secondary Description', 'Signed Amount', 'Direction', 'Type', 'Status', 'Source', 'Cleared At', 'Source Batch ID']`
- Row mapping for each `tx` in `filtered`:
  - ID: `tx.id`
  - Date: `formatExportDate(tx.scheduled_date)`
  - Primary Description: `tx.name`
  - Secondary Description: `tx.secondary_description`
  - Signed Amount: `tx.direction === 'pmt' ? -Math.abs(tx.expected_amount) : Math.abs(tx.expected_amount)`
  - Direction: `tx.direction === 'pmt' ? 'payment' : 'deposit'`
  - Type, Status: as-is
  - Source: `getSource(tx)`
  - Cleared At: `formatExportDate(tx.cleared_at)`
  - Source Batch ID: `tx.source_batch_id`
- All values go through `escapeCSV(toCSVValue(...))`
- Prepend BOM (`'\uFEFF'`) for Excel compatibility
- Create Blob, trigger download via temporary `<a>` element
- Filename: `history-export-YYYY-MM-DD.csv`

### 3. Add Export CSV button (around line 160, next to the summary text)

Wrap the existing summary `<p>` in a flex row with the button:

```tsx
<div className="flex items-center justify-between">
  <p className="text-sm text-muted-foreground">
    {filtered.length} {filterLabel} · ...
  </p>
  <Button size="sm" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
    Export CSV
  </Button>
</div>
```

Button is disabled when zero rows are showing.

### Import additions

Add `ExpectedTransaction` import from `@/hooks/use-data` (already importing hooks from there).

## Scope

Only `src/pages/History.tsx` is modified.

## Summary

| Detail | Value |
|--------|-------|
| Export source | `filtered` array (all active filters applied) |
| Columns | 11 columns in specified order |
| Signed amount | Explicit: `-Math.abs()` for pmt, `+Math.abs()` for dep |
| Date format | ISO `YYYY-MM-DD` |
| Null handling | `toCSVValue` converts to empty string |
| Source mapping | `CSV` / `Recurring` / raw value |
| Excel compat | BOM prepended |
| Zero rows | Button disabled |

