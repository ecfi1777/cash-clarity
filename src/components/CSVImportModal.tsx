import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import {
  useCreateImportBatch,
  useInsertImportRows,
  useFetchExistingFingerprints,
  useApplyBatch,
  type AdjustmentInput,
  type TemplateUpdate,
} from '@/hooks/use-import';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  bankImportRowId: string;
  amountDifference: number | null;
};

type PartialMatchRow = CSVRow & {
  transactionId: string;
  transactionName: string;
  transactionDate: string;
  expectedAmount: number;
  bankImportRowId: string;
  daysDiff: number;
  confidence: string;
  recurringTemplateId: string | null;
  decision: null | 'accept_bank' | 'accept_expected' | 'reject';
  updateTemplate: boolean;
};

type NewRow = CSVRow & {
  selected: boolean;
  editedDescription: string;
  type: string;
  bankImportRowId: string;
};

type DuplicateRow = CSVRow & {
  bankImportRowId: string;
  duplicateFingerprint: string;
  forceIncluded: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: ExpectedTransaction[];
};

const STEPS = ['Upload', 'Matched', 'Partial matches', 'Unmatched', 'Duplicates', 'Apply'] as const;

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
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; } else { current += ch; }
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
  const [partialMatchRows, setPartialMatchRows] = useState<PartialMatchRow[]>([]);
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<DuplicateRow[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [batchId, setBatchId] = useState<string | null>(null);

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
        if (detected.amount >= 0) { setAmountMode('single'); setAmountCol(detected.amount); }
        else { setAmountMode('split'); setDebitCol(detected.debit); setCreditCol(detected.credit); }
        setNeedsMapper(false);
        processCSV(rows, detected.desc, detected.date, detected.amount >= 0 ? 'single' : 'split', detected.amount, detected.debit, detected.credit, file.name);
      } else { setNeedsMapper(true); }
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
        if (debit > 0) { amount = debit; direction = 'pmt'; }
        else { amount = credit; direction = 'dep'; }
      }

      if (amount > 0) {
        const csvRow: CSVRow = { description: desc, date: dateStr, amount, direction };
        parsed.push(csvRow);
        const norm = normalizeDescription(desc);
        const ckNum = extractCheckNumber(desc);
        const fp = buildDuplicateFingerprint(dateStr, amount, norm, ckNum);
        bankRows.push({ index: bankRows.length, rawDescription: desc, normalizedDescription: norm, checkNumber: ckNum, postedDate: dateStr, amount, direction, duplicateFingerprint: fp });
      }
    }
    setCsvRows(parsed);

    // Detect duplicates
    const fingerprints = bankRows.map(r => r.duplicateFingerprint);
    const existingTxFingerprints = new Set<string>();
    for (const t of transactions) {
      const norm = normalizeDescription(t.name);
      const ckNum = extractCheckNumber(t.name);
      const fp = buildDuplicateFingerprint(t.scheduled_date, t.expected_amount, norm, ckNum);
      existingTxFingerprints.add(fp);
    }
    const allExisting = new Set([...existingFingerprints, ...existingTxFingerprints]);
    const dupeSet = detectDuplicates(fingerprints, allExisting);

    // Filter non-dupes
    const nonDupeBankRows: BankRow[] = [];
    const nonDupeParsed: CSVRow[] = [];
    const ndToOrigMap: number[] = [];
    let dupCount = 0;
    for (let i = 0; i < bankRows.length; i++) {
      if (dupeSet.has(i)) { dupCount++; }
      else { nonDupeBankRows.push({ ...bankRows[i], index: nonDupeBankRows.length }); nonDupeParsed.push(parsed[i]); ndToOrigMap.push(i); }
    }
    setDuplicateCount(dupCount);

    // Match
    const outstanding = transactions.filter(t => t.status === 'outstanding');
    const candidates: OutstandingCandidate[] = outstanding.map(t => ({ id: t.id, name: t.name, direction: t.direction, expected_amount: t.expected_amount, scheduled_date: t.scheduled_date }));
    const matchResults = findMatches(nonDupeBankRows, candidates, []);

    // Persist batch + rows
    let insertedRowIds: string[] = [];
    let createdBatchId: string | null = null;
    try {
      const batch = await createBatch.mutateAsync({ file_name: fileName || 'import.csv', row_count: bankRows.length });
      if (batch) {
        createdBatchId = batch.id;
        const importRows = bankRows.map((br, i) => {
          const isDupe = dupeSet.has(i);
          const nonDupeIdx = ndToOrigMap.indexOf(i);
          const matchResult = (!isDupe && nonDupeIdx >= 0) ? matchResults.find(mr => mr.bankRowIndex === nonDupeIdx) : null;
          return {
            batch_id: batch.id, raw_description: br.rawDescription, normalized_description: br.normalizedDescription,
            check_number: br.checkNumber, posted_date: br.postedDate, amount: br.amount, direction: br.direction,
            type: null as string | null, duplicate_fingerprint: br.duplicateFingerprint, is_duplicate: isDupe,
            suggested_match_id: matchResult?.candidateId ?? null, suggested_match_confidence: matchResult?.confidence ?? null,
            suggested_amount_difference: matchResult?.amountDifference ?? null,
            review_status: isDupe ? 'duplicate_rejected' : (matchResult?.status ?? 'unmatched'),
            selected_for_apply: !isDupe,
          };
        });
        const insertedRowData = await insertRows.mutateAsync(importRows);
        insertedRowIds = insertedRowData.map(r => r.id);
        setBatchId(batch.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to persist import batch:', msg, err);
      toast.error(`Failed to create import batch: ${msg}`);
      return;
    }

    // Build matched, partial, unmatched, duplicate state
    const matched: MatchedRow[] = [];
    const partial: PartialMatchRow[] = [];
    const unmatched: Array<CSVRow & { bankImportRowId: string }> = [];

    for (const result of matchResults) {
      const csvRow = nonDupeParsed[result.bankRowIndex];
      const originalIdx = ndToOrigMap[result.bankRowIndex];
      const bankImportRowId = insertedRowIds[originalIdx] ?? '';

      if (result.status === 'matched') {
        const tx = outstanding.find(t => t.id === result.candidateId);
        if (tx) {
          matched.push({
            ...csvRow, transactionId: tx.id, transactionName: tx.name, transactionDate: tx.scheduled_date,
            confidence: result.daysDifference === 0 ? 'exact' : (result.daysDifference ?? 99) <= 3 ? 'close' : 'amount',
            daysDiff: result.daysDifference ?? 0, selected: true, bankImportRowId,
            amountDifference: result.amountDifference ?? null,
          });
        } else { unmatched.push({ ...csvRow, bankImportRowId }); }
      } else if (result.status === 'partial_match') {
        const tx = outstanding.find(t => t.id === result.candidateId);
        if (tx) {
          partial.push({
            ...csvRow, transactionId: tx.id, transactionName: tx.name, transactionDate: tx.scheduled_date,
            expectedAmount: tx.expected_amount, bankImportRowId,
            daysDiff: result.daysDifference ?? 0, confidence: result.confidence,
            recurringTemplateId: tx.recurring_template_id ?? null,
            decision: null, updateTemplate: false,
          });
        } else { unmatched.push({ ...csvRow, bankImportRowId }); }
      } else {
        unmatched.push({ ...csvRow, bankImportRowId });
      }
    }

    // Build duplicate rows for review
    const dupes: DuplicateRow[] = [];
    for (let i = 0; i < bankRows.length; i++) {
      if (dupeSet.has(i)) {
        dupes.push({
          ...parsed[i], bankImportRowId: insertedRowIds[i] ?? '',
          duplicateFingerprint: bankRows[i].duplicateFingerprint, forceIncluded: false,
        });
      }
    }

    setMatchedRows(matched);
    setPartialMatchRows(partial);
    setNewRows(unmatched.map(r => ({ ...r, selected: true, editedDescription: r.description, type: 'ACH' })));
    setDuplicateRows(dupes);
    setStep(1);
  }, [transactions, existingFingerprints, createBatch, insertRows]);

  const handleMapperSubmit = () => { processCSV(rawRows, descCol, dateCol, amountMode, amountCol, debitCol, creditCol); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleFile(file); };

  // Force-include a duplicate → move to unmatched pool
  const handleForceInclude = async (idx: number) => {
    const dupe = duplicateRows[idx];
    if (!dupe || !batchId) return;

    // Update bank_import_rows in DB
    try {
      await supabase
        .from('bank_import_rows' as any)
        .update({ is_duplicate: false, review_status: 'unmatched' } as any)
        .eq('id', dupe.bankImportRowId);

      // Log to batch_change_log
      await supabase
        .from('batch_change_log' as any)
        .insert({
          batch_id: batchId,
          entity_type: 'bank_import_row',
          entity_id: dupe.bankImportRowId,
          action_type: 'force_include',
          before_state: { is_duplicate: true, review_status: 'duplicate_rejected' },
          after_state: { is_duplicate: false, review_status: 'unmatched' },
        } as any);
    } catch (err) {
      console.error('Failed to force-include duplicate:', err);
    }

    // Move to unmatched pool
    setDuplicateRows(prev => prev.map((d, i) => i === idx ? { ...d, forceIncluded: true } : d));
    setNewRows(prev => [...prev, {
      ...dupe, selected: true, editedDescription: dupe.description, type: 'ACH',
    }]);
    setDuplicateCount(prev => Math.max(0, prev - 1));
  };

  // Advance from partial match step: move rejected partials to unmatched
  const advanceFromPartialMatch = () => {
    const rejected = partialMatchRows.filter(r => r.decision === 'reject');
    if (rejected.length > 0) {
      setNewRows(prev => [
        ...prev,
        ...rejected.map(r => ({
          description: r.description, date: r.date, amount: r.amount, direction: r.direction,
          selected: true, editedDescription: r.description, type: 'ACH', bankImportRowId: r.bankImportRowId,
        })),
      ]);
    }
    setStep(3);
  };

  const allPartialDecided = partialMatchRows.length === 0 || partialMatchRows.every(r => r.decision !== null);

  const handleApply = async () => {
    if (!batchId) return;

    const selectedMatched = matchedRows.filter(r => r.selected);
    const selectedNew = newRows.filter(r => r.selected);
    const acceptedPartials = partialMatchRows.filter(r => r.decision === 'accept_bank' || r.decision === 'accept_expected');

    // Matched updates: both exact matches and accepted partials
    const matchedUpdates = [
      ...selectedMatched.map(r => ({ id: r.transactionId, cleared_at: new Date(r.date + 'T00:00:00').toISOString() })),
      ...acceptedPartials.map(r => ({ id: r.transactionId, cleared_at: new Date(r.date + 'T00:00:00').toISOString() })),
    ];

    const newTransactions = selectedNew.map(r => ({
      name: r.editedDescription || r.description, expected_amount: r.amount, direction: r.direction, type: r.type,
      scheduled_date: r.date, status: 'cleared_manual', cleared_at: new Date(r.date + 'T00:00:00').toISOString(),
      source: 'import_unmatched', source_batch_id: batchId,
    }));

    // Match records: exact matches + accepted partials
    const matchRecords = [
      ...selectedMatched.map(r => ({
        batch_id: batchId, bank_import_row_id: r.bankImportRowId, expected_transaction_id: r.transactionId,
        match_status: 'confirmed', match_confidence: r.confidence, days_difference: r.daysDiff,
        amount_difference: r.amountDifference ?? 0,
      })),
      ...acceptedPartials.map(r => ({
        batch_id: batchId, bank_import_row_id: r.bankImportRowId, expected_transaction_id: r.transactionId,
        match_status: 'confirmed', match_confidence: r.confidence, days_difference: r.daysDiff,
        amount_difference: Math.abs(r.amount - r.expectedAmount),
      })),
    ];

    // Change log for exact matches
    const changeLog = selectedMatched.map(r => {
      const tx = transactions.find(t => t.id === r.transactionId);
      return {
        batch_id: batchId, entity_type: 'expected_transaction', entity_id: r.transactionId, action_type: 'status_update',
        before_state: tx ? { status: tx.status, cleared_at: tx.cleared_at, expected_amount: tx.expected_amount, scheduled_date: tx.scheduled_date, name: tx.name, direction: tx.direction, type: tx.type, source: tx.source } : { status: 'outstanding' },
        after_state: { status: 'matched', cleared_at: new Date(r.date + 'T00:00:00').toISOString() },
      };
    });

    // Change log for accepted partials
    for (const r of acceptedPartials) {
      const tx = transactions.find(t => t.id === r.transactionId);
      changeLog.push({
        batch_id: batchId, entity_type: 'expected_transaction', entity_id: r.transactionId, action_type: 'status_update',
        before_state: tx ? { status: tx.status, cleared_at: tx.cleared_at, expected_amount: tx.expected_amount, scheduled_date: tx.scheduled_date, name: tx.name, direction: tx.direction, type: tx.type, source: tx.source } : { status: 'outstanding' },
        after_state: { status: 'matched', cleared_at: new Date(r.date + 'T00:00:00').toISOString() },
      });
    }

    // Build adjustments for partial matches
    const adjustments: AdjustmentInput[] = acceptedPartials.map(r => {
      const acceptedAmount = r.decision === 'accept_bank' ? r.amount : r.expectedAmount;
      return {
        bank_import_row_id: r.bankImportRowId,
        expected_amount_before: r.expectedAmount,
        bank_amount: r.amount,
        accepted_final_amount: acceptedAmount,
        adjustment_amount: acceptedAmount - r.expectedAmount,
        apply_to_future_template: r.updateTemplate,
        recurring_template_id: r.recurringTemplateId,
        notes: r.decision === 'accept_bank' ? 'Accepted bank amount' : 'Accepted expected amount',
      };
    });

    // Template updates
    const templateUpdates: TemplateUpdate[] = acceptedPartials
      .filter(r => r.updateTemplate && r.recurringTemplateId && r.decision === 'accept_bank')
      .map(r => ({ template_id: r.recurringTemplateId!, new_default_amount: r.amount }));

    const counts = {
      matched_count: selectedMatched.length,
      partial_match_count: acceptedPartials.length,
      unmatched_count: selectedNew.length,
      duplicate_count: duplicateCount,
    };

    try {
      await applyBatch.mutateAsync({
        batchId, matchedUpdates, newTransactions, matchRecords, changeLog, counts,
        adjustments: adjustments.length > 0 ? adjustments : undefined,
        templateUpdates: templateUpdates.length > 0 ? templateUpdates : undefined,
      });
      toast.success('Import applied successfully');
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to apply batch:', msg, err);
      toast.error(`Failed to apply import: ${msg}`);
    }
  };

  const selectedMatchCount = matchedRows.filter(r => r.selected).length;
  const selectedNewCount = newRows.filter(r => r.selected).length;
  const acceptedPartialCount = partialMatchRows.filter(r => r.decision === 'accept_bank' || r.decision === 'accept_expected').length;

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
              <span className={`text-xs ${i === step ? 'text-foreground' : 'text-muted-foreground'} hidden sm:inline`}>{s}</span>
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
                input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) handleFile(file); };
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
                  <SelectContent>{colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date column</Label>
                <Select value={dateCol.toString()} onValueChange={v => setDateCol(+v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
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
                    <SelectContent>{colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Debit column</Label>
                    <Select value={debitCol.toString()} onValueChange={v => setDebitCol(+v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Credit column</Label>
                    <Select value={creditCol.toString()} onValueChange={v => setCreditCol(+v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
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

        {/* Step 1: Matched Review */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-medium">Matched transactions</DialogTitle>
              <DialogDescription>{matchedRows.length} bank items matched exactly to your outstanding transactions.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-deposit inline-block" /> exact date</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" /> close date</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" /> amount only</span>
            </div>
            {matchedRows.length > 0 && (
              <div className="mb-2">
                <Checkbox checked={matchedRows.every(r => r.selected)} onCheckedChange={(checked) => setMatchedRows(prev => prev.map(r => ({ ...r, selected: !!checked })))} />
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
              {matchedRows.length === 0 && <p className="text-sm text-muted-foreground py-4">No exact matches found.</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setStep(0); setNeedsMapper(false); setHeaders([]); setRawRows([]); setCsvRows([]); }}>← Back</Button>
              <Button onClick={() => setStep(2)}>Next: partial matches →</Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Partial Match Review */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-medium">Partial matches</DialogTitle>
              <DialogDescription>
                {partialMatchRows.length} bank items matched but with different amounts. You must decide on each one.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {partialMatchRows.map((row, idx) => (
                <div key={idx} className="p-3 rounded border text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{row.transactionName}</div>
                      <div className="text-xs text-muted-foreground truncate">← {row.description} · {row.date}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Expected:</span>{' '}
                      <span className="font-medium">${formatCurrency(row.expectedAmount)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bank:</span>{' '}
                      <span className="font-medium">${formatCurrency(row.amount)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Diff:</span>{' '}
                      <span className="font-medium text-warning">${formatCurrency(Math.abs(row.amount - row.expectedAmount))}</span>
                    </div>
                  </div>
                  <RadioGroup
                    value={row.decision ?? ''}
                    onValueChange={(val) => setPartialMatchRows(prev => prev.map((r, i) => i === idx ? { ...r, decision: val as any } : r))}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="accept_bank" id={`pb-${idx}`} />
                      <Label htmlFor={`pb-${idx}`} className="text-xs cursor-pointer">Accept bank (${formatCurrency(row.amount)})</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="accept_expected" id={`pe-${idx}`} />
                      <Label htmlFor={`pe-${idx}`} className="text-xs cursor-pointer">Accept expected (${formatCurrency(row.expectedAmount)})</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="reject" id={`pr-${idx}`} />
                      <Label htmlFor={`pr-${idx}`} className="text-xs cursor-pointer">Reject to unmatched</Label>
                    </div>
                  </RadioGroup>
                  {row.recurringTemplateId && (row.decision === 'accept_bank' || row.decision === 'accept_expected') && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={row.updateTemplate}
                        onCheckedChange={(checked) => setPartialMatchRows(prev => prev.map((r, i) => i === idx ? { ...r, updateTemplate: !!checked } : r))}
                      />
                      <span className="text-xs text-muted-foreground">Update recurring template default amount</span>
                    </div>
                  )}
                </div>
              ))}
              {partialMatchRows.length === 0 && <p className="text-sm text-muted-foreground py-4">No partial matches found.</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={advanceFromPartialMatch} disabled={!allPartialDecided}>
                Next: unmatched →
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Unmatched Review */}
        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-medium">Unmatched items</DialogTitle>
              <DialogDescription>{newRows.length} bank items didn't match any outstanding transactions.</DialogDescription>
            </DialogHeader>
            {newRows.length > 0 && (
              <div className="mb-2">
                <Checkbox checked={newRows.length > 0 && newRows.every(r => r.selected)} onCheckedChange={(checked) => setNewRows(prev => prev.map(r => ({ ...r, selected: !!checked })))} />
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
              {newRows.length === 0 && <p className="text-sm text-muted-foreground py-4">No unmatched items.</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={() => setStep(4)}>Next: duplicates →</Button>
            </DialogFooter>
          </>
        )}

        {/* Step 4: Duplicate Review */}
        {step === 4 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-medium">Duplicate review</DialogTitle>
              <DialogDescription>
                {duplicateRows.length} items flagged as potential duplicates. All excluded by default.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {duplicateRows.map((row, idx) => (
                <div key={idx} className={`flex items-center gap-2 p-2 rounded border text-sm ${row.forceIncluded ? 'opacity-35' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium break-words">{row.description}</p>
                    <p className="text-xs text-muted-foreground">{row.date} · {row.duplicateFingerprint.substring(0, 40)}…</p>
                  </div>
                  <span className={`min-w-amount text-right ${row.direction === 'pmt' ? 'text-payment' : 'text-deposit'}`}>
                    {row.direction === 'pmt' ? '−' : '+'}${formatCurrency(row.amount)}
                  </span>
                  {row.forceIncluded ? (
                    <Badge variant="muted">Moved to unmatched</Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleForceInclude(idx)}>
                      Force include
                    </Button>
                  )}
                </div>
              ))}
              {duplicateRows.length === 0 && <p className="text-sm text-muted-foreground py-4">No duplicates detected.</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(3)}>← Back</Button>
              <Button onClick={() => setStep(5)}>Next: apply →</Button>
            </DialogFooter>
          </>
        )}

        {/* Step 5: Apply Summary */}
        {step === 5 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-medium">Apply reconciliation</DialogTitle>
              <DialogDescription>Review what will happen when you apply.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {selectedMatchCount > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-deposit mt-1.5 shrink-0" />
                  <span>{selectedMatchCount} exact matches — cleared in your ledger</span>
                </div>
              )}
              {acceptedPartialCount > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-warning mt-1.5 shrink-0" />
                  <span>{acceptedPartialCount} partial matches accepted — cleared with adjustments</span>
                </div>
              )}
              {selectedNewCount > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-info mt-1.5 shrink-0" />
                  <span>{selectedNewCount} new transactions — added as cleared</span>
                </div>
              )}
              {duplicateCount > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  <span>{duplicateCount} duplicates excluded</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Your true cash position will recalculate automatically once applied.</p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="outline" onClick={() => setStep(4)}>← Back</Button>
              <Button className="bg-deposit text-deposit-foreground hover:bg-deposit/90" onClick={handleApply} disabled={applyBatch.isPending}>
                {applyBatch.isPending ? 'Applying…' : 'Apply reconciliation'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
