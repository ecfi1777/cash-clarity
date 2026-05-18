import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { todayStr, formatCurrency } from '@/lib/format';
import { findPotentialDuplicates, reasonLabel, statusLabel, type DuplicateMatch } from '@/lib/duplicates';

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
  const [checking, setChecking] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [pendingPayload, setPendingPayload] = useState<{ name: string; amount: number; date: string; type: string; check_number: string | null } | null>(null);

  const title = mode === 'add'
    ? `Add ${direction === 'pmt' ? 'payment' : 'deposit'}`
    : `Edit ${direction === 'pmt' ? 'payment' : 'deposit'}`;

  const refLabel = type === 'Check' ? 'Check #' : type === 'EFT' ? 'EFT #' : type === 'ACH' ? 'ACH ref #' : 'Reference / Memo';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name.trim() || isNaN(amt) || amt <= 0 || !date) return;
    const ref = checkNumber.trim().slice(0, 50);
    const payload = { name: name.trim(), amount: amt, date, type, check_number: ref || null };

    // Only run duplicate check on add
    if (mode === 'add') {
      setChecking(true);
      try {
        const matches = await findPotentialDuplicates({
          direction,
          amount: amt,
          checkNumber: ref || null,
        });
        if (matches.length > 0) {
          setDuplicates(matches);
          setPendingPayload(payload);
          return;
        }
      } finally {
        setChecking(false);
      }
    }

    onSave(payload);
  };

  const handleConfirmAnyway = () => {
    if (pendingPayload) onSave(pendingPayload);
    setDuplicates(null);
    setPendingPayload(null);
  };

  const handleBackToForm = () => {
    setDuplicates(null);
    setPendingPayload(null);
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

  if (duplicates) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[700px] p-5">
          <DialogHeader>
            <DialogTitle className="font-medium">Possible duplicate</DialogTitle>
            <DialogDescription>
              Found {duplicates.length} existing {direction === 'pmt' ? 'payment' : 'deposit'}
              {duplicates.length === 1 ? '' : 's'} that may match this entry. Review before adding.
            </DialogDescription>
          </DialogHeader>
          <div className="border border-border rounded-md max-h-[50vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr className="text-left">
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium text-right">Amount</th>
                  <th className="px-2 py-2 font-medium">Check #</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Matches on</th>
                </tr>
              </thead>
              <tbody>
                {duplicates.map(m => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-2 py-1.5">{m.scheduled_date}</td>
                    <td className="px-2 py-1.5">{m.name}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums min-w-[90px]">{formatCurrency(m.expected_amount)}</td>
                    <td className="px-2 py-1.5">{m.check_number || '—'}</td>
                    <td className="px-2 py-1.5">{statusLabel(m.status)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{reasonLabel(m.matchReason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleBackToForm}>Back</Button>
            <Button onClick={handleConfirmAnyway}>Add anyway</Button>
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
            <Button type="submit" disabled={checking}>
              {checking ? 'Checking…' : mode === 'add' ? 'Add' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
