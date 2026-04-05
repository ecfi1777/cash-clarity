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
  useTransactions,
  useBankBalance,
  useTemplates,
  useUpdateBankBalance,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useBulkInsertTransactions,
  useBulkUpdateTransactions,
  type Transaction,
} from '@/hooks/use-data';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, RefreshCw, Upload } from 'lucide-react';

export default function Dashboard() {
  const { data: transactions = [], isLoading: txLoading } = useTransactions();
  const { data: bankBalanceRow, isLoading: bbLoading } = useBankBalance();
  const { data: templates = [] } = useTemplates();
  const updateBankBalance = useUpdateBankBalance();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const bulkInsert = useBulkInsertTransactions();
  const bulkUpdate = useBulkUpdateTransactions();
  const queryClient = useQueryClient();

  const [bankInput, setBankInput] = useState<string | null>(null);
  const [txModal, setTxModal] = useState<{ open: boolean; mode: 'add' | 'edit'; direction: 'pmt' | 'dep'; tx?: Transaction }>({ open: false, mode: 'add', direction: 'pmt' });
  const [generateOpen, setGenerateOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const bankBalance = bankBalanceRow?.balance ?? 0;
  const displayBankInput = bankInput ?? bankBalance.toString();

  const outstanding = useMemo(() =>
    transactions.filter(t => !t.cleared && t.direction === 'pmt').sort((a, b) => a.date.localeCompare(b.date)),
    [transactions]
  );

  const pending = useMemo(() =>
    transactions.filter(t => !t.cleared && t.direction === 'dep').sort((a, b) => a.date.localeCompare(b.date)),
    [transactions]
  );

  const recentlyCleared = useMemo(() =>
    transactions
      .filter(t => t.cleared)
      .sort((a, b) => (b.cleared_date ?? '').localeCompare(a.cleared_date ?? ''))
      .slice(0, 5),
    [transactions]
  );

  const outstandingTotal = outstanding.reduce((s, t) => s + t.amount, 0);
  const pendingTotal = pending.reduce((s, t) => s + t.amount, 0);
  const tcp = bankBalance - outstandingTotal + pendingTotal;

  const handleBankBalanceChange = () => {
    const val = parseFloat(displayBankInput);
    if (!isNaN(val)) {
      updateBankBalance.mutate(val);
      setBankInput(null);
    }
  };

  const handleToggleCleared = (id: string, cleared: boolean) => {
    updateTransaction.mutate({
      id,
      cleared,
      cleared_date: cleared ? todayStr() : null,
    });
  };

  const handleDateChange = (id: string, date: string) => {
    updateTransaction.mutate({ id, date });
  };

  const handleSaveTransaction = (data: { name: string; amount: number; date: string; type: string }) => {
    if (txModal.mode === 'add') {
      createTransaction.mutate({
        ...data,
        direction: txModal.direction,
        cleared: false,
        is_recurring: false,
      });
    } else if (txModal.tx) {
      updateTransaction.mutate({ id: txModal.tx.id, ...data });
    }
    setTxModal(prev => ({ ...prev, open: false }));
  };

  const handleDeleteTransaction = () => {
    if (deleteConfirm) {
      deleteTransaction.mutate(deleteConfirm);
      setDeleteConfirm(null);
    } else if (txModal.tx) {
      deleteTransaction.mutate(txModal.tx.id);
      setTxModal(prev => ({ ...prev, open: false }));
    }
  };

  const handleGenerateApply = async (items: Array<{ name: string; amount: number; direction: string; type: string; date: string; template_id: string }>) => {
    await bulkInsert.mutateAsync(items.map(i => ({
      ...i,
      cleared: false,
      is_recurring: true,
    })));

    // Update last_generated_date and advance next_due_date on templates
    const templateIds = [...new Set(items.map(i => i.template_id))];
    for (const tid of templateIds) {
      // Find the latest date generated for this template
      const templateItems = items.filter(i => i.template_id === tid);
      const latestDate = templateItems.reduce((max, i) => i.date > max ? i.date : max, templateItems[0].date);
      
      // Calculate next due date by advancing one period from the latest generated date
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
      
      await supabase.from('templates').update({ 
        last_generated_date: latestDate,
        next_due_date: nextDue,
      }).eq('id', tid);
    }
    queryClient.invalidateQueries({ queryKey: ['templates'] });
    setGenerateOpen(false);
  };

  const handleCSVApply = async (data: {
    cleared: Array<{ id: string; cleared_date: string }>;
    newItems: Array<{ name: string; amount: number; direction: string; type: string; date: string; cleared: boolean; cleared_date: string }>;
  }) => {
    if (data.cleared.length > 0) {
      await bulkUpdate.mutateAsync(data.cleared.map(c => ({
        id: c.id,
        cleared: true,
        cleared_date: c.cleared_date,
      })));
    }
    if (data.newItems.length > 0) {
      await bulkInsert.mutateAsync(data.newItems.map(i => ({
        ...i,
        is_recurring: false,
      })));
    }
    setCsvOpen(false);
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
          <Badge variant="payment">{outstanding.length} outstanding · −${formatCurrency(outstandingTotal)}</Badge>
        </div>
        {outstanding.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No outstanding payments.</p>
        ) : (
          <TransactionTable
            transactions={outstanding}
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
          <Badge variant="deposit">{pending.length} pending · +${formatCurrency(pendingTotal)}</Badge>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No pending deposits.</p>
        ) : (
          <TransactionTable
            transactions={pending}
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
            <h2 className="text-base font-medium mb-3">Recently cleared</h2>
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

      {/* Transaction modal */}
      {txModal.open && (
        <TransactionModal
          open={txModal.open}
          onOpenChange={open => setTxModal(prev => ({ ...prev, open }))}
          mode={txModal.mode}
          direction={txModal.direction}
          initial={txModal.tx ? { id: txModal.tx.id, name: txModal.tx.name, amount: txModal.tx.amount, date: txModal.tx.date, type: txModal.tx.type } : undefined}
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
          onApply={handleCSVApply}
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
