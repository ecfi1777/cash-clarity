import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatCurrency, parseDate, parseAmount } from '@/lib/format';
import type { Transaction } from '@/hooks/use-data';
import { Upload } from 'lucide-react';

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
  transactions: Transaction[];
  onApply: (data: {
    cleared: Array<{ id: string; cleared_date: string }>;
    newItems: Array<{ name: string; amount: number; direction: string; type: string; date: string; cleared: boolean; cleared_date: string; source: string }>;
  }) => void;
};

const STEPS = ['Upload', 'Review matches', 'Review new', 'Apply'] as const;

function autoDetectColumns(headers: string[]): { desc: number; date: number; amount: number; debit: number; credit: number } | null {
  const lower = headers.map(h => h.toLowerCase().trim());

  // Detect date column first
  const date = lower.findIndex(h => h.includes('date') || h.includes('posted'));

  // Detect description: prioritize specific keywords, exclude date columns
  const descKeywords = ['full description', 'description', 'desc', 'memo', 'narr', 'detail', 'payee'];
  let desc = -1;
  for (const kw of descKeywords) {
    const idx = lower.findIndex((h, i) => i !== date && h.includes(kw) && !h.includes('date'));
    if (idx >= 0) { desc = idx; break; }
  }
  // Last resort: 'transaction' but only if it doesn't contain 'date'
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

export function CSVImportModal({ open, onOpenChange, transactions, onApply }: Props) {
  const [step, setStep] = useState(0);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // Column mapping
  const [descCol, setDescCol] = useState(-1);
  const [dateCol, setDateCol] = useState(-1);
  const [amountMode, setAmountMode] = useState<'single' | 'split'>('single');
  const [amountCol, setAmountCol] = useState(-1);
  const [debitCol, setDebitCol] = useState(-1);
  const [creditCol, setCreditCol] = useState(-1);
  const [needsMapper, setNeedsMapper] = useState(false);

  // Parsed data
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [newRows, setNewRows] = useState<NewRow[]>([]);

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
        processCSV(rows, detected.desc, detected.date, detected.amount >= 0 ? 'single' : 'split', detected.amount, detected.debit, detected.credit);
      } else {
        setNeedsMapper(true);
      }
    };
    reader.readAsText(file);
  }, []);

  const processCSV = useCallback((rows: string[][], dCol: number, dtCol: number, mode: 'single' | 'split', aCol: number, dbCol: number, crCol: number) => {
    const parsed: CSVRow[] = [];
    for (const row of rows) {
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
        parsed.push({ description: desc, date: dateStr, amount, direction });
      }
    }
    setCsvRows(parsed);

    // Match against outstanding transactions
    const outstanding = transactions.filter(t => !t.cleared);
    const used = new Set<string>();
    const matched: MatchedRow[] = [];
    const unmatched: CSVRow[] = [];

    for (const csvRow of parsed) {
      let bestMatch: Transaction | null = null;
      let bestScore = -1;

      for (const tx of outstanding) {
        if (used.has(tx.id)) continue;
        if (tx.direction !== csvRow.direction) continue;
        if (Math.abs(tx.amount - csvRow.amount) > 0.01) continue;

        const txDate = new Date(tx.date + 'T00:00:00');
        const csvDate = new Date(csvRow.date + 'T00:00:00');
        const daysDiff = Math.abs(Math.round((txDate.getTime() - csvDate.getTime()) / 86400000));

        let score = 0;
        if (daysDiff === 0) score = 100;
        else if (daysDiff <= 3) score = 50;
        else if (daysDiff <= 7) score = 20;

        if (score > bestScore || (score === bestScore && bestMatch && daysDiff < Math.abs(Math.round((new Date(bestMatch.date + 'T00:00:00').getTime() - new Date(csvRow.date + 'T00:00:00').getTime()) / 86400000)))) {
          bestMatch = tx;
          bestScore = score;
        }
      }

      if (bestMatch) {
        used.add(bestMatch.id);
        const txDate = new Date(bestMatch.date + 'T00:00:00');
        const csvDate = new Date(csvRow.date + 'T00:00:00');
        const daysDiff = Math.abs(Math.round((txDate.getTime() - csvDate.getTime()) / 86400000));
        matched.push({
          ...csvRow,
          transactionId: bestMatch.id,
          transactionName: bestMatch.name,
          transactionDate: bestMatch.date,
          confidence: daysDiff === 0 ? 'exact' : daysDiff <= 7 ? 'close' : 'amount',
          daysDiff,
          selected: true,
        });
      } else {
        unmatched.push(csvRow);
      }
    }

    setMatchedRows(matched);
    setNewRows(unmatched.map(r => ({
      ...r,
      selected: false,
      editedDescription: r.description,
      type: 'ACH',
    })));
    setStep(1);
  }, [transactions]);

  const handleMapperSubmit = () => {
    processCSV(rawRows, descCol, dateCol, amountMode, amountCol, debitCol, creditCol);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleApply = () => {
    const cleared = matchedRows.filter(r => r.selected).map(r => ({
      id: r.transactionId,
      cleared_date: r.date,
    }));
    const newItems = newRows.filter(r => r.selected).map(r => ({
      name: r.description,
      amount: r.amount,
      direction: r.direction,
      type: r.type,
      date: r.date,
      cleared: true,
      cleared_date: r.date,
      source: 'csv_unmatched',
    }));
    onApply({ cleared, newItems });
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
