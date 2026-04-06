

# Add Amount Filtering to History Page

## File: `src/pages/History.tsx`

### 1. State + derived boolean (after line 20)

```typescript
const [exactAmount, setExactAmount] = useState('');
const [minAmount, setMinAmount] = useState('');
const [maxAmount, setMaxAmount] = useState('');
const hasExactAmount = !isNaN(parseFloat(exactAmount));
```

### 2. Filter logic (lines 22-31)

Insert a third `.filter()` step before `.sort()`:

```typescript
.filter(t => {
  const absCents = Math.round(Math.abs(t.expected_amount) * 100);
  const exactVal = parseFloat(exactAmount);
  if (!isNaN(exactVal)) {
    return absCents === Math.round(exactVal * 100);
  }
  const minVal = parseFloat(minAmount);
  const maxVal = parseFloat(maxAmount);
  if (!isNaN(minVal) && absCents < Math.round(minVal * 100)) return false;
  if (!isNaN(maxVal) && absCents > Math.round(maxVal * 100)) return false;
  return true;
})
```

Add `exactAmount, minAmount, maxAmount` to dependency array.

### 3. UI (after line 82, between date filter and summary)

Add an amount filter row with three compact inputs using `hasExactAmount` to disable/dim Min and Max when Exact is populated.

### Edge cases handled
- Empty inputs ignored; absolute value comparison; integer cents precision; min-only/max-only work; exact takes precedence.

### Scope
Only `src/pages/History.tsx` is modified.

