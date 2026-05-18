## Goal
When manually adding a payment or deposit, warn if it likely duplicates an existing transaction — based on matching check/reference number **or** matching dollar amount, with **no date restriction**.

## Matching rule
Flag any existing `expected_transactions` row for the current user where `direction` matches the new entry AND either:
- `check_number` is non-empty and equals the new entry's check/reference number (case-insensitive, trimmed), OR
- `expected_amount` equals the new amount (exact, to the cent)

Statuses included: outstanding, matched, cleared — all of them. No date window.

Note: an amount-only match across all time will produce more hits (e.g. recurring $500 payments). The confirm screen makes it easy to scan and accept anyway, so this is acceptable.

## UX flow

**Single-add (`TransactionModal`)** — payments and deposits:
1. User submits the form.
2. Modal queries `expected_transactions` for potential duplicates using the rule above.
3. None found → save proceeds as today.
4. 1+ found → swap the dialog body to a confirm view:
   - Title: "Possible duplicate"
   - Subtext: "{n} existing transaction(s) match by {check # / amount / both}."
   - List each match: date, description, amount, status badge (Outstanding / Matched / Cleared), and a small tag showing why it matched ("same check #", "same amount").
   - Actions: **Back** (return to the form, nothing saved) and **Add anyway**.

**Batch-add (`BatchTransactionModal`)**:
1. On submit, run the check for every row.
2. If any rows have matches, show one review step listing each flagged new row with its match(es) grouped beneath, each tagged with the reason.
3. Actions: **Back to edit** or **Add all anyway**.

Linking/merging is not part of this iteration — warn + confirm only.

## Implementation

```text
src/lib/duplicates.ts  (new)
  findPotentialDuplicates({ direction, amount, checkNumber })
    → queries expected_transactions filtered by user + direction, OR'd on
      check_number match and amount match
    → returns [{ id, name, scheduled_date, expected_amount, status, type,
                 check_number, matchReason: 'check' | 'amount' | 'both' }]

src/components/TransactionModal.tsx
  - phase state: 'form' | 'confirm-duplicate'
  - On submit: await findPotentialDuplicates; if any, switch to confirm phase
  - Confirm view lists matches with reason tag; Back + Add anyway

src/components/BatchTransactionModal.tsx
  - Same pattern; one consolidated review step grouping matches per new row
  - Back to edit / Add all anyway
```

## Out of scope
- No schema changes.
- No automatic linking or merging.
- No fuzzy description matching.
- No date window (per request).