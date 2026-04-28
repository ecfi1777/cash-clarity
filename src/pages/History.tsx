import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, todayStr } from '@/lib/format';
import { useExpectedTransactions, useUpdateExpectedTransaction, useRestoreExpectedTransaction } from '@/hooks/use-data';
import { toast } from 'sonner';
import type { ExpectedTransaction } from '@/hooks/use-data';

function toCSVValue(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatExportDate(d: string | null): string {
  if (!d) return '';
  try { return new Date(d).toISOString().split('T')[0]; }
  catch { return d; }
}

function getSource(tx: ExpectedTransaction): string {
  if (tx.source === 'import_unmatched') return 'CSV';
  if (tx.recurring_template_id) return 'Recurring';
  return tx.source ?? '';
}

type QuickFilter = 'all' | 'deposits' | 'unmatched';

export default function History() {
  const { data: transactions = [], isLoading } = useExpectedTransactions();
  const updateTx = useUpdateExpectedTransaction();
  const restoreTransaction = useRestoreExpectedTransaction();

  const firstOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(todayStr());
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [exactAmount, setExactAmount] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const hasExactAmount = !isNaN(parseFloat(exactAmount));
  const [descriptionQuery, setDescriptionQuery] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);
  const [editingSecondary, setEditingSecondary] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return transactions
      .filter(t => includeDeleted || t.status !== 'deleted')
      .filter(t => (!fromDate || t.scheduled_date >= fromDate) && (!toDate || t.scheduled_date <= toDate))
      .filter(t => {
        if (quickFilter === 'deposits') return t.direction === 'dep';
        if (quickFilter === 'unmatched') return t.source === 'import_unmatched';
        return true;
      })
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
      .filter(t => {
        const q = descriptionQuery.trim().toLowerCase();
        if (!q) return true;
        const primary = (t.name ?? '').toLowerCase();
        const secondary = (t.secondary_description ?? '').toLowerCase();
        return primary.includes(q) || secondary.includes(q);
      })
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  }, [transactions, includeDeleted, fromDate, toDate, quickFilter, exactAmount, minAmount, maxAmount, descriptionQuery]);

  const activeFiltered = useMemo(() => filtered.filter(t => t.status !== 'deleted'), [filtered]);
  const deletedCount = filtered.length - activeFiltered.length;
  const totalOut = activeFiltered.filter(t => t.direction === 'pmt').reduce((s, t) => s + t.expected_amount, 0);
  const totalIn = activeFiltered.filter(t => t.direction === 'dep').reduce((s, t) => s + t.expected_amount, 0);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  const filterLabel = quickFilter === 'deposits' ? 'deposits' : quickFilter === 'unmatched' ? 'unmatched imports' : 'transactions';

  const statusLabel = (status: string) => {
    if (status === 'outstanding') return 'pending';
    if (status === 'cleared_manual') return 'cleared';
    if (status === 'matched') return 'matched';
    if (status === 'deleted') return 'deleted';
    return status;
  };

  const statusVariant = (status: string) => {
    if (status === 'outstanding') return 'muted' as const;
    if (status === 'deleted') return 'muted' as const;
    return 'deposit' as const;
  };

  const handleToggleExpand = (tx: { id: string; secondary_description?: string | null }) => {
    if (expandedCheckId === tx.id) {
      setExpandedCheckId(null);
      setEditingSecondary('');
    } else {
      setExpandedCheckId(tx.id);
      setEditingSecondary(tx.secondary_description ?? '');
    }
  };

  const handleSaveSecondary = (txId: string) => {
    const cleaned = editingSecondary.trim();
    updateTx.mutate(
      { id: txId, secondary_description: cleaned === '' ? null : cleaned },
      {
        onSuccess: () => {
          toast.success('Saved');
          setExpandedCheckId(null);
          setEditingSecondary('');
        },
        onError: () => {
          toast.error('Failed to save');
        },
      }
    );
  };

  const handleExport = () => {
    const headers = [
      'Transaction ID', 'Date', 'Primary Description', 'Secondary Description',
      'Signed Amount', 'Direction', 'Type', 'Status', 'Source', 'Cleared At', 'Source Batch ID',
    ];
    const rows = filtered.map(tx => {
      const signedAmount = tx.direction === 'pmt'
        ? -Math.abs(tx.expected_amount)
        : Math.abs(tx.expected_amount);
      return [
        tx.id,
        formatExportDate(tx.scheduled_date),
        tx.name,
        tx.secondary_description,
        signedAmount,
        tx.direction === 'pmt' ? 'payment' : 'deposit',
        tx.type,
        tx.status,
        getSource(tx),
        formatExportDate(tx.cleared_at),
        tx.source_batch_id,
      ].map(v => escapeCSV(toCSVValue(v))).join(',');
    });
    const csvString = [headers.join(','), ...rows].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

      {/* Date + description filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From date</label>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40 h-8" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To date</label>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40 h-8" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Description</label>
          <Input type="text" placeholder="Search description" value={descriptionQuery} onChange={e => setDescriptionQuery(e.target.value)} className="w-48 h-8" />
        </div>
        <div className="flex items-center gap-2 h-8">
          <Switch id="include-deleted" checked={includeDeleted} onCheckedChange={setIncludeDeleted} />
          <label htmlFor="include-deleted" className="text-xs text-muted-foreground cursor-pointer">Include deleted</label>
        </div>
      </div>

      {/* Amount filter */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Exact amount</label>
          <Input type="number" step="0.01" min="0" placeholder="Exact" value={exactAmount} onChange={e => setExactAmount(e.target.value)} className="w-28 h-8" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Min</label>
          <Input type="number" step="0.01" min="0" placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} className="w-28 h-8" disabled={hasExactAmount} style={hasExactAmount ? { opacity: 0.4 } : {}} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Max</label>
          <Input type="number" step="0.01" min="0" placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className="w-28 h-8" disabled={hasExactAmount} style={hasExactAmount ? { opacity: 0.4 } : {}} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filterLabel} · <span className="text-payment">−${formatCurrency(totalOut)} out</span> · <span className="text-deposit">+${formatCurrency(totalIn)} in</span>
          {includeDeleted && deletedCount > 0 && (
            <span className="ml-2 italic">({deletedCount} deleted, excluded from totals)</span>
          )}
        </p>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Description</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Source</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Direction</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
              <th className="text-right py-2 px-2 font-medium text-muted-foreground min-w-amount">Amount</th>
              {includeDeleted && <th className="text-right py-2 px-2 font-medium text-muted-foreground w-24"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(tx => {
              const isCheck = tx.type === 'Check' || !!tx.check_number || /^check\s*#?\d/i.test(tx.name);
              const isExpanded = expandedCheckId === tx.id;
              const isDeleted = tx.status === 'deleted';
              const colSpan = includeDeleted ? 8 : 7;
              return (
                <>
                  <tr key={tx.id} className={`border-b ${isDeleted ? 'text-muted-foreground' : ''}`}>
                    <td className="py-2 px-2">{tx.scheduled_date}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-start gap-1">
                        {isCheck && !isDeleted && (
                          <button
                            onClick={() => handleToggleExpand(tx)}
                            className="mt-0.5 p-0 text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                        <div>
                          <span className={isDeleted ? 'line-through' : ''}>{tx.name}</span>
                          {tx.secondary_description && (
                            <div className="text-xs text-muted-foreground">{tx.secondary_description}</div>
                          )}
                          {isDeleted && tx.notes && (
                            <div className="text-xs italic text-muted-foreground mt-0.5">Note: {tx.notes}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">{getSource(tx)}</td>
                    <td className="py-2 px-2">
                      <Badge variant={tx.direction === 'pmt' ? 'payment' : 'deposit'}>
                        {tx.direction === 'pmt' ? 'payment' : 'deposit'}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant={statusVariant(tx.status)}>
                        {statusLabel(tx.status)}
                      </Badge>
                    </td>
                    <td className={`py-2 px-2 text-right min-w-amount ${isDeleted ? 'text-muted-foreground line-through' : tx.direction === 'pmt' ? 'text-payment' : 'text-deposit'}`}>
                      {tx.direction === 'pmt' ? '−' : '+'}${formatCurrency(tx.expected_amount)}
                    </td>
                    {includeDeleted && (
                      <td className="py-2 px-2 text-right">
                        {isDeleted && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={() => setRestoreConfirm(tx.id)}
                            disabled={restoreTransaction.isPending}
                          >
                            Restore
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                  {isCheck && isExpanded && !isDeleted && (
                    <tr key={`${tx.id}-edit`} className="border-b bg-muted/30">
                      <td colSpan={colSpan} className="py-2 px-2">
                        <div className="flex items-center gap-2 pl-5">
                          <label className="text-xs text-muted-foreground whitespace-nowrap">Secondary description</label>
                          <Input
                            type="text"
                            placeholder="e.g. payee name"
                            value={editingSecondary}
                            onChange={e => setEditingSecondary(e.target.value)}
                            className="w-64 h-7 text-sm"
                          />
                          <Button size="sm" className="h-7" onClick={() => handleSaveSecondary(tx.id)} disabled={updateTx.isPending}>
                            Save
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No {filterLabel} in this date range.
          </p>
        )}
      </div>

      <Dialog open={!!restoreConfirm} onOpenChange={open => { if (!open) setRestoreConfirm(null); }}>
        <DialogContent className="max-w-[400px] p-5">
          <DialogHeader>
            <DialogTitle className="font-medium">Restore transaction</DialogTitle>
            <DialogDescription>
              Restore this transaction back to <span className="font-medium">outstanding</span>? Any saved note will be kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreConfirm(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (restoreConfirm) {
                  restoreTransaction.mutate(restoreConfirm);
                  setRestoreConfirm(null);
                }
              }}
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}