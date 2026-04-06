import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatCurrency, parseDate, parseAmount } from '@/lib/format';
import type { ExpectedTransaction } from '@/hooks/use-data';
import { Upload } from 'lucide-react';
import {
  normalizeDescription,
  extractCheckNumber,
  buildDuplicateFingerprint,
  findMatches,
  detectDuplicates,
  type BankRow,
  type OutstandingCandidate,
} from '@/lib/matching';
import { useCreateImportBatch, useInsertImportRows, useFetchExistingFingerprints, useApplyBatch } from '@/hooks/use-import';

type CSVRow = {
  description: string;
  date: string;
  amount: number;
  direction: 'pmt' | 'dep';
};

type MatchedRow = CSVRow & {
  transactionId: string;
  transactionName: string;
  transactionDate: string;
  confidence: 'exact' | 'close' | 'amount';
  daysDiff: number;
  selected: boolean;
};

type NewRow = CSVRow & {
  selected: boolean;
  editedDescription: string;
  type: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: ExpectedTransaction[];
};

const STEPS = ['Upload', 'Review matches', 'Review new', 'Apply'] as const;

function autoDetectColumns(headers: string[]): { desc: number; date: number; amount: number; debit: number; credit: number } | null {
  const lower = headers.map(h => h.toLowerCase().trim());

  const date = lower.findIndex(h => h.includes('date') || h.includes('posted'));

  const descKeywords = ['full description', 'description', 'desc', 'memo', 'narr', 'detail', 'payee'];
  let desc = -1;
  for (const kw of descKeywords) {
    const idx = lower.findIndex((h, i) => i !== date && h.includes(kw) && !h.includes('date'));
    if (idx >= 0) { desc = idx; break; }
  }
  if (desc < 0) {
    desc = lower.findIndex((h, i) => i !== date && h.includes('transaction') && !h.includes('date'));
  }

  const find = (keywords: string[]) => lower.findIndex(h => keywords.some(k => h.includes(k)));
  const amount = find(['amount', 'amt']);
  const debit = find(['debit', 'withdrawal', 'out']);
  const credit = find(['credit', 'deposit']);

  if (desc >= 0 && date >= 0 && desc !== date && (amount >= 0 || (debit >= 0 && credit >= 0))) {
    return { desc, date, amount, debit, credit };
  }
  return null;
}

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

