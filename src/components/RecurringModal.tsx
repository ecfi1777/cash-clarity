import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  initial?: {
    id: string;
    name: string;
    amount: number;
    direction: string;
    type: string;
    frequency: string;
    next_due_date?: string | null;
  };
  onSave: (data: { name: string; amount: number; direction: string; type: string; frequency: string; next_due_date: string | null }) => void;
  onDelete?: () => void;
};

export function RecurringModal({ open, onOpenChange, mode, initial, onSave, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [direction, setDirection] = useState(initial?.direction ?? 'pmt');
  const [type, setType] = useState(initial?.type ?? 'Check');
  const [frequency, setFrequency] = useState(initial?.frequency ?? 'monthly');
  const [nextDueDate, setNextDueDate] = useState(initial?.next_due_date ?? '');
  const [showDelete, setShowDelete] = useState(false);

  if (showDelete) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[600px] p-5">
          <DialogHeader>
            <DialogTitle className="font-medium">Remove recurring item</DialogTitle>
            <DialogDescription>
              Remove this recurring item? It will no longer appear when generating transactions. Existing entries are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name.trim() || isNaN(amt) || amt <= 0) return;
    onSave({ name: name.trim(), amount: amt, direction, type, frequency, next_due_date: nextDueDate || null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-5">
        <DialogHeader>
          <DialogTitle className="font-medium">{mode === 'add' ? 'Add recurring item' : 'Edit recurring item'}</DialogTitle>
          {mode === 'edit' && (
            <DialogDescription>
              Only affects future generated transactions — existing entries are never changed.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pmt">Payment</SelectItem>
                <SelectItem value="dep">Deposit</SelectItem>
              </SelectContent>
            </Select>
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
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Next due date</Label>
            <Input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">When is the next occurrence due? Leave blank if not yet scheduled.</p>
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
