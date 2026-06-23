import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useExpectedTransactions, useUpdateExpectedTransaction } from '@/hooks/use-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft } from 'lucide-react';

// A row "needs a vendor" if it came in from a CSV import as an unmatched
// row and still has a placeholder/raw-bank-description style name.
const PLACEHOLDER_RE = /^(check\s*#?\s*\d+|chk\s*\d+|unnamed)/i;

function needsVendor(name: string | null | undefined): boolean {
  if (!name || !name.trim()) return true;
  if (PLACEHOLDER_RE.test(name.trim())) return true;
  // Raw bank descriptions for checks commonly start with the word CHECK
  if (/\bcheck\b/i.test(name) && /\d{3,}/.test(name)) return true;
  return false;
}

export default function UnmatchedChecks() {
  const { data: transactions = [], isLoading } = useExpectedTransactions();
  const update = useUpdateExpectedTransaction();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    return transactions
      .filter(t =>
        t.check_number &&
        (t.source === 'import_unmatched' || t.source === 'import') &&
        needsVendor(t.name)
      )
      .sort((a, b) => (a.scheduled_date < b.scheduled_date ? 1 : -1));
  }, [transactions]);

  const handleSave = async (id: string) => {
    const value = (drafts[id] ?? '').trim();
    if (!value) {
      toast({ title: 'Enter a vendor name first', variant: 'destructive' });
      return;
    }
    try {
      await update.mutateAsync({ id, updates: { name: value } as any });
      setDrafts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast({ title: 'Vendor saved' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link to="/reports" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2">
        <ChevronLeft className="w-3 h-3 mr-1" /> Reports
      </Link>
      <h1 className="text-lg font-medium mb-1">Unmatched Checks</h1>
      <p className="text-xs text-muted-foreground mb-4">
        Imported checks that don't have a vendor name yet. Enter a name and save to clear it from this list.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No unmatched checks. Nice work.</p>
      ) : (
        <div className="overflow-x-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Date</TableHead>
                <TableHead className="w-24">Check #</TableHead>
                <TableHead className="text-right w-28">Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-64">Vendor</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.scheduled_date}</TableCell>
                  <TableCell className="text-xs font-mono">{r.check_number}</TableCell>
                  <TableCell className="text-right text-payment min-w-amount">
                    −${formatCurrency(r.expected_amount)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground break-words max-w-xs">{r.name}</TableCell>
                  <TableCell>
                    <Input
                      value={drafts[r.id] ?? ''}
                      placeholder="Vendor name"
                      onChange={e => setDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(r.id); }}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleSave(r.id)}
                      disabled={!drafts[r.id]?.trim() || update.isPending}
                    >
                      Save
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
