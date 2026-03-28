import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/format';
import type { Template } from '@/hooks/use-data';

type PendingItem = {
  templateId: string;
  name: string;
  direction: string;
  type: string;
  frequency: string;
  amount: number;
  date: string;
  approved: boolean;
};

function getOccurrences(template: Template, today: Date): string[] {
  const dates: string[] = [];
  const startStr = template.last_generated_date || template.created_at.split('T')[0];
  const start = new Date(startStr + 'T00:00:00');

  let cursor = new Date(start);

  const addPeriod = (d: Date): Date => {
    const next = new Date(d);
    if (template.frequency === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else if (template.frequency === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else {
      // quarterly: next Jan 1, Apr 1, Jul 1, Oct 1
      const quarters = [0, 3, 6, 9];
      const curMonth = next.getMonth();
      const nextQ = quarters.find(q => q > curMonth);
      if (nextQ !== undefined) {
        next.setMonth(nextQ);
        next.setDate(1);
      } else {
        next.setFullYear(next.getFullYear() + 1);
        next.setMonth(0);
        next.setDate(1);
      }
    }
    return next;
  };

  // Advance from start
  cursor = addPeriod(cursor);

  while (cursor <= today) {
    dates.push(cursor.toISOString().split('T')[0]);
    cursor = addPeriod(cursor);
  }

  return dates;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  onApply: (items: Array<{ name: string; amount: number; direction: string; type: string; date: string; template_id: string }>) => void;
};

export function GenerateRecurringModal({ open, onOpenChange, templates, onApply }: Props) {
  const today = useMemo(() => new Date(), []);

  const initialItems = useMemo(() => {
    const items: PendingItem[] = [];
    for (const t of templates) {
      const occurrences = getOccurrences(t, today);
      for (const date of occurrences) {
        items.push({
          templateId: t.id,
          name: t.name,
          direction: t.direction,
          type: t.type,
          frequency: t.frequency,
          amount: t.amount,
          date,
          approved: true,
        });
      }
    }
    return items;
  }, [templates, today]);

  const [items, setItems] = useState<PendingItem[]>(initialItems);

  const toggleItem = (idx: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, approved: !item.approved } : item));
  };

  const updateDate = (idx: number, date: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, date } : item));
  };

  const approveAll = () => setItems(prev => prev.map(item => ({ ...item, approved: true })));
  const skipAll = () => setItems(prev => prev.map(item => ({ ...item, approved: false })));

  const approvedCount = items.filter(i => i.approved).length;

  const handleApply = () => {
    const approved = items.filter(i => i.approved).map(i => ({
      name: i.name,
      amount: i.amount,
      direction: i.direction,
      type: i.type,
      date: i.date,
      template_id: i.templateId,
    }));
    onApply(approved);
  };

  // Build summary text
  const summary = useMemo(() => {
    if (items.length === 0) return 'No recurring transactions are due.';
    const groups: Record<string, number> = {};
    for (const item of items) {
      const key = `${item.frequency} ${item.name}`;
      groups[key] = (groups[key] || 0) + 1;
    }
    const parts = Object.entries(groups).map(([key, count]) => `${count} ${key}`);
    return parts.join(', ') + ' pending.';
  }, [items]);

  const freqVariant = (f: string) => {
    if (f === 'weekly') return 'info' as const;
    if (f === 'quarterly') return 'warning' as const;
    return 'muted' as const;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-5 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-medium">Generate recurring transactions</DialogTitle>
          <DialogDescription>{approvedCount} items selected. {summary}</DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No recurring transactions are overdue.</p>
        ) : (
          <>
            <div className="flex gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={approveAll}>Approve all</Button>
              <Button variant="outline" size="sm" onClick={skipAll}>Skip all</Button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-2 rounded border ${!item.approved ? 'opacity-35' : ''}`}
                >
                  <Checkbox checked={item.approved} onCheckedChange={() => toggleItem(idx)} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{item.name}</span>
                    <div className="flex gap-1 mt-0.5">
                      <Badge variant={freqVariant(item.frequency)}>{item.frequency}</Badge>
                      <Badge variant="muted">{item.type}</Badge>
                    </div>
                  </div>
                  <Input
                    type="date"
                    value={item.date}
                    onChange={e => updateDate(idx, e.target.value)}
                    className="w-36"
                  />
                  <span className={`text-sm min-w-amount text-right ${item.direction === 'pmt' ? 'text-payment' : 'text-deposit'}`}>
                    {item.direction === 'pmt' ? '−' : '+'}${formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleApply} disabled={approvedCount === 0}>Add approved</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
