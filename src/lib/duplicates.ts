import { supabase } from '@/integrations/supabase/client';

export type DuplicateMatchReason = 'check' | 'amount' | 'both';

export type DuplicateMatch = {
  id: string;
  name: string;
  scheduled_date: string;
  expected_amount: number;
  status: string;
  type: string;
  check_number: string | null;
  matchReason: DuplicateMatchReason;
};

export type DuplicateQuery = {
  direction: 'pmt' | 'dep';
  amount: number;
  checkNumber: string | null;
};

const normalizeCheck = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  return t.length ? t : null;
};

/**
 * Find existing expected_transactions that look like duplicates of the
 * incoming entry. Match rule (no date window): same direction AND
 * (same check# OR same amount).
 */
export async function findPotentialDuplicates(
  q: DuplicateQuery
): Promise<DuplicateMatch[]> {
  const check = normalizeCheck(q.checkNumber);

  let query = supabase
    .from('expected_transactions')
    .select('id, name, scheduled_date, expected_amount, status, type, check_number, direction')
    .eq('direction', q.direction);

  // OR on amount / check
  const orParts: string[] = [`expected_amount.eq.${q.amount}`];
  if (check) {
    // Postgres ilike for case-insensitive exact match
    orParts.push(`check_number.ilike.${check}`);
  }
  query = query.or(orParts.join(','));

  const { data, error } = await query.limit(50);
  if (error) {
    console.error('Duplicate check failed', error);
    return [];
  }

  return (data ?? []).map((row: any): DuplicateMatch => {
    const amountMatch = Number(row.expected_amount) === q.amount;
    const checkMatch =
      !!check && normalizeCheck(row.check_number) === check;
    const reason: DuplicateMatchReason =
      amountMatch && checkMatch ? 'both' : checkMatch ? 'check' : 'amount';
    return {
      id: row.id,
      name: row.name,
      scheduled_date: row.scheduled_date,
      expected_amount: Number(row.expected_amount),
      status: row.status,
      type: row.type,
      check_number: row.check_number,
      matchReason: reason,
    };
  });
}

export function reasonLabel(r: DuplicateMatchReason): string {
  if (r === 'both') return 'same check # & amount';
  if (r === 'check') return 'same check #';
  return 'same amount';
}

export function statusLabel(s: string): string {
  if (s === 'outstanding') return 'Outstanding';
  if (s === 'matched') return 'Matched';
  if (s === 'cleared') return 'Cleared';
  return s;
}
