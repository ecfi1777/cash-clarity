# Batch add payments

Add a new way to enter multiple payments in one sitting without the modal closing after each save. The existing single-entry "Add payment" / "Add deposit" buttons stay exactly as they are — this is an additive feature.

## What you'll see

On the Dashboard, next to the existing **Add payment** and **Add deposit** buttons, a new button: **Add multiple**.

Clicking it opens a wider modal titled **Add multiple payments** containing:

- A table with these columns: Description, Amount, Date, Type, Check / Ref #, and a row-remove (×) button.
- Direction toggle at the top: **Payments** (default) / **Deposits**. All rows in one batch share the same direction (keeps the table simple — to mix, run it twice).
- Starts with 5 empty rows. **+ Add row** button at the bottom adds another. No hard cap (soft guidance text if >50).
- Each row's Date defaults to today; Type defaults to Check. Editing one row never touches the others.
- Live footer summary: "**N valid rows · Total $X.XX**". Invalid/empty rows are ignored in the count and total.
- Footer buttons: **Cancel** and **Add all (N)** — the count updates with valid rows. Disabled when N = 0.

## What counts as a valid row

A row is saved only if it has: non-empty description, amount > 0, and a date. Empty rows are silently skipped (so you can leave the last few blank). Rows with partial data (e.g. amount but no description) are flagged with a small red border on the offending field and block submit.

## Save behavior

- Clicking **Add all** inserts every valid row in a single batch using the existing bulk-insert path (same one already used by the "Generate recurring" flow), so it's one mutation, one toast, one refetch.
- All rows are created as `status: outstanding`, `source: manual`, with the chosen direction.
- On success: modal closes, toast shows "Added N payments" (or deposits), Dashboard refreshes.
- On failure: modal stays open with the rows intact so nothing is lost.

## Where the button goes

Dashboard header action bar, immediately after the existing two buttons:

```text
[ + Add payment ] [ + Add deposit ] [ + Add multiple ]
```

On narrow screens the row wraps as it already does.

## Technical details

- **New file:** `src/components/BatchTransactionModal.tsx` — Dialog with a table of editable rows held in local state (`Array<{description, amount, date, type, checkNumber}>`), direction toggle, row add/remove, validation, footer total, submit handler.
- **Dashboard wiring (`src/pages/Dashboard.tsx`):**
  - New state: `const [batchOpen, setBatchOpen] = useState(false);`
  - New button in the header bar opens it.
  - Reuses the existing `bulkInsert` mutation (already imported and used for `handleGenerateApply`) — pass it the array of `{ name, expected_amount, direction, type, scheduled_date, status: 'outstanding', source: 'manual', check_number }`.
- **Styling:** Flat aesthetic per project rules — white card, 1px borders, no gradients/shadows. Amount inputs right-aligned, min-width 90px. Mobile: table gets horizontal scroll wrapper (same pattern as other tables in the app).
- **No DB / schema / RLS changes.** No new mutation. No edit/delete inside the batch modal — it's add-only; users edit individual rows on the Dashboard after saving.
- **Out of scope:** mixing payments and deposits in one batch, CSV paste, keyboard shortcuts, draft persistence across modal close.
