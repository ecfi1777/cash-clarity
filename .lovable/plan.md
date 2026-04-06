

# Fix Import Persistence Error Handling + editedDescription Bug

## Changes to `src/components/CSVImportModal.tsx`

### 1. Batch/row persistence failure — add error toast + early return (lines 263-265)

Replace:
```typescript
} catch (err) {
  console.error('Failed to persist import batch:', err);
}
```
With:
```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('Failed to persist import batch:', msg, err);
  toast.error(`Failed to create import batch: ${msg}`);
  return;
}
```

The `return` stops `processCSV` from proceeding to build matched/partial/unmatched state when nothing was saved. The modal stays open on the Upload step.

### 2. Apply failure — add error toast (lines 464-465)

Replace:
```typescript
} catch (err) {
  console.error('Failed to apply batch:', err);
}
```
With:
```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('Failed to apply batch:', msg, err);
  toast.error(`Failed to apply import: ${msg}`);
}
```

Modal already stays open on failure (the `onOpenChange(false)` on line 463 is skipped when the `await` throws).

### 3. editedDescription bug (line 390)

Change:
```typescript
name: r.description,
```
To:
```typescript
name: r.editedDescription || r.description,
```

## Verification after implementation

Run diagnostic queries to confirm:
- `bank_import_batches` is populated
- `bank_import_rows` is populated
- `transaction_matches` is populated
- `batch_change_log` is populated
- `expected_transactions` contains rows with `source = 'import_unmatched'`
- Deposit rows have `direction = 'dep'`, positive `expected_amount`, `status = 'cleared_manual'`, non-null `source_batch_id`

## Technical details

- `toast` from `sonner` is already imported (line 31)
- Three surgical edits in one file only
- Error messages include the actual error string to distinguish batch creation vs row insertion vs apply failures
- Console log retains the full error object for stack trace debugging

