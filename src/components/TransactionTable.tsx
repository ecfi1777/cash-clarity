import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, todayStr } from '@/lib/format';
import { Pencil, X, Circle, CheckCircle2 } from 'lucide-react';
import type { Transaction } from '@/hooks/use-data';

type Props = {
  transactions: Transaction[];
  direction: 'pmt' | 'dep';
  onToggleCleared: (id: string, cleared: boolean) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onDateChange: (id: string, date: string) => void;
  dimmed?: boolean;
};

export function TransactionTable({ transactions, direction, onToggleCleared, onEdit, onDelete, onDateChange, dimmed }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Description</th>
            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground min-w-amount">Amount</th>
            <th className="text-center py-2 px-2 font-medium text-muted-foreground">Cleared</th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => (
            <tr key={tx.id} className={`border-b ${dimmed ? 'opacity-35' : ''}`}>
              <td className="py-2 px-2">
                {dimmed ? (
                  <span className="text-sm">{tx.date}</span>
                ) : (
                  <Input
                    type="date"
                    value={tx.date}
                    onChange={e => onDateChange(tx.id, e.target.value)}
                    className="h-7 w-36 text-sm"
                  />
                )}
              </td>
              <td className="py-2 px-2">
                <span>{tx.name}</span>
                {tx.is_recurring && <Badge variant="info" className="ml-1.5 text-[10px] px-1.5 py-0">rec</Badge>}
                {tx.source === 'csv_unmatched' && <Badge variant="warning" className="ml-1.5 text-[10px] px-1.5 py-0">CSV</Badge>}
              </td>
              <td className="py-2 px-2">
                <Badge variant="muted">{tx.type}</Badge>
              </td>
              <td className={`py-2 px-2 text-right min-w-amount ${direction === 'pmt' ? 'text-payment' : 'text-deposit'}`}>
                {direction === 'pmt' ? '−' : '+'}${formatCurrency(tx.amount)}
              </td>
              <td className="py-2 px-2 text-center">
                <button
                  onClick={() => onToggleCleared(tx.id, !tx.cleared)}
                  className="inline-flex items-center justify-center"
                >
                  {tx.cleared ? (
                    <CheckCircle2 className="w-5 h-5 text-deposit" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              </td>
              <td className="py-2 px-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(tx)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(tx.id)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
