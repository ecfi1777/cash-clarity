## Goal

Let the user name the vendor for any check-numbered bank row that comes through as "unmatched." They can do it inline during the CSV import wizard, or skip it and finish the task later from a new **Reports → Unmatched Checks** page.

## Part 1 — Vendor entry during CSV import (Unmatched step)

In the CSV Import modal's "Unmatched" step, each row that has a check number gets a new **Vendor** text field next to the existing Type / Date / Amount controls.

- Field is only shown when `row.check_number` is present (Type = Check).
- Optional — leaving it blank is fine; the row still imports.
- When provided, the value is saved into `expected_transactions.name` on apply (instead of the current default like "Check #1234").
- "Next: duplicates" remains enabled regardless of whether vendors are filled in.

## Part 2 — New Reports tab

Add a new top-nav tab **Reports** between Recurring and Imports.

`/reports` is a landing page that lists available reports. For now there is exactly one card: **Unmatched Checks**, linking to `/reports/unmatched-checks`.

### Unmatched Checks report

Shows every check-numbered transaction that came in through an applied import and still has no real vendor name assigned. Definition:

- `expected_transactions.check_number IS NOT NULL`
- `source = 'import'` (came from a bank import, not entered manually or via recurring)
- `name` is blank or still a placeholder like `Check #1234` / `Unnamed`

Table columns: Date · Check # · Amount · Description (raw bank desc) · **Vendor** (editable text input) · **Save** button per row, plus a **Clear** action that marks the row as resolved (sets the name and removes it from the report).

Bulk behavior: each row is independent — type a name, click Save, row disappears from the report.

Empty state: "No unmatched checks. Nice work."

## Part 3 — Wiring

- Add `/reports` and `/reports/unmatched-checks` routes in `src/App.tsx` behind `ProtectedRoute`.
- Add the "Reports" entry to `src/components/AppNav.tsx` between Recurring and Imports.
- New files:
  - `src/pages/Reports.tsx` — index page with the report cards.
  - `src/pages/UnmatchedChecks.tsx` — the report table with inline vendor editing.
- Update `src/components/CSVImportModal.tsx`:
  - Add `vendorName` to the per-row state for unmatched rows.
  - Render the Vendor input only when check_number is present.
  - On apply, pass the vendor name as the `name` field for inserted `expected_transactions`.

## Technical notes

- No schema changes needed — `expected_transactions` already has `name`, `check_number`, and `source`.
- Saving a vendor from the Reports page is a simple `UPDATE expected_transactions SET name = $1 WHERE id = $2`, reusing the existing data hooks pattern from History/Dashboard.
- Detection of "still needs a vendor" uses a client-side filter: `check_number != null && source === 'import' && (!name || /^check\s*#?\d+$/i.test(name) || name === 'Unnamed')`. This avoids any migration.

## Out of scope

- No new vendor master record / `vendors` table linkage in this pass (we're just setting the free-text `name`). Linking to the existing `vendors` table can be a follow-up if you want autocomplete.
- No edits to already-cleared/matched transactions from the Reports view.
