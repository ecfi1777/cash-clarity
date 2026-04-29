import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X } from 'lucide-react';
import { todayStr, formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  description: string;
  amount: string;
  date: string;
  type: string;
  checkNumber: string;
};

type SaveItem = {
  name: string;
  expected_amount: number;
  direction: 'pmt' | 'dep';
  type: string;
  scheduled_date: string;
  status: 'outstanding';
  source: 'manual';
  check_number: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (items: SaveItem[], direction: 'pmt' | 'dep') => Promise<void> | void;
};

const newRow = (): Row => ({
  id: crypto.randomUUID(),
  description: '',
  amount: '',
  date: todayStr(),
  type: 'Check',
  checkNumber: '',
});

const initialRows = () => Array.from({ length: 5 }, newRow);

export function BatchTransactionModal({ open, onOpenChange, onSave }: Props) {
  const [direction, setDirection] = useState<'pmt' | 'dep'>('pmt');
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setRows(initialRows());
    setSubmitted(false);
    setDirection('pmt');
  };

  const handleClose = (next: boolean) => {
    if (!next && !saving) {
      reset();
    }
    onOpenChange(next);
  };

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows(prev => (prev.length === 1 ? [newRow()] : prev.filter(r => r.id !== id)));
  };

  const addRow = () => setRows(prev => [...prev, newRow()]);

  const isRowEmpty = (r: Row) =>
    !r.description.trim() && !r.amount.trim() && !r.checkNumber.trim();

  const validRows = useMemo(() => {
    return rows
      .filter(r => !isRowEmpty(r))
      .map(r => {
        const amt = parseFloat(r.amount);
        const valid = r.description.trim().length > 0 && !isNaN(amt) && amt > 0 && !!r.date;
        return { row: r, amt, valid };
      });
  }, [rows]);

  const validCount = validRows.filter(v => v.valid).length;
  const total = validRows.filter(v => v.valid).reduce((s, v) => s + v.amt, 0);
  const hasInvalid = validRows.some(v => !v.valid);

  const fieldError = (r: Row, field: 'description' | 'amount' | 'date') => {
    if (!submitted) return false;
    if (isRowEmpty(r)) return false;
    if (field === 'description') return !r.description.trim();
    if (field === 'amount') {
      const amt = parseFloat(r.amount);
      return isNaN(amt) || amt <= 0;
    }
    if (field === 'date') return !r.date;
    return false;
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    if (validCount === 0 || hasInvalid) return;

    const items: SaveItem[] = validRows
      .filter(v => v.valid)
      .map(({ row, amt }) => ({
        name: row.description.trim(),
        expected_amount: amt,
        direction,
        type: row.type,
        scheduled_date: row.date,
        status: 'outstanding',
        source: 'manual',
        check_number: row.checkNumber.trim().slice(0, 50) || null,
      }));

    try {
      setSaving(true);
      await onSave(items, direction);
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save batch:", error);
    } finally {
      setSaving(false);
    }
  };

  const noun = direction === 'pmt' ? 'payments' : 'deposits';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[1000px] p-5 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-medium">Add multiple {noun}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 pb-2">
          <Tabs value={direction} onValueChange={v => setDirection(v as 'pmt' | 'dep')}>
            <TabsList>
              <TabsTrigger value="pmt">Payments</TabsTrigger>
              <TabsTrigger value="dep">Deposits</TabsTrigger>
            </TabsList>
          </Tabs>
          {rows.length > 50 && (
            <span className="text-xs text-muted-foreground">{rows.length} rows — large batches may take a moment.</span>
          )}
        </div>

        <div className="overflow-auto border border-border rounded-md flex-1">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-2 font-medium w-[34%]">Description</th>
                <th className="px-2 py-2 font-medium w-[14%] text-right">Amount</th>
                <th className="px-2 py-2 font-medium w-[16%]">Date</th>
                <th className="px-2 py-2 font-medium w-[14%]">Type</th>
                <th className="px-2 py-2 font-medium w-[18%]">Check / Ref #</th>
                <th className="px-2 py-2 w-[4%]"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-2 py-1.5">
                    <Input
                      value={r.description}
                      onChange={e => updateRow(r.id, { description: e.target.value })}
                      placeholder={idx === 0 ? 'e.g. Office rent' : ''}
                      className={cn('h-9', fieldError(r, 'description') && 'border-destructive focus-visible:ring-destructive')}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={r.amount}
                      onChange={e => updateRow(r.id, { amount: e.target.value })}
                      className={cn('h-9 text-right min-w-[90px]', fieldError(r, 'amount') && 'border-destructive focus-visible:ring-destructive')}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="date"
                      value={r.date}
                      onChange={e => updateRow(r.id, { date: e.target.value })}
                      className={cn('h-9', fieldError(r, 'date') && 'border-destructive focus-visible:ring-destructive')}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select value={r.type} onValueChange={v => updateRow(r.id, { type: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Check">Check</SelectItem>
                        <SelectItem value="EFT">EFT</SelectItem>
                        <SelectItem value="ACH">ACH</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={r.checkNumber}
                      onChange={e => updateRow(r.id, { checkNumber: e.target.value })}
                      maxLength={50}
                      className="h-9"
                    />
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeRow(r.id)}
                      aria-label="Remove row"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="w-4 h-4 mr-1" /> Add row
          </Button>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{validCount}</span> valid {validCount === 1 ? 'row' : 'rows'}
            {' · Total '}
            <span className={cn('font-medium tabular-nums', direction === 'pmt' ? 'text-destructive' : 'text-emerald-600')}>
              {fmtCurrency(total)}
            </span>
            {submitted && hasInvalid && (
              <span className="ml-2 text-destructive">Fix highlighted fields</span>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || validCount === 0}>
            {saving ? 'Adding…' : `Add all (${validCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
