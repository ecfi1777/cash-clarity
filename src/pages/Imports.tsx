import { useNavigate } from 'react-router-dom';
import { useImportBatches } from '@/hooks/use-import';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

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
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Matched</TableHead>
                <TableHead className="text-right">Partial</TableHead>
                <TableHead className="text-right">Unmatched</TableHead>
                <TableHead className="text-right">Dupes</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell className="text-right">{b.row_count}</TableCell>
                  <TableCell className="text-right">{b.matched_count}</TableCell>
                  <TableCell className="text-right">{b.partial_match_count}</TableCell>
                  <TableCell className="text-right">{b.unmatched_count}</TableCell>
                  <TableCell className="text-right">{b.duplicate_count}</TableCell>
                  <TableCell>{statusBadge(b.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
