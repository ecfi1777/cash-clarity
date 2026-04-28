import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { todayStr } from '@/lib/format';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  direction: 'pmt' | 'dep';
  initial?: {
    id: string;
    name: string;
    amount: number;
    date: string;
    type: string;
    check_number?: string | null;
  };
  onSave: (data: { name: string; amount: number; date: string; type: string; check_number: string | null }) => void;
  onDelete?: () => void;
};

export function TransactionModal({ open, onOpenChange, mode, direction, initial, onSave, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [type, setType] = useState(initial?.type ?? 'Check');
  const [checkNumber, setCheckNumber] = useState(initial?.check_number ?? '');
  const [showDelete, setShowDelete] = useState(false);

  const title = mode === 'add'
    ? `Add ${direction === 'pmt' ? 'payment' : 'deposit'}`
    : `Edit ${direction === 'pmt' ? 'payment' : 'deposit'}`;

  const refLabel = type === 'Check' ? 'Check #' : type === 'EFT' ? 'EFT #' : type === 'ACH' ? 'ACH ref #' : 'Reference / Memo';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name.trim() || isNaN(amt) || amt <= 0 || !date) return;
    const ref = checkNumber.trim().slice(0, 50);
    onSave({ name: name.trim(), amount: amt, date, type, check_number: ref || null });
  };

  if (showDelete) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[600px] p-5">
          <DialogHeader>
            <DialogTitle className="font-medium">Remove transaction</DialogTitle>
            <DialogDescription>Remove this transaction? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-5">
        <DialogHeader>
          <DialogTitle className="font-medium">{title}</DialogTitle>
          {mode === 'edit' && (
            <DialogDescription>
              Changes here only affect this entry — no recurring item is touched.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tx-name">Description</Label>
            <Input id="tx-name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount">Amount</Label>
            <Input id="tx-amount" type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-date">Date</Label>
            <Input id="tx-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Check">Check</SelectItem>
                <SelectItem value="EFT">EFT</SelectItem>
                <SelectItem value="ACH">ACH</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-ref">{refLabel} <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="tx-ref"
              value={checkNumber}
              onChange={e => setCheckNumber(e.target.value)}
              maxLength={50}
              placeholder={type === 'Check' ? 'e.g. 1042' : type === 'EFT' ? 'e.g. EFT-9381' : 'Confirmation or memo'}
            />
          </div>
          <DialogFooter className="gap-2">
            {mode === 'edit' && onDelete && (
              <Button type="button" variant="destructive" onClick={() => setShowDelete(true)} className="mr-auto">
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{mode === 'add' ? 'Add' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
