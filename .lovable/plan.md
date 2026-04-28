# Allow Restoring (Un-clearing) Items from "Recently cleared"

## Root cause

The cleared toggle in `TransactionTable` already supports un-clearing — clicking the green check calls `onToggleCleared(id, false)`, which sets `status: 'outstanding'` and `cleared_at: null`. So the data path works.

The problem is purely UX: in the "Recently cleared" section the entire row is rendered at 35% opacity (`dimmed`), and there is no label, tooltip, or hover affordance on the green check. Users don't realize it's clickable to restore.

## Changes

### 1. `src/components/TransactionTable.tsx` — make the cleared toggle obvious

- Keep the cleared button always at full opacity even when the row is `dimmed` (so the affordance stands out against muted text).
- Add a `title` tooltip on the button: `"Restore to outstanding"` when currently cleared, `"Mark as cleared"` when outstanding.
- Add hover styles (`hover:opacity-80 cursor-pointer`) and a focusable `aria-label`.
- On dimmed rows, also keep the Actions column (edit/delete) at normal opacity is already fine — only adjust the cleared cell.

### 2. `src/pages/Dashboard.tsx` — small label hint

Under the "Recently cleared" heading, add a one-line muted hint:
> "Click the green check to restore an item to outstanding."

That way the user immediately understands the interaction.

## What stays the same

- `handleToggleCleared` already handles both directions (clear ↔ restore). No data layer changes needed.
- No DB migration. No new mutations.
- History page behavior unchanged.

## Files changed

| File | Change |
|------|--------|
| `src/components/TransactionTable.tsx` | Cleared button: tooltip, aria-label, full opacity on dimmed rows, hover style |
| `src/pages/Dashboard.tsx` | Add helper text under "Recently cleared" heading |

## Where the user clicks

In the "Recently cleared" table at the bottom of the Dashboard, click the green ✓ icon in the **Cleared** column of the row you want to restore. It will move back up to "Outstanding payments" (or "Pending deposits" for deposits).
