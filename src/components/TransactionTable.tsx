import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, todayStr } from '@/lib/format';
import { Pencil, X, Circle, CheckCircle2 } from 'lucide-react';
import type { ExpectedTransaction } from '@/hooks/use-data';

type Props = {
  transactions: ExpectedTransaction[];
  direction: 'pmt' | 'dep';
  onToggleCleared: (id: string, cleared: boolean) => void;
  onEdit: (tx: ExpectedTransaction) => void;
  onDelete: (id: string) => void;
  onDateChange: (id: string, date: string) => void;
  dimmed?: boolean;
};

export function TransactionTable({ transactions, direction, onToggleCleared, onEdit, onDelete, onDateChange, dimmed }: Props) {
  const isCleared = (tx: ExpectedTransaction) => tx.status !== 'outstanding';

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
            <tr key={tx.id} className="border-b">
              <td className={`py-2 px-2 ${dimmed ? 'opacity-50' : ''}`}>
                {dimmed ? (
                  <span className="text-sm">{tx.scheduled_date}</span>
                ) : (
                  <Input
                    type="date"
                    value={tx.scheduled_date}
                    onChange={e => onDateChange(tx.id, e.target.value)}
                    className="h-7 w-36 text-sm"
                  />
                )}
              </td>
              <td className={`py-2 px-2 ${dimmed ? 'opacity-50' : ''}`}>
                <span>{tx.name}</span>
                {tx.source === 'recurring_generated' && <Badge variant="info" className="ml-1.5 text-[10px] px-1.5 py-0">rec</Badge>}
                {tx.source === 'import_unmatched' && <Badge variant="warning" className="ml-1.5 text-[10px] px-1.5 py-0">CSV</Badge>}
              </td>
              <td className={`py-2 px-2 ${dimmed ? 'opacity-50' : ''}`}>
                <Badge variant="muted">{tx.type}</Badge>
              </td>
              <td className={`py-2 px-2 text-right min-w-amount ${direction === 'pmt' ? 'text-payment' : 'text-deposit'} ${dimmed ? 'opacity-50' : ''}`}>
                {direction === 'pmt' ? '−' : '+'}${formatCurrency(tx.expected_amount)}
              </td>
              <td className="py-2 px-2 text-center">
                <button
                  onClick={() => onToggleCleared(tx.id, !isCleared(tx))}
                  className="inline-flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                  title={isCleared(tx) ? 'Restore to outstanding' : 'Mark as cleared'}
                  aria-label={isCleared(tx) ? 'Restore to outstanding' : 'Mark as cleared'}
                >
                  {isCleared(tx) ? (
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
