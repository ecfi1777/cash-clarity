

# Phase 1 Implementation Plan

## Step 1: Database Migration

Single SQL migration with strict ordering:

**1a. Create 9 new tables** (vendors, vendor_aliases, recurring_templates, expected_transactions, bank_import_batches, bank_import_rows, transaction_matches, transaction_adjustments, batch_change_log) — all with `user_id uuid not null default auth.uid()`, timestamps, and `updated_at` triggers.

**1b. Migrate data:**
- `templates` → `recurring_templates` (preserving IDs, `amount` → `default_amount`)
- `transactions` → `expected_transactions` (preserving IDs, field mapping: `amount` → `expected_amount`, `date` → `scheduled_date`, `cleared` → status, `template_id` → `recurring_template_id`, `source_batch_id = NULL` for all migrated rows)
- Status mapping: `cleared=true` → `'cleared_manual'`, `cleared=false` → `'outstanding'`
- Source mapping: `'csv_unmatched'` → `'import_unmatched'`, `is_recurring=true` → `'recurring_generated'`, else `'manual'`

**1c. Validate:** Assert row counts match between old and new tables. Migration fails if mismatch.

**1d. Rename last:** `transactions` → `legacy_transactions`, `templates` → `legacy_templates`

**1e. RLS:** Owner-scoped SELECT/INSERT/UPDATE/DELETE on all 9 tables.

**1f. Indexes:** On expected_transactions(user_id, status, direction), bank_import_rows(batch_id), bank_import_rows(duplicate_fingerprint), transaction_matches (partial unique indexes for one-to-one enforcement), vendor_aliases(user_id, normalized_alias).

Note: `transactions` currently has a FK from `template_id` → `templates.id`. The migration must handle dropping this before rename, and the new `expected_transactions.recurring_template_id` will FK to `recurring_templates.id`.

---

## Step 2: Matching Engine — new `src/lib/matching.ts`

Pure functions:
- `normalizeDescription(raw)` — lowercase, collapse whitespace, strip noise
- `extractCheckNumber(desc)` — regex for CHECK/CK/CHK patterns
- `buildDuplicateFingerprint(date, amount, normalizedDesc, checkNumber?)` — deterministic concat
- `findMatches(bankRows, outstandingExpected, vendorAliases)` — scoring: exact amount +50, alias/description +30, date ±3 days +20. One best candidate only. Ties within 5 points → unmatched. One-to-one enforced.
- `detectDuplicates(fingerprints, existingSet)` — returns duplicate flags

---

## Step 3: Refactor `src/hooks/use-data.ts`

Export new types `ExpectedTransaction` and `RecurringTemplate`. Replace all hooks:
- `useTransactions()` → `useExpectedTransactions()` (queries `expected_transactions`)
- `useTemplates()` → `useRecurringTemplates()` (queries `recurring_templates`)
- All mutation hooks remapped to new table/field names
- `useBankBalance` / `useUpdateBankBalance` — unchanged
- Field mapping throughout: `amount`→`expected_amount`, `date`→`scheduled_date`, `cleared`→status check, `cleared_date`→`cleared_at`, `template_id`→`recurring_template_id`

---

## Step 4: New `src/hooks/use-import.ts`

- `useCreateImportBatch()` — insert into `bank_import_batches`
- `useInsertImportRows()` — bulk insert into `bank_import_rows` with all review state fields populated (is_duplicate, suggested_match_id, suggested_match_confidence, suggested_amount_difference, review_status)
- `useApplyBatch()` — composite mutation: update matched expected_transactions status, insert unmatched as new expected_transactions (source='import_unmatched', status='cleared_manual'), save transaction_matches, write batch_change_log entries (with before_state/after_state for rollback), update batch status/counts
- `useFetchExistingFingerprints()` — query existing bank_import_rows fingerprints from applied batches

---

## Step 5: Refactor `src/components/CSVImportModal.tsx`

Keep 4-step UI (Upload, Review matches, Review new, Apply). Internal changes:
- On parse: create draft batch in DB, insert bank_import_rows, fetch existing fingerprints for duplicate detection, use matching engine from `matching.ts`
- Duplicates detected and excluded (non-applicable in Phase 1)
- On Apply: call `useApplyBatch()` to persist everything
- Props updated: `transactions` → `expectedTransactions`, `onApply` callback signature updated for new schema

---

## Step 6: Update page components

All field remapping, no new UI features:

**Dashboard.tsx** — swap all hook imports, `Transaction` → `ExpectedTransaction`, `amount` → `expected_amount`, `date` → `scheduled_date`, `cleared` → status check, `template_id` → `recurring_template_id`. Generate recurring writes to `recurring_templates`. The `supabase.from('templates')` call in `handleGenerateApply` → `supabase.from('recurring_templates')` with `default_amount` field.

**History.tsx** — swap hooks, field remapping, status badges use `status` field.

**Recurring.tsx** — `useTemplates()` → `useRecurringTemplates()`, `amount` → `default_amount`.

**TransactionTable.tsx** — type update, `tx.amount` → `tx.expected_amount`, `tx.date` → `tx.scheduled_date`, `tx.cleared` → status check, `tx.is_recurring` → source check.

**TransactionModal.tsx** — field remapping in `initial` prop.

**GenerateRecurringModal.tsx** — `Template` → `RecurringTemplate`, `t.amount` → `t.default_amount`.

**RecurringModal.tsx** — no changes needed (already uses generic field names in its form).

---

## Files

**New:** `src/lib/matching.ts`, `src/hooks/use-import.ts`

**Modified:** `src/hooks/use-data.ts`, `src/components/CSVImportModal.tsx`, `src/pages/Dashboard.tsx`, `src/pages/History.tsx`, `src/pages/Recurring.tsx`, `src/components/TransactionTable.tsx`, `src/components/TransactionModal.tsx`, `src/components/GenerateRecurringModal.tsx`

**Not modified:** `src/App.tsx`, `src/components/AppNav.tsx`, `src/components/RecurringModal.tsx` (no changes needed)