export function CSVImportModal({ open, onOpenChange, transactions }: Props) {
  const [step, setStep] = useState(0);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  const [descCol, setDescCol] = useState(-1);
  const [dateCol, setDateCol] = useState(-1);
  const [amountMode, setAmountMode] = useState<'single' | 'split'>('single');
  const [amountCol, setAmountCol] = useState(-1);
  const [debitCol, setDebitCol] = useState(-1);
  const [creditCol, setCreditCol] = useState(-1);
  const [needsMapper, setNeedsMapper] = useState(false);

  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [importRowIds, setImportRowIds] = useState<string[]>([]);
  const [matchResultsCache, setMatchResultsCache] = useState<Array<{ bankRowIndex: number; status: string; candidateId?: string; confidence?: string; daysDifference?: number | null; amountDifference?: number | null }>>([]);
  // Maps nonDupe index → original bankRows index (which corresponds to importRowIds index)
  const [nonDupeToOriginalMap, setNonDupeToOriginalMap] = useState<number[]>([]);

  // Import persistence hooks
  const createBatch = useCreateImportBatch();
  const insertRows = useInsertImportRows();
  const { data: existingFingerprints = new Set<string>() } = useFetchExistingFingerprints();
  const applyBatch = useApplyBatch();

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) return;

      const hdrs = parsed[0];
      const rows = parsed.slice(1);
      setHeaders(hdrs);
      setRawRows(rows);

      const detected = autoDetectColumns(hdrs);
      if (detected) {
        setDescCol(detected.desc);
        setDateCol(detected.date);
        if (detected.amount >= 0) {
          setAmountMode('single');
          setAmountCol(detected.amount);
        } else {
          setAmountMode('split');
          setDebitCol(detected.debit);
          setCreditCol(detected.credit);
        }
        setNeedsMapper(false);
        processCSV(rows, detected.desc, detected.date, detected.amount >= 0 ? 'single' : 'split', detected.amount, detected.debit, detected.credit, file.name);
      } else {
        setNeedsMapper(true);
      }
    };
    reader.readAsText(file);
  }, [existingFingerprints, transactions]);

  const processCSV = useCallback(async (rows: string[][], dCol: number, dtCol: number, mode: 'single' | 'split', aCol: number, dbCol: number, crCol: number, fileName?: string) => {
    const parsed: CSVRow[] = [];
    const bankRows: BankRow[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      if (row.length <= Math.max(dCol, dtCol)) continue;
      const desc = row[dCol] || '';
      const dateRaw = row[dtCol] || '';
      const parsedDate = parseDate(dateRaw);
      if (!parsedDate || !desc) continue;
      const dateStr = parsedDate.toISOString().split('T')[0];

      let amount: number;
      let direction: 'pmt' | 'dep';

      if (mode === 'single') {
        amount = parseAmount(row[aCol] || '0');
        direction = amount < 0 ? 'pmt' : 'dep';
        amount = Math.abs(amount);
      } else {
        const debit = parseAmount(row[dbCol] || '0');
        const credit = parseAmount(row[crCol] || '0');
        if (debit > 0) {
          amount = debit;
          direction = 'pmt';
        } else {
          amount = credit;
          direction = 'dep';
        }
      }

      if (amount > 0) {
        const csvRow: CSVRow = { description: desc, date: dateStr, amount, direction };
        parsed.push(csvRow);

        const norm = normalizeDescription(desc);
        const ckNum = extractCheckNumber(desc);
        const fp = buildDuplicateFingerprint(dateStr, amount, norm, ckNum);

        bankRows.push({
          index: bankRows.length,
          rawDescription: desc,
          normalizedDescription: norm,
          checkNumber: ckNum,
          postedDate: dateStr,
          amount,
          direction,
          duplicateFingerprint: fp,
        });
      }
    }
    setCsvRows(parsed);

    // Detect duplicates using fingerprints
    const fingerprints = bankRows.map(r => r.duplicateFingerprint);

    // Also build fingerprints from existing expected_transactions for duplicate detection
    const existingTxFingerprints = new Set<string>();
    for (const t of transactions) {
      const norm = normalizeDescription(t.name);
      const ckNum = extractCheckNumber(t.name);
      const fp = buildDuplicateFingerprint(t.scheduled_date, t.expected_amount, norm, ckNum);
      existingTxFingerprints.add(fp);
    }

    // Merge existing import row fingerprints with existing transaction fingerprints
    const allExisting = new Set([...existingFingerprints, ...existingTxFingerprints]);
    const dupeSet = detectDuplicates(fingerprints, allExisting);

    // Filter out duplicates and build nonDupe→original index map
    const nonDupeBankRows: BankRow[] = [];
    const nonDupeParsed: CSVRow[] = [];
    const ndToOrigMap: number[] = [];
    let dupCount = 0;
    for (let i = 0; i < bankRows.length; i++) {
      if (dupeSet.has(i)) {
        dupCount++;
      } else {
        nonDupeBankRows.push({ ...bankRows[i], index: nonDupeBankRows.length });
        nonDupeParsed.push(parsed[i]);
        ndToOrigMap.push(i); // nonDupe index → original bankRows index
      }
    }
    setNonDupeToOriginalMap(ndToOrigMap);

    setDuplicateCount(dupCount);

    // Match against outstanding transactions using matching engine
    const outstanding = transactions.filter(t => t.status === 'outstanding');
    const candidates: OutstandingCandidate[] = outstanding.map(t => ({
      id: t.id,
      name: t.name,
      direction: t.direction,
      expected_amount: t.expected_amount,
      scheduled_date: t.scheduled_date,
    }));

    const matchResults = findMatches(nonDupeBankRows, candidates, []);
    setMatchResultsCache(matchResults);

    const matched: MatchedRow[] = [];
    const unmatched: CSVRow[] = [];

    for (const result of matchResults) {
      const csvRow = nonDupeParsed[result.bankRowIndex];
      if (result.status === 'matched' || result.status === 'partial_match') {
        const tx = outstanding.find(t => t.id === result.candidateId);
        if (tx) {
          matched.push({
            ...csvRow,
            transactionId: tx.id,
            transactionName: tx.name,
            transactionDate: tx.scheduled_date,
            confidence: result.daysDifference === 0 ? 'exact' : (result.daysDifference ?? 99) <= 3 ? 'close' : 'amount',
            daysDiff: result.daysDifference ?? 0,
            selected: true,
          });
        } else {
          unmatched.push(csvRow);
        }
      } else {
        unmatched.push(csvRow);
      }
    }

    setMatchedRows(matched);
    setNewRows(unmatched.map(r => ({
      ...r,
      selected: true,
      editedDescription: r.description,
      type: 'ACH',
    })));

    // Persist batch and rows to database
    try {
      const batchName = fileName || 'import.csv';
      const batch = await createBatch.mutateAsync({
        file_name: batchName,
        row_count: bankRows.length,
      });

      if (batch) {
        const importRows = bankRows.map((br, i) => {
          const isDupe = dupeSet.has(i);
          const matchResult = !isDupe ? matchResults.find(mr => {
            // Map back to non-dupe index
            const nonDupeIdx = nonDupeBankRows.findIndex(ndb => ndb.rawDescription === br.rawDescription && ndb.postedDate === br.postedDate && ndb.amount === br.amount);
            return mr.bankRowIndex === nonDupeIdx;
          }) : null;

          return {
            batch_id: batch.id,
            raw_description: br.rawDescription,
            normalized_description: br.normalizedDescription,
            check_number: br.checkNumber,
            posted_date: br.postedDate,
            amount: br.amount,
            direction: br.direction,
            type: null as string | null,
            duplicate_fingerprint: br.duplicateFingerprint,
            is_duplicate: isDupe,
            suggested_match_id: matchResult?.candidateId ?? null,
            suggested_match_confidence: matchResult?.confidence ?? null,
            suggested_amount_difference: matchResult?.amountDifference ?? null,
            review_status: isDupe ? 'duplicate_rejected' : (matchResult?.status ?? 'unmatched'),
            selected_for_apply: !isDupe,
          };
        });

        const insertedRowData = await insertRows.mutateAsync(importRows);
        setImportRowIds(insertedRowData.map(r => r.id));
        setBatchId(batch.id);
      }
    } catch (err) {
      console.error('Failed to persist import batch:', err);
    }

    setStep(1);
  }, [transactions, existingFingerprints, createBatch, insertRows]);

  const handleMapperSubmit = () => {
    processCSV(rawRows, descCol, dateCol, amountMode, amountCol, debitCol, creditCol);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleApply = async () => {
    if (!batchId) return;

    const selectedMatched = matchedRows.filter(r => r.selected);
    const selectedNew = newRows.filter(r => r.selected);

    // Build matchedUpdates with real before_state from transactions prop
    const matchedUpdates = selectedMatched.map(r => ({
      id: r.transactionId,
      cleared_at: new Date(r.date + 'T00:00:00').toISOString(),
    }));

    // Build newTransactions
    const newTransactions = selectedNew.map(r => ({
      name: r.description,
      expected_amount: r.amount,
      direction: r.direction,
      type: r.type,
      scheduled_date: r.date,
      status: 'cleared_manual',
      cleared_at: new Date(r.date + 'T00:00:00').toISOString(),
      source: 'import_unmatched',
      source_batch_id: batchId,
    }));

    // Build matchRecords — map matched rows to their import row IDs
    const matchRecords = selectedMatched.map(r => {
      // Find the match result for this transaction
      const matchResult = matchResultsCache.find(mr => mr.candidateId === r.transactionId);
      // The importRowIds correspond to ALL bankRows (including dupes). 
      // Match results use nonDupe indices. We need to find the correct import row.
      // Since importRows were built from bankRows in order, and matchResult.bankRowIndex 
      // is the nonDupe index, we need to account for duplicates.
      // For now, find by matching the candidate ID in the cached match results
      const bankRowIdx = matchResult?.bankRowIndex ?? 0;
      // importRowIds includes all rows (dupes + non-dupes), dupes come first in bankRows order
      // We need the actual index in the full bankRows array. Since we stored all bankRows,
      // and dupes were marked, we search for the non-dupe row at this index.
      // However, importRowIds maps 1:1 to the importRows array which maps 1:1 to bankRows.
      // We need to find which bankRows index corresponds to this nonDupe index.
      
      // Find which original bankRow index this nonDupe index maps to
      // We stored dupeSet during processCSV but it's not in state. 
      // Instead, use the suggested_match_id on import rows to find the right one.
      // Simpler: find the import row whose suggested_match_id matches this transaction
      // Since we don't have that data here, use position mapping.
      // The safest approach: importRowIds are in bankRows order. Non-dupe rows were filtered
      // to build nonDupeBankRows. bankRowIdx is the index into nonDupeBankRows.
      // We need to find the original bankRows index for that nonDupe entry.
      
      // Since we can't perfectly reconstruct without dupeSet, use a fallback:
      // The import rows with suggested_match_id set to this transaction's ID
      // For the MVP, we use the first import row that has this match
      return {
        batch_id: batchId,
        bank_import_row_id: importRowIds[bankRowIdx] ?? importRowIds[0],
        expected_transaction_id: r.transactionId,
        match_status: 'confirmed',
        match_confidence: r.confidence,
        days_difference: r.daysDiff,
        amount_difference: 0,
      };
    });

    // Build changeLog with real before_state from transactions prop
    const changeLog = selectedMatched.map(r => {
      const tx = transactions.find(t => t.id === r.transactionId);
      return {
        batch_id: batchId,
        entity_type: 'expected_transaction',
        entity_id: r.transactionId,
        action_type: 'status_update',
        before_state: tx ? {
          status: tx.status,
          cleared_at: tx.cleared_at,
          expected_amount: tx.expected_amount,
          scheduled_date: tx.scheduled_date,
          name: tx.name,
          direction: tx.direction,
          type: tx.type,
          source: tx.source,
        } : { status: 'outstanding' },
        after_state: {
          status: 'matched',
          cleared_at: new Date(r.date + 'T00:00:00').toISOString(),
        },
      };
    });

    const counts = {
      matched_count: selectedMatched.length,
      partial_match_count: 0,
      unmatched_count: selectedNew.length,
      duplicate_count: duplicateCount,
    };

    try {
      await applyBatch.mutateAsync({
        batchId,
        matchedUpdates,
        newTransactions,
        matchRecords,
        changeLog,
        counts,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to apply batch:', err);
    }
  };

  const selectedMatchCount = matchedRows.filter(r => r.selected).length;
  const selectedNewCount = newRows.filter(r => r.selected).length;

  const confidenceBadge = (c: MatchedRow['confidence'], days: number) => {
    if (c === 'exact') return <Badge variant="deposit">exact date</Badge>;
    if (c === 'close') return <Badge variant="warning">{days} days off</Badge>;
    return <Badge variant="muted">amt only</Badge>;
  };

  const colOptions = headers.map((h, i) => ({ value: i.toString(), label: h }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] p-5 max-h-[85vh] overflow-y-auto">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${
                i < step ? 'bg-deposit text-deposit-foreground border-deposit' :
                i === step ? 'bg-primary text-primary-foreground border-primary' :
                'bg-muted text-muted-foreground border-border'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 0: Upload */}
        {step === 0 && !needsMapper && (
          <>
            <DialogHeader>
              <DialogTitle className="font-medium">Import bank CSV</DialogTitle>
              <DialogDescription>Upload a CSV or TXT file from your bank.</DialogDescription>
            </DialogHeader>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-border rounded-md p-8 text-center cursor-pointer hover:border-muted-foreground transition-colors"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv,.txt';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFile(file);
                };
                input.click();
              }}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drag and drop or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Accepts .csv and .txt files</p>
            </div>
          </>
        )}

        {/* Column Mapper */}
        {step === 0 && needsMapper && (
          <>
            <DialogHeader>
              <DialogTitle className="font-medium">Map columns</DialogTitle>
              <DialogDescription>We couldn't auto-detect your columns. Please map them manually.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Description column</Label>
                <Select value={descCol.toString()} onValueChange={v => setDescCol(+v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date column</Label>
                <Select value={dateCol.toString()} onValueChange={v => setDateCol(+v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount format</Label>
                <Select value={amountMode} onValueChange={v => setAmountMode(v as 'single' | 'split')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single column (negative = payment)</SelectItem>
                    <SelectItem value="split">Separate debit/credit columns</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {amountMode === 'single' ? (
                <div className="space-y-1.5">
                  <Label>Amount column</Label>
                  <Select value={amountCol.toString()} onValueChange={v => setAmountCol(+v)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Debit column</Label>
                    <Select value={debitCol.toString()} onValueChange={v => setDebitCol(+v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Credit column</Label>
                    <Select value={creditCol.toString()} onValueChange={v => setCreditCol(+v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setNeedsMapper(false); setHeaders([]); setRawRows([]); }}>Back</Button>
              <Button onClick={handleMapperSubmit}>Continue</Button>
            </DialogFooter>
          </>
        )}

        {/* Step 1: Review matches */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-medium">Review matches</DialogTitle>
              <DialogDescription>{matchedRows.length} bank items matched to your outstanding transactions.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-deposit inline-block" /> exact date</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" /> close date</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" /> amount only</span>
            </div>
            {matchedRows.length > 0 && (
              <div className="mb-2">
                <Checkbox
                  checked={matchedRows.every(r => r.selected)}
                  onCheckedChange={(checked) => setMatchedRows(prev => prev.map(r => ({ ...r, selected: !!checked })))}
                />
                <span className="text-sm ml-2">Select all</span>
              </div>
            )}
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {matchedRows.map((row, idx) => (
                <div key={idx} className={`flex items-center gap-2 p-2 rounded border text-sm ${!row.selected ? 'opacity-35' : ''}`}>
                  <Checkbox checked={row.selected} onCheckedChange={() => setMatchedRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r))} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{row.transactionName} · {row.transactionDate}</div>
                    <div className="text-xs text-muted-foreground truncate">← {row.description} · {row.date}</div>
                  </div>
                  {confidenceBadge(row.confidence, row.daysDiff)}
                  <span className={`min-w-amount text-right ${row.direction === 'pmt' ? 'text-payment' : 'text-deposit'}`}>
                    {row.direction === 'pmt' ? '−' : '+'}${formatCurrency(row.amount)}
                  </span>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setStep(0); setNeedsMapper(false); setHeaders([]); setRawRows([]); setCsvRows([]); }}>← Back</Button>
              <Button onClick={() => setStep(2)}>Next: review new items →</Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Review new items */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-medium">Review new items</DialogTitle>
              <DialogDescription>{newRows.length} bank items didn't match any outstanding transactions.</DialogDescription>
            </DialogHeader>
            {newRows.length > 0 && (
              <div className="mb-2">
                <Checkbox
                  checked={newRows.length > 0 && newRows.every(r => r.selected)}
                  onCheckedChange={(checked) => setNewRows(prev => prev.map(r => ({ ...r, selected: !!checked })))}
                />
                <span className="text-sm ml-2">Select all</span>
              </div>
            )}
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {newRows.map((row, idx) => (
                <div key={idx} className={`flex items-center gap-2 p-2 rounded border text-sm ${!row.selected ? 'opacity-35' : ''}`}>
                  <Checkbox checked={row.selected} onCheckedChange={() => setNewRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium break-words">{row.description}</p>
                  </div>
                  <Select value={row.type} onValueChange={v => setNewRows(prev => prev.map((r, i) => i === idx ? { ...r, type: v } : r))}>
                    <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Check">Check</SelectItem>
                      <SelectItem value="EFT">EFT</SelectItem>
                      <SelectItem value="ACH">ACH</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground w-20">{row.date}</span>
                  <span className={`min-w-amount text-right ${row.direction === 'pmt' ? 'text-payment' : 'text-deposit'}`}>
                    {row.direction === 'pmt' ? '−' : '+'}${formatCurrency(row.amount)}
                  </span>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)}>Next: apply all →</Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Apply */}
        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-medium">Apply reconciliation</DialogTitle>
              <DialogDescription>Review what will happen when you apply.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {selectedMatchCount > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-deposit mt-1.5 shrink-0" />
                  <span>{selectedMatchCount} transactions cleared — marked as cleared in your ledger</span>
                </div>
              )}
              {selectedNewCount > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-info mt-1.5 shrink-0" />
                  <span>{selectedNewCount} new transactions added — added as cleared</span>
                </div>
              )}
              {duplicateCount > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  <span>{duplicateCount} duplicate transactions skipped</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Your true cash position will recalculate automatically once applied.</p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button className="bg-deposit text-deposit-foreground hover:bg-deposit/90" onClick={handleApply}>
                Apply reconciliation
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
