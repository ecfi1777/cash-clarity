## Fix CSV matching false positives

Raise the qualification bar in `src/lib/matching.ts` so date proximity alone can't create a "partial match."

### Changes to `src/lib/matching.ts`

1. **Raise minimum candidate score** from ≥20 to ≥35.
2. **Require at least one non-date signal** for a candidate to qualify:
   - exact amount match, OR
   - check# match, OR
   - any description token overlap
3. **Preserve existing exact check# override** (an exact check# match always qualifies regardless of other signals).
4. Pure date proximity (no amount, no check#, no description overlap) → never qualifies → row falls to **Unmatched** in step 4.

### Expected outcome on your screenshot

The four mismatched rows (Chaney ↔ MD UI, Transfer ↔ Check #41961, Amex, Shell) will drop from false "Partial" matches to **Unmatched**, which is correct since those expected items haven't actually cleared the bank yet.

No UI changes, no schema changes.
