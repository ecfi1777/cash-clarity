## Goal

Replace the always-editable bank balance field with a clear **read → Edit → Save / Cancel** flow.

## Current behavior (the problem)

The "Bank balance (posted)" card shows an input bound directly to the value. It looks like static text but is actually live — typed changes save automatically on blur or Enter. There's no explicit edit affordance and no obvious save action, which is why edits feel like they "don't stick."

## New behavior

### Default (read) state
- Bank balance displayed as **plain styled text** (e.g. `$12,345.67`), no input chrome.
- A small **Edit** button (pencil icon + "Edit" label) sits next to it.
- "As of" date stays as is below.

### Edit state (after clicking Edit)
- Balance becomes an editable number input, prefilled with the current value, autofocused, text selected.
- Two buttons appear: **Save** (primary) and **Cancel** (ghost).
- `Enter` triggers Save. `Escape` triggers Cancel.
- Save: validates the number, calls `updateBankBalance.mutate`; on success, exits edit mode and toasts "Bank balance updated"; on error, stays in edit mode and shows an error toast.
- Cancel: discards the typed value, exits edit mode.
- While the mutation is in flight, the Save button shows a loading state and inputs are disabled.

### "As of" date
- Leave as the existing inline date input (already works fine and is a separate field). No change unless you'd like the same edit/save pattern applied there too — let me know.

## Files

- **`src/pages/Dashboard.tsx`** — only file touched.
  - Add `isEditingBalance` state.
  - Replace the always-on `<Input>` block (lines ~235–246) with conditional read view + edit view.
  - Wire Save/Cancel/Enter/Escape handlers using the existing `updateBankBalance` mutation and `bankInput` state.
  - Remove the now-unused `onBlur` auto-save path.

No backend, schema, RLS, or hook changes. Pure UI/state refactor of one card.

## Visual

Read state (compact):

```
Bank balance (posted)
$12,345.67   [✎ Edit]
As of 05/18/2026
```

Edit state:

```
Bank balance (posted)
$ [ 12345.67    ]  [Save] [Cancel]
As of 05/18/2026
```

Buttons use existing shadcn `Button` variants — flat aesthetic, no shadows, consistent with the rest of the dashboard.