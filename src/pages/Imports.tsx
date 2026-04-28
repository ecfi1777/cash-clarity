import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useImportBatches, useDeleteDraftBatch } from '@/hooks/use-import';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

export default function Imports() {
  const { data: batches = [], isLoading } = useImportBatches();
  const navigate = useNavigate();
  const deleteDraft = useDeleteDraftBatch();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDraft.mutateAsync(deleteId);
      toast({ title: 'Draft deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-lg font-medium mb-4">Import history</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No imports yet.</p>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Import Date</TableHead>
                <TableHead>Last Transaction Date</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Matched</TableHead>
                <TableHead className="text-right">Partial</TableHead>
                <TableHead className="text-right">Unmatched</TableHead>
                <TableHead className="text-right">Dupes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map(b => (
                <TableRow
                  key={b.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/imports/${b.id}`)}
                >
                  <TableCell className="font-medium truncate max-w-[200px]">{b.file_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(b.imported_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.statement_end_date
                      ? format(new Date(b.statement_end_date + 'T00:00:00'), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">{b.row_count}</TableCell>
                  <TableCell className="text-right">{b.matched_count}</TableCell>
                  <TableCell className="text-right">{b.partial_match_count}</TableCell>
                  <TableCell className="text-right">{b.unmatched_count}</TableCell>
                  <TableCell className="text-right">{b.duplicate_count}</TableCell>
                  <TableCell>{statusBadge(b.status)}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    {b.status === 'draft' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Delete draft"
                        aria-label="Delete draft"
                        onClick={() => setDeleteId(b.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft import?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the draft and its imported rows. Nothing on the dashboard will change because a draft has not been applied.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteDraft.isPending}>
              {deleteDraft.isPending ? 'Deleting…' : 'Delete draft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
