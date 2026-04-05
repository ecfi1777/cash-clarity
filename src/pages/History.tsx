import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, todayStr } from '@/lib/format';
import { useTransactions } from '@/hooks/use-data';

type QuickFilter = 'all' | 'deposits' | 'unmatched';

export default function History() {
  const { data: transactions = [], isLoading } = useTransactions();

  const firstOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(todayStr());
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  const filtered = useMemo(() => {
    return transactions
      .filter(t => (!fromDate || t.date >= fromDate) && (!toDate || t.date <= toDate))
      .filter(t => {
        if (quickFilter === 'deposits') return t.direction === 'dep';
        if (quickFilter === 'unmatched') return t.source === 'csv_unmatched';
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, fromDate, toDate, quickFilter]);

  const totalOut = filtered.filter(t => t.direction === 'pmt').reduce((s, t) => s + t.amount, 0);
  const totalIn = filtered.filter(t => t.direction === 'dep').reduce((s, t) => s + t.amount, 0);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  const filterLabel = quickFilter === 'deposits' ? 'deposits' : quickFilter === 'unmatched' ? 'unmatched imports' : 'transactions';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-lg font-medium">History</h1>

      {/* Quick filters */}
      <div className="flex gap-2">
        {([['all', 'All'], ['deposits', 'Deposits'], ['unmatched', 'Unmatched Imports']] as const).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={quickFilter === key ? 'default' : 'outline'}
            onClick={() => setQuickFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Date filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From date</label>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40 h-8" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To date</label>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40 h-8" />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {filterLabel} · <span className="text-payment">−${formatCurrency(totalOut)} out</span> · <span className="text-deposit">+${formatCurrency(totalIn)} in</span>
      </p>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Description</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Direction</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
              <th className="text-right py-2 px-2 font-medium text-muted-foreground min-w-amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(tx => (
              <tr key={tx.id} className="border-b">
                <td className="py-2 px-2">{tx.date}</td>
                <td className="py-2 px-2">
                  {tx.name}
                  {tx.source === 'csv_unmatched' && (
                    <Badge variant="outline" className="ml-2 text-xs bg-yellow-100 text-yellow-800 border-yellow-300">CSV</Badge>
                  )}
                </td>
                <td className="py-2 px-2"><Badge variant="muted">{tx.type}</Badge></td>
                <td className="py-2 px-2">
                  <Badge variant={tx.direction === 'pmt' ? 'payment' : 'deposit'}>
                    {tx.direction === 'pmt' ? 'payment' : 'deposit'}
                  </Badge>
                </td>
                <td className="py-2 px-2">
                  <Badge variant={tx.cleared ? 'deposit' : 'muted'}>
                    {tx.cleared ? 'cleared' : 'pending'}
                  </Badge>
                </td>
                <td className={`py-2 px-2 text-right min-w-amount ${tx.direction === 'pmt' ? 'text-payment' : 'text-deposit'}`}>
                  {tx.direction === 'pmt' ? '−' : '+'}${formatCurrency(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No {filterLabel} in this date range.
          </p>
        )}
      </div>
    </div>
  );
}
