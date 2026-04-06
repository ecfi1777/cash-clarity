

# Fix Duplicate Detection + Cleanup Stale Data

## Change 1: `src/hooks/use-import.ts` (lines 72-87)

Replace `useFetchExistingFingerprints` with a two-step filtered query:

```typescript
export function useFetchExistingFingerprints() {
  return useQuery({
    queryKey: ['existing_fingerprints'],
    queryFn: async () => {
      // Step 1: get IDs of genuinely applied batches
      const { data: batches, error: batchErr } = await supabase
        .from('bank_import_batches' as any)
        .select('id')
        .eq('status', 'applied');
      if (batchErr) throw batchErr;
      const batchIds = ((batches ?? []) as any[]).map((b: any) => b.id);
      if (batchIds.length === 0) return new Set<string>();

      // Step 2: only fingerprints from rows that were genuinely applied
      const { data, error } = await supabase
        .from('bank_import_rows' as any)
        .select('duplicate_fingerprint')
        .in('batch_id', batchIds)
        .eq('is_duplicate', false)
        .eq('selected_for_apply', true)
        .not('applied_at', 'is', null);
      if (error) throw error;

      const fps = new Set<string>();
      for (const row of (data ?? []) as any[]) {
        fps.add(row.duplicate_fingerprint);
      }
      return fps;
    },
  });
}
```

Four-way filter: `batch.status='applied'` + `is_duplicate=false` + `selected_for_apply=true` + `applied_at IS NOT NULL`.

## Change 2: Database cleanup

Delete stale data for the two broken batches using the data insert tool:

```sql
DELETE FROM batch_change_log WHERE batch_id IN (
  '340e6a48-c8ed-4b25-8a3e-1f3389e5c69d',
  'e342a9bd-9b77-4cd1-8db7-30c389ffaf15'
);
DELETE FROM bank_import_rows WHERE batch_id IN (
  '340e6a48-c8ed-4b25-8a3e-1f3389e5c69d',
  'e342a9bd-9b77-4cd1-8db7-30c389ffaf15'
);
DELETE FROM bank_import_batches WHERE id IN (
  '340e6a48-c8ed-4b25-8a3e-1f3389e5c69d',
  'e342a9bd-9b77-4cd1-8db7-30c389ffaf15'
);
```

## Change 3: Verification

After fix + cleanup, re-import the CSV and run diagnostic queries to confirm:
- Rows are not flagged as duplicates
- `expected_transactions` contains `source = 'import_unmatched'` rows
- 3 deposits have `direction = 'dep'`, positive `expected_amount`, `status = 'cleared_manual'`, non-null `source_batch_id`

## Scope

| File | Change |
|------|--------|
| `src/hooks/use-import.ts` | Replace lines 72-87 with four-way filtered fingerprint query |
| Database (data cleanup) | Delete 2 stale batches + 64 bank_import_rows + change_log entries |

No other files modified.

