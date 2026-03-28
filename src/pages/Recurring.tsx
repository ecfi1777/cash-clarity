import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RecurringModal } from '@/components/RecurringModal';
import { formatCurrency } from '@/lib/format';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  type Template,
} from '@/hooks/use-data';
import { Pencil, X, Plus } from 'lucide-react';

export default function Recurring() {
  const { data: templates = [], isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; template?: Template }>({ open: false, mode: 'add' });

  const handleSave = (data: { name: string; amount: number; direction: string; type: string; frequency: string }) => {
    if (modal.mode === 'add') {
      createTemplate.mutate(data);
    } else if (modal.template) {
      updateTemplate.mutate({ id: modal.template.id, ...data });
    }
    setModal({ open: false, mode: 'add' });
  };

  const handleDelete = () => {
    if (modal.template) {
      updateTemplate.mutate({ id: modal.template.id, is_active: false });
    }
    setModal({ open: false, mode: 'add' });
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
            Editing a recurring item only affects future generated transactions — existing entries are never changed.
          </p>
        </div>
        <Button onClick={() => setModal({ open: true, mode: 'add' })}>
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
              <th className="text-right py-2 px-2 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => (
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
                  {t.direction === 'pmt' ? '−' : '+'}${formatCurrency(t.amount)}
                </td>
                <td className="py-2 px-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setModal({ open: true, mode: 'edit', template: t })}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setModal({ open: true, mode: 'edit', template: t })}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No recurring items yet.</p>
        )}
      </div>

      {modal.open && (
        <RecurringModal
          open={modal.open}
          onOpenChange={open => setModal(prev => ({ ...prev, open }))}
          mode={modal.mode}
          initial={modal.template ? {
            id: modal.template.id,
            name: modal.template.name,
            amount: modal.template.amount,
            direction: modal.template.direction,
            type: modal.template.type,
            frequency: modal.template.frequency,
          } : undefined}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
