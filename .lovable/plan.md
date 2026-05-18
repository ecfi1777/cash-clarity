## Problem
Editing the **Bank balance (posted)** field on the Dashboard appears not to save. The mutation is actually firing, but the UI snaps back to the old number because local input state is cleared before the refetched value arrives.

### Root cause (in `src/pages/Dashboard.tsx`)
```ts
const displayBankInput = bankInput ?? bankBalance.toString();

const handleBankBalanceChange = () => {
  const val = parseFloat(displayBankInput);
  if (!isNaN(val)) {
    updateBankBalance.mutate({ balance: val }); // async
    setBankInput(null);                          // runs immediately
  }
};
```
On blur:
1. `setBankInput(null)` runs synchronously.
2. The field now reads from `bankBalance.toString()` — still the **stale cached value** from React Query.
3. The Supabase update + invalidation + refetch eventually resolves and the new value appears.

Between step 2 and step 3 the input visibly reverts to the old number, which the user reads as "it didn't save."

## Fix

1. **Don't clear local state until the mutation actually succeeds.** Use the `onSuccess` callback of `mutate` so the field keeps showing the typed value during the round-trip, then hands off to the freshly refetched value.
2. **Skip the write if the value didn't change** (avoid pointless flicker when the user just tabs through).
3. **Coerce `bankBalance` to a number** when stringifying for display, in case Supabase returns numeric as a string.
4. **On mutation error**, restore the input to the server value and surface a toast so a real failure is visible instead of silent.

### Code changes (single file: `src/pages/Dashboard.tsx`)

```ts
const displayBankInput = bankInput ?? Number(bankBalance).toString();

const handleBankBalanceChange = () => {
  if (bankInput === null) return;            // nothing typed
  const val = parseFloat(bankInput);
  if (isNaN(val)) { setBankInput(null); return; }
  if (val === Number(bankBalance)) { setBankInput(null); return; }

  updateBankBalance.mutate(
    { balance: val },
    {
      onSuccess: () => setBankInput(null),   // hand off only after refetch fires
      onError: () => {
        setBankInput(null);
        toast({ title: 'Could not save bank balance', variant: 'destructive' });
      },
    }
  );
};
```

No backend, schema, or RLS changes needed — the existing row updates correctly; this is purely a UI state-handoff bug.

## Out of scope
- No changes to the "As of" date handler (it writes through cleanly because there's no local input mirror).
- No changes to `useUpdateBankBalance` or the `bank_balance` table.
