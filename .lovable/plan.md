## Add "Delete" option to Generate Recurring modal

Today, unchecking an item **skips** it — it will reappear next time the user generates recurring transactions. Add a separate **Delete** action that permanently dismisses that specific occurrence so it never shows up again, while leaving the template intact so future dated occurrences still generate normally.

### UX

In `GenerateRecurringModal`, next to each row's date/amount, add a small trash icon button.

Clicking it opens a confirm dialog:

> **Permanently delete this occurrence?**
> This will remove the {name} occurrence for {date} so it won't appear again the next time you generate recurring transactions. Future scheduled occurrences of this recurring item are not affected.
>
> [Cancel] [Delete]

On confirm:
- Insert a row into a new `dismissed_recurring_occurrences` table (template_id + date).
- Remove the row from the modal's local list immediately.
- Update the header count/summary.

"Approve all" / "Skip all" continue to only toggle the checkbox — they don't touch deletions.

### Data

New table `public.dismissed_recurring_occurrences`:
- `user_id` (uuid, auth.uid)
- `template_id` (uuid, FK recurring_templates)
- `occurrence_date` (date)
- unique (user_id, template_id, occurrence_date)
- RLS: user can manage their own rows
- Standard GRANTs

### Generation logic

`getOccurrences` in `GenerateRecurringModal.tsx` currently walks from `next_due_date` (or after `last_generated_date`) up to today. After building the list, filter out any `(template_id, date)` present in dismissed rows for the current user.

Fetch dismissed rows via a new hook `useDismissedOccurrences()` in `src/hooks/use-data.ts`, and a `useDismissOccurrence()` mutation that inserts a row and invalidates the query.

Because the template's `next_due_date` / `last_generated_date` are **not** advanced by a dismissal, future occurrences continue to appear on schedule — matching the requirement that memorized/future transactions are unaffected.

### Files touched

- New migration: `dismissed_recurring_occurrences` table + RLS + GRANTs
- `src/hooks/use-data.ts` — add `useDismissedOccurrences`, `useDismissOccurrence`
- `src/components/GenerateRecurringModal.tsx` — filter dismissed occurrences, add trash button + confirm dialog

### Out of scope

- No changes to the templates themselves (edit/delete of the whole recurring item stays on the Recurring page).
- No change to skip-via-checkbox behavior.
- No backfill or cleanup of previously skipped items.
