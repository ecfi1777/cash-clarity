import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RecurringModal } from '@/components/RecurringModal';
import { formatCurrency } from '@/lib/format';
import {
  useRecurringTemplates,
  useCreateRecurringTemplate,
  useUpdateRecurringTemplate,
  type RecurringTemplate,
} from '@/hooks/use-data';
import { Pencil, X, Plus, Check } from 'lucide-react';

export default function Recurring() {
  const { data: templates = [], isLoading } = useRecurringTemplates();
  const createTemplate = useCreateRecurringTemplate();
  const updateTemplate = useUpdateRecurringTemplate();

  const [addModal, setAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<RecurringTemplate>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleAddSave = (data: { name: string; amount: number; direction: string; type: string; frequency: string; next_due_date: string | null }) => {
    createTemplate.mutate({ ...data, default_amount: data.amount });
    setAddModal(false);
  };

  const startEdit = (t: RecurringTemplate) => {
    setEditingId(t.id);
    setEditValues({
      name: t.name,
      default_amount: t.default_amount,
      direction: t.direction,
      type: t.type,
      frequency: t.frequency,
      next_due_date: t.next_due_date,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateTemplate.mutate({
      id: editingId,
      name: editValues.name,
      default_amount: editValues.default_amount,
      direction: editValues.direction,
      type: editValues.type,
      frequency: editValues.frequency,
      next_due_date: editValues.next_due_date || null,
    });
    setEditingId(null);
    setEditValues({});
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      updateTemplate.mutate({ id: deleteConfirm, is_active: false });
      setDeleteConfirm(null);
      if (editingId === deleteConfirm) cancelEdit();
    }
  };

  const freqVariant = (f: string) => {
    if (f === 'weekly') return 'info' as const;
    if (f === 'quarterly') return 'warning' as const;
    return 'muted' as const;
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Recurring items</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Click the edit icon to modify any item inline. Changes only affect future generated transactions.
          </p>
        </div>
        <Button onClick={() => setAddModal(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add recurring
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Frequency</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Direction</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Description</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
              <th className="text-right py-2 px-2 font-medium text-muted-foreground min-w-amount">Amount</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Next due</th>
              <th className="text-right py-2 px-2 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => {
              const isEditing = editingId === t.id;

              if (isEditing) {
                return (
                  <tr key={t.id} className="border-b bg-muted/30">
                    <td className="py-1.5 px-2">
                      <Select value={editValues.frequency} onValueChange={v => setEditValues(prev => ({ ...prev, frequency: v }))}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-1.5 px-2">
                      <Select value={editValues.direction} onValueChange={v => setEditValues(prev => ({ ...prev, direction: v }))}>
                        <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pmt">Payment</SelectItem>
                          <SelectItem value="dep">Deposit</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-1.5 px-2">
                      <Input
                        value={editValues.name ?? ''}
                        onChange={e => setEditValues(prev => ({ ...prev, name: e.target.value }))}
                        className="h-8"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <Select value={editValues.type} onValueChange={v => setEditValues(prev => ({ ...prev, type: v }))}>
                        <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Check">Check</SelectItem>
                          <SelectItem value="EFT">EFT</SelectItem>
                          <SelectItem value="ACH">ACH</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-1.5 px-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editValues.default_amount ?? ''}
                        onChange={e => setEditValues(prev => ({ ...prev, default_amount: parseFloat(e.target.value) || 0 }))}
                        className="h-8 w-28 text-right"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <Input
                        type="date"
                        value={editValues.next_due_date ?? ''}
                        onChange={e => setEditValues(prev => ({ ...prev, next_due_date: e.target.value || null }))}
                        className="h-8 w-36"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={saveEdit}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={t.id} className="border-b">
                  <td className="py-2 px-2"><Badge variant={freqVariant(t.frequency)}>{t.frequency}</Badge></td>
                  <td className="py-2 px-2">
                    <Badge variant={t.direction === 'pmt' ? 'payment' : 'deposit'}>
                      {t.direction === 'pmt' ? 'payment' : 'deposit'}
                    </Badge>
                  </td>
                  <td className="py-2 px-2">{t.name}</td>
                  <td className="py-2 px-2"><Badge variant="muted">{t.type}</Badge></td>
                  <td className={`py-2 px-2 text-right min-w-amount ${t.direction === 'pmt' ? 'text-payment' : 'text-deposit'}`}>
                    {t.direction === 'pmt' ? '−' : '+'}${formatCurrency(t.default_amount)}
                  </td>
                  <td className="py-2 px-2 text-sm text-muted-foreground">
                    {t.next_due_date ?? '—'}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(t.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No recurring items yet.</p>
        )}
      </div>

      {/* Add modal (only for new items) */}
      {addModal && (
        <RecurringModal
          open={addModal}
          onOpenChange={setAddModal}
          mode="add"
          onSave={handleAddSave}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-[400px] p-5">
          <DialogHeader>
            <DialogTitle className="font-medium">Remove recurring item</DialogTitle>
            <DialogDescription>
              Remove this recurring item? It will no longer appear when generating transactions. Existing entries are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
