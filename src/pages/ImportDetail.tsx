import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  useImportBatchDetail,
  useImportBatchRows,
  useImportBatchChangeLog,
  useRollbackBatch,
} from '@/hooks/use-import';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import { toast } from 'sonner';

const statusBadge = (status: string) => {
  switch (status) {
    case 'applied':
      return <Badge variant="deposit">Applied</Badge>;
    case 'rolled_back':
      return <Badge variant="destructive">Rolled back</Badge>;
    case 'partial_rollback':
      return <Badge variant="warning">Partial rollback</Badge>;
    default:
      return <Badge variant="muted">{status}</Badge>;
  }
};

function RowTable({ rows }: { rows: Array<{ id: string; raw_description: string; posted_date: string; amount: number; direction: string; review_status: string }> }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-4">No rows in this category.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Description</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(r => (
          <TableRow key={r.id}>
            <TableCell className="truncate max-w-[300px]">{r.raw_description}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.posted_date}</TableCell>
            <TableCell className={`text-right ${r.direction === 'pmt' ? 'text-payment' : 'text-deposit'}`}>
              {r.direction === 'pmt' ? '−' : '+'}${formatCurrency(r.amount)}
            </TableCell>
            <TableCell><Badge variant="muted">{r.review_status}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ImportDetail() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { data: batch, isLoading: batchLoading } = useImportBatchDetail(batchId);
  const { data: rows = [] } = useImportBatchRows(batchId);
  const { data: changeLog = [] } = useImportBatchChangeLog(batchId);
  const rollback = useRollbackBatch();

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackNotes, setRollbackNotes] = useState('');

  const matchedRows = rows.filter(r => r.review_status === 'applied' && r.suggested_match_confidence && !r.suggested_amount_difference);
  const partialRows = rows.filter(r => r.review_status === 'applied' && r.suggested_amount_difference && r.suggested_amount_difference > 0);
  const unmatchedRows = rows.filter(r => r.review_status === 'applied' && !r.suggested_match_id);
  const dupeRows = rows.filter(r => r.is_duplicate);

  const handleRollback = async () => {
    if (!batchId) return;
    try {
      await rollback.mutateAsync({ batchId, rollbackNotes: rollbackNotes || undefined });
      toast.success('Batch rolled back successfully');
      setRollbackOpen(false);
      navigate('/imports');
    } catch (err) {
      toast.error(`Rollback failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (batchLoading) return <div className="max-w-5xl mx-auto px-4 py-6"><p className="text-sm text-muted-foreground">Loading…</p></div>;
  if (!batch) return <div className="max-w-5xl mx-auto px-4 py-6"><p className="text-sm text-muted-foreground">Batch not found.</p></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/imports')} className="mb-4 text-muted-foreground">
        ← Back to imports
      </Button>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-medium">{batch.file_name}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(batch.imported_at), 'MMM d, yyyy h:mm a')} · {batch.row_count} rows
          </p>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge(batch.status)}
          {batch.status === 'applied' && (
            <Button variant="destructive" size="sm" onClick={() => setRollbackOpen(true)}>
              Rollback
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4 text-center">
        <div className="border rounded p-3">
          <div className="text-2xl font-medium">{batch.matched_count}</div>
          <div className="text-xs text-muted-foreground">Matched</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-2xl font-medium">{batch.partial_match_count}</div>
          <div className="text-xs text-muted-foreground">Partial</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-2xl font-medium">{batch.unmatched_count}</div>
          <div className="text-xs text-muted-foreground">Unmatched</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-2xl font-medium">{batch.duplicate_count}</div>
          <div className="text-xs text-muted-foreground">Duplicates</div>
        </div>
      </div>

      <Tabs defaultValue="matched">
        <TabsList>
          <TabsTrigger value="matched">Matched</TabsTrigger>
          <TabsTrigger value="partial">Partial</TabsTrigger>
          <TabsTrigger value="unmatched">Unmatched</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          <TabsTrigger value="changelog">Change Log</TabsTrigger>
        </TabsList>
        <TabsContent value="matched"><RowTable rows={matchedRows} /></TabsContent>
        <TabsContent value="partial"><RowTable rows={partialRows} /></TabsContent>
        <TabsContent value="unmatched"><RowTable rows={unmatchedRows} /></TabsContent>
        <TabsContent value="duplicates"><RowTable rows={dupeRows} /></TabsContent>
        <TabsContent value="changelog">
          {changeLog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No change log entries.</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {changeLog.map(entry => (
                <div key={entry.id} className="border rounded p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="muted">{entry.action_type}</Badge>
                    <span className="text-muted-foreground">{entry.entity_type}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Before / After</summary>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <pre className="bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(entry.before_state, null, 2)}</pre>
                      <pre className="bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(entry.after_state, null, 2)}</pre>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rollback Dialog */}
      <Dialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback import</DialogTitle>
            <DialogDescription>
              This will undo all changes from this import: matched transactions will be restored to outstanding,
              new transactions will be deleted, and all adjustments will be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm">
              <strong>Impact:</strong> {batch.matched_count} matches, {batch.partial_match_count} partial matches,
              {' '}{batch.unmatched_count} new transactions will be reverted.
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={rollbackNotes}
                onChange={e => setRollbackNotes(e.target.value)}
                placeholder="Reason for rollback…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRollback} disabled={rollback.isPending}>
              {rollback.isPending ? 'Rolling back…' : 'Confirm rollback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
