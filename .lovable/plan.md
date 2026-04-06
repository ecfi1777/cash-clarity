

# Add Description Search + Secondary Description Support

## Change 1 — Database migration

```sql
ALTER TABLE expected_transactions ADD COLUMN secondary_description text;
```

## Change 2 — `src/hooks/use-data.ts`

Add `secondary_description: string | null;` to `ExpectedTransaction` type (after `notes`, line 21).

The query uses `select('*')`, which should include the new column. Verify that `secondary_description` is present in the returned data by inspecting the query result. If not, update the select path accordingly.

## Change 3 — `src/pages/History.tsx`

### State (after line 24)

```typescript
const [descriptionQuery, setDescriptionQuery] = useState('');
const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);
const [editingSecondary, setEditingSecondary] = useState('');
```

### Imports

Add: `useUpdateExpectedTransaction` from `@/hooks/use-data`, `toast` from `sonner`, `ChevronDown` / `ChevronRight` from `lucide-react`.

### Filter logic

Insert after the amount `.filter()` (line 45), before `.sort()`:

```typescript
.filter(t => {
  const q = descriptionQuery.trim().toLowerCase();
  if (!q) return true;
  const primary = (t.name ?? '').toLowerCase();
  const secondary = (t.secondary_description ?? '').toLowerCase();
  return primary.includes(q) || secondary.includes(q);
})
```

Add `descriptionQuery` to dependency array.

### UI — Description search input

Add in the date filter row (line 89 flex container), as a third item:

```tsx
<div className="space-y-1">
  <label className="text-xs text-muted-foreground">Description</label>
  <Input type="text" placeholder="Search description"
    value={descriptionQuery} onChange={e => setDescriptionQuery(e.target.value)}
    className="w-48 h-8" />
</div>
```

### UI — Expandable check rows

In the table body (line 134), for each `tx`:

1. **Description cell**: If `tx.type === 'Check'`, prepend a chevron icon button that toggles expand/collapse. Below primary name, if `tx.secondary_description` is non-empty, show it in `text-xs text-muted-foreground`.

2. **Expanded row**: If `expandedCheckId === tx.id`, render an additional `<tr>` below with `<td colSpan={6}>` containing:
   - `<Input>` bound to `editingSecondary`
   - "Save" `<Button size="sm">`

3. **Toggle logic**: Click chevron → if already expanded, collapse (null + clear `editingSecondary`); otherwise expand (set id + set `editingSecondary` to `tx.secondary_description ?? ''`).

4. **Save logic**:
   ```typescript
   const cleaned = editingSecondary.trim();
   updateTx.mutate(
     { id: tx.id, secondary_description: cleaned === '' ? null : cleaned },
     {
       onSuccess: () => { toast.success('Saved'); setExpandedCheckId(null); setEditingSecondary(''); },
       onError: () => { toast.error('Failed to save'); }
     }
   );
   ```
   - Trim input before saving
   - Store NULL instead of empty string
   - On success: toast, collapse, clear state
   - On error: toast, keep row open

### Check detection

`tx.type === 'Check'` — matches existing Badge display.

## Edge cases

- Empty search → no filtering
- Case-insensitive partial match on either field
- Null secondary_description treated as empty
- Blank input saved as NULL
- Whitespace-only input normalized to NULL
- Only check rows get expand/edit affordance
- Non-check rows unaffected

## Files changed

| File | Change |
|------|--------|
| Migration | `ALTER TABLE expected_transactions ADD COLUMN secondary_description text` |
| `src/hooks/use-data.ts` | Add `secondary_description` to `ExpectedTransaction` type |
| `src/pages/History.tsx` | Description search input + filter, expandable check row editor with trim-to-null save |

