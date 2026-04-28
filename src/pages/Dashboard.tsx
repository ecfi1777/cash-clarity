import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TransactionTable } from '@/components/TransactionTable';
import { TransactionModal } from '@/components/TransactionModal';
import { GenerateRecurringModal } from '@/components/GenerateRecurringModal';
import { CSVImportModal } from '@/components/CSVImportModal';
import { formatCurrency, todayStr } from '@/lib/format';
import {
  useExpectedTransactions,
  useBankBalance,
  useRecurringTemplates,
  useUpdateBankBalance,
  useCreateExpectedTransaction,
  useUpdateExpectedTransaction,
  useDeleteExpectedTransaction,
  useRestoreExpectedTransaction,
  useBulkInsertExpectedTransactions,
  useBulkUpdateExpectedTransactions,
  type ExpectedTransaction,
} from '@/hooks/use-data';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, RefreshCw, Upload } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Dashboard() {
  const { data: transactions = [], isLoading: txLoading } = useExpectedTransactions();
  const { data: bankBalanceRow, isLoading: bbLoading } = useBankBalance();
  const { data: templates = [] } = useRecurringTemplates();
  const updateBankBalance = useUpdateBankBalance();
  const createTransaction = useCreateExpectedTransaction();
  const updateTransaction = useUpdateExpectedTransaction();
  const deleteTransaction = useDeleteExpectedTransaction();
  const restoreTransaction = useRestoreExpectedTransaction();
  const bulkInsert = useBulkInsertExpectedTransactions();
  const bulkUpdate = useBulkUpdateExpectedTransactions();
  const queryClient = useQueryClient();

  const [bankInput, setBankInput] = useState<string | null>(null);
  const [txModal, setTxModal] = useState<{ open: boolean; mode: 'add' | 'edit'; direction: 'pmt' | 'dep'; tx?: ExpectedTransaction }>({ open: false, mode: 'add', direction: 'pmt' });
  const [generateOpen, setGenerateOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteNote, setDeleteNote] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'unmatched'>('all');

  const bankBalance = bankBalanceRow?.balance ?? 0;
  const bankAsOf = (bankBalanceRow as any)?.balance_as_of ?? '';
  const displayBankInput = bankInput ?? bankBalance.toString();

  const outstanding = useMemo(() =>
    transactions.filter(t => t.status === 'outstanding' && t.direction === 'pmt').sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
    [transactions]
  );

  const pending = useMemo(() =>
    transactions.filter(t => t.status === 'outstanding' && t.direction === 'dep').sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
    [transactions]
  );

  const filteredOutstanding = useMemo(() =>
    viewFilter === 'unmatched' ? outstanding.filter(t => t.source === 'import_unmatched') : outstanding,
    [outstanding, viewFilter]
  );

  const filteredPending = useMemo(() =>
    viewFilter === 'unmatched' ? pending.filter(t => t.source === 'import_unmatched') : pending,
    [pending, viewFilter]
  );

  const recentlyCleared = useMemo(() =>
    transactions
      .filter(t => t.status !== 'outstanding' && t.status !== 'deleted')
      .sort((a, b) => (b.cleared_at ?? '').localeCompare(a.cleared_at ?? ''))
      .slice(0, 5),
    [transactions]
  );

  const recentlyDeleted = useMemo(() =>
    transactions
      .filter(t => t.status === 'deleted')
      .sort((a, b) => (b.cleared_at ?? '').localeCompare(a.cleared_at ?? ''))
      .slice(0, 10),
    [transactions]
  );

  const outstandingTotal = outstanding.reduce((s, t) => s + t.expected_amount, 0);
  const pendingTotal = pending.reduce((s, t) => s + t.expected_amount, 0);
  const tcp = bankBalance - outstandingTotal + pendingTotal;

  const handleBankBalanceChange = () => {
    const val = parseFloat(displayBankInput);
    if (!isNaN(val)) {
      updateBankBalance.mutate({ balance: val });
      setBankInput(null);
    }
  };

  const handleBankAsOfChange = (value: string) => {
    updateBankBalance.mutate({ balance_as_of: value || null });
  };

  const handleToggleCleared = (id: string, cleared: boolean) => {
    updateTransaction.mutate({
      id,
      status: cleared ? 'cleared_manual' : 'outstanding',
      cleared_at: cleared ? new Date().toISOString() : null,
    });
  };

  const handleDateChange = (id: string, scheduled_date: string) => {
    updateTransaction.mutate({ id, scheduled_date });
  };

  const handleSaveTransaction = (data: { name: string; amount: number; date: string; type: string; check_number: string | null }) => {
    if (txModal.mode === 'add') {
      createTransaction.mutate({
        name: data.name,
        expected_amount: data.amount,
        direction: txModal.direction,
        type: data.type,
        scheduled_date: data.date,
        status: 'outstanding',
        source: 'manual',
        check_number: data.check_number,
      });
    } else if (txModal.tx) {
      updateTransaction.mutate({
        id: txModal.tx.id,
        name: data.name,
        expected_amount: data.amount,
        scheduled_date: data.date,
        type: data.type,
        check_number: data.check_number,
      });
    }
    setTxModal(prev => ({ ...prev, open: false }));
  };

  const handleDeleteTransaction = () => {
    const note = deleteNote.trim().slice(0, 500) || null;
    if (deleteConfirm) {
      deleteTransaction.mutate({ id: deleteConfirm, note });
      setDeleteConfirm(null);
      setDeleteNote('');
    } else if (txModal.tx) {
      deleteTransaction.mutate({ id: txModal.tx.id, note });
      setTxModal(prev => ({ ...prev, open: false }));
      setDeleteNote('');
    }
  };
    } else if (txModal.tx) {
      deleteTransaction.mutate(txModal.tx.id);
      setTxModal(prev => ({ ...prev, open: false }));
    }
  };

  const handleGenerateApply = async (items: Array<{ name: string; amount: number; direction: string; type: string; date: string; template_id: string }>) => {
    await bulkInsert.mutateAsync(items.map(i => ({
      name: i.name,
      expected_amount: i.amount,
      direction: i.direction,
      type: i.type,
      scheduled_date: i.date,
      status: 'outstanding',
      source: 'recurring_generated',
      recurring_template_id: i.template_id,
    })));

    // Update last_generated_date and advance next_due_date on recurring_templates
    const templateIds = [...new Set(items.map(i => i.template_id))];
    for (const tid of templateIds) {
      const templateItems = items.filter(i => i.template_id === tid);
      const latestDate = templateItems.reduce((max, i) => i.date > max ? i.date : max, templateItems[0].date);

      const template = templates.find(t => t.id === tid);
      let nextDue: string | null = null;
      if (template) {
        const d = new Date(latestDate + 'T00:00:00');
        if (template.frequency === 'weekly') {
          d.setDate(d.getDate() + 7);
        } else if (template.frequency === 'monthly') {
          d.setMonth(d.getMonth() + 1);
        } else {
          const quarters = [0, 3, 6, 9];
          const curMonth = d.getMonth();
          const nextQ = quarters.find(q => q > curMonth);
          if (nextQ !== undefined) { d.setMonth(nextQ); d.setDate(1); }
          else { d.setFullYear(d.getFullYear() + 1); d.setMonth(0); d.setDate(1); }
        }
        nextDue = d.toISOString().split('T')[0];
      }

      await supabase.from('recurring_templates' as any).update({
        last_generated_date: latestDate,
        next_due_date: nextDue,
      } as any).eq('id', tid);
    }
    queryClient.invalidateQueries({ queryKey: ['recurring_templates'] });
    setGenerateOpen(false);
  };


  if (txLoading || bbLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* TCP Hero */}
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground mb-1">True cash position</p>
        <p className={`text-4xl font-medium ${tcp >= 0 ? 'text-deposit' : 'text-payment'}`}>
          {tcp < 0 ? '−' : ''}${formatCurrency(Math.abs(tcp))}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border rounded-md p-4">
          <p className="text-xs text-muted-foreground mb-1">Bank balance (posted)</p>
          <div className="flex items-center gap-2">
            <span className="text-lg">$</span>
            <Input
              type="number"
              step="0.01"
              value={displayBankInput}
              onChange={e => setBankInput(e.target.value)}
              onBlur={handleBankBalanceChange}
              onKeyDown={e => e.key === 'Enter' && handleBankBalanceChange()}
              className="h-8 text-lg font-medium border-0 p-0 focus-visible:ring-0"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs text-muted-foreground">As of</label>
            <Input
              type="date"
              value={bankAsOf}
              onChange={e => handleBankAsOfChange(e.target.value)}
              className="h-7 text-xs border-0 p-0 focus-visible:ring-0 w-auto"
            />
          </div>
        </div>
        <div className="border rounded-md p-4">
          <p className="text-xs text-muted-foreground mb-1">Outstanding payments</p>
          <p className="text-lg font-medium text-payment">−${formatCurrency(outstandingTotal)}</p>
        </div>
        <div className="border rounded-md p-4">
          <p className="text-xs text-muted-foreground mb-1">Pending deposits</p>
          <p className="text-lg font-medium text-deposit">+${formatCurrency(pendingTotal)}</p>
        </div>
      </div>

      {/* View filter tabs */}
      <Tabs value={viewFilter} onValueChange={v => setViewFilter(v as 'all' | 'unmatched')}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unmatched">Unmatched imports</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setTxModal({ open: true, mode: 'add', direction: 'pmt' })}>
          <Plus className="w-4 h-4 mr-1" /> Add payment
        </Button>
        <Button onClick={() => setTxModal({ open: true, mode: 'add', direction: 'dep' })}>
          <Plus className="w-4 h-4 mr-1" /> Add deposit
        </Button>
        <Button variant="outline" onClick={() => setGenerateOpen(true)}>
          <RefreshCw className="w-4 h-4 mr-1" /> Generate recurring
        </Button>
        <Button variant="outline" onClick={() => setCsvOpen(true)}>
          <Upload className="w-4 h-4 mr-1" /> Import bank CSV
        </Button>
      </div>

      {/* Outstanding payments */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-medium">Outstanding payments</h2>
          <Badge variant="payment">{filteredOutstanding.length} outstanding · −${formatCurrency(filteredOutstanding.reduce((s, t) => s + t.expected_amount, 0))}</Badge>
        </div>
        {filteredOutstanding.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{viewFilter === 'unmatched' ? 'No unmatched imported payments.' : 'No outstanding payments.'}</p>
        ) : (
          <TransactionTable
            transactions={filteredOutstanding}
            direction="pmt"
            onToggleCleared={handleToggleCleared}
            onEdit={tx => setTxModal({ open: true, mode: 'edit', direction: 'pmt', tx })}
            onDelete={id => setDeleteConfirm(id)}
            onDateChange={handleDateChange}
          />
        )}
      </div>

      {/* Pending deposits */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-medium">Pending deposits</h2>
          <Badge variant="deposit">{filteredPending.length} pending · +${formatCurrency(filteredPending.reduce((s, t) => s + t.expected_amount, 0))}</Badge>
        </div>
        {filteredPending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{viewFilter === 'unmatched' ? 'No unmatched imported deposits.' : 'No pending deposits.'}</p>
        ) : (
          <TransactionTable
            transactions={filteredPending}
            direction="dep"
            onToggleCleared={handleToggleCleared}
            onEdit={tx => setTxModal({ open: true, mode: 'edit', direction: 'dep', tx })}
            onDelete={id => setDeleteConfirm(id)}
            onDateChange={handleDateChange}
          />
        )}
      </div>

      {/* Recently cleared */}
      {recentlyCleared.length > 0 && (
        <div>
          <div className="border-t pt-4">
            <h2 className="text-base font-medium mb-1">Recently cleared</h2>
            <p className="text-xs text-muted-foreground mb-3">Click the green check in the Cleared column to restore an item to outstanding.</p>
            <TransactionTable
              transactions={recentlyCleared}
              direction="pmt"
              onToggleCleared={handleToggleCleared}
              onEdit={tx => setTxModal({ open: true, mode: 'edit', direction: tx.direction as 'pmt' | 'dep', tx })}
              onDelete={id => setDeleteConfirm(id)}
              onDateChange={handleDateChange}
              dimmed
            />
          </div>
        </div>
      )}

      {/* Recently deleted */}
      {recentlyDeleted.length > 0 && (
        <div>
          <div className="border-t pt-4">
            <h2 className="text-base font-medium mb-1">Recently deleted</h2>
            <p className="text-xs text-muted-foreground mb-3">Restore a transaction to put it back into outstanding.</p>
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left font-normal py-2 px-3">Deleted</th>
                    <th className="text-left font-normal py-2 px-3">Date</th>
                    <th className="text-left font-normal py-2 px-3">Description</th>
                    <th className="text-left font-normal py-2 px-3">Type</th>
                    <th className="text-right font-normal py-2 px-3">Amount</th>
                    <th className="text-right font-normal py-2 px-3 w-32">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentlyDeleted.map(tx => (
                    <tr key={tx.id} className="border-b last:border-0">
                      <td className="py-2 px-3 text-muted-foreground">
                        {tx.cleared_at ? new Date(tx.cleared_at).toLocaleDateString('en-US') : '—'}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{tx.scheduled_date}</td>
                      <td className="py-2 px-3 text-muted-foreground line-through">{tx.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{tx.type}</td>
                      <td className={`py-2 px-3 text-right tabular-nums min-w-[90px] ${tx.direction === 'pmt' ? 'text-payment' : 'text-deposit'}`}>
                        {tx.direction === 'pmt' ? '−' : '+'}${formatCurrency(Math.abs(tx.expected_amount))}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => restoreTransaction.mutate(tx.id)}
                          disabled={restoreTransaction.isPending}
                        >
                          Restore
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {txModal.open && (
        <TransactionModal
          open={txModal.open}
          onOpenChange={open => setTxModal(prev => ({ ...prev, open }))}
          mode={txModal.mode}
          direction={txModal.direction}
          initial={txModal.tx ? { id: txModal.tx.id, name: txModal.tx.name, amount: txModal.tx.expected_amount, date: txModal.tx.scheduled_date, type: txModal.tx.type, check_number: (txModal.tx as any).check_number ?? null } : undefined}
          onSave={handleSaveTransaction}
          onDelete={handleDeleteTransaction}
        />
      )}

      {/* Generate recurring modal */}
      {generateOpen && (
        <GenerateRecurringModal
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          templates={templates}
          onApply={handleGenerateApply}
        />
      )}

      {/* CSV import modal */}
      {csvOpen && (
        <CSVImportModal
          open={csvOpen}
          onOpenChange={setCsvOpen}
          transactions={transactions}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-[400px] p-5">
          <DialogHeader>
            <DialogTitle className="font-medium">Remove transaction</DialogTitle>
            <DialogDescription>Remove this transaction? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTransaction}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
