
Fix this in `src/components/CSVImportModal.tsx` with a focused update to the CSV import review flow.

1. Correct the description column detection
- The current auto-detect logic is likely picking a date-related header as the description because it matches overly broad keywords like `transaction`.
- Update `autoDetectColumns()` to strongly prefer headers like `full description`, `description`, `memo`, `details`, `payee`, and avoid selecting headers that also contain `date`.
- Remove or heavily de-prioritize the generic `transaction` keyword unless it appears in something like `transaction description`.
- Add a safety check: if the chosen description column conflicts with the detected date column, fall back to manual mapping instead of guessing.

2. Make the description read-only in the “Review new items” row
- Replace the editable top `Input` behavior with a non-editable, multiline display block in the exact area the arrow points to.
- Style it to look like a field/container so the full bank description is prominent and easy to scan.
- Keep wrapping enabled so long entries like `PAYMENT GPM Empire...` and `Check #42068` are fully visible.

3. Remove inline editing from this step
- The user should not be able to edit the imported bank description here.
- Remove the visible rename input from this screen.
- Use the imported description as the value saved for unmatched items when applying.

4. Clean up the row layout
- Keep the full description in the large left area.
- Keep type, date, and amount in their existing side columns.
- Eliminate the current duplicate-looking date display caused by the wrong description value appearing in the editable field.

Technical details
- Main cause: `autoDetectColumns()` is too permissive and can map the description to a date column.
- Main UI fix: step 2 should render a read-only multiline description block instead of an editable `Input`.
- State cleanup: `editedDescription` can be removed, or kept internally but no longer exposed/changed in the UI; `handleApply()` should persist the original `row.description`.
- Scope: this is a single-file fix centered in `CSVImportModal.tsx`; no database changes are needed.
