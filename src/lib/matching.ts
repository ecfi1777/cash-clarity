// Matching engine — pure functions for CSV import reconciliation

export type BankRow = {
  index: number;
  rawDescription: string;
  normalizedDescription: string;
  checkNumber: string | null;
  postedDate: string;
  amount: number;
  direction: string;
  type?: string;
  duplicateFingerprint: string;
};

export type OutstandingCandidate = {
  id: string;
  name: string;
  direction: string;
  expected_amount: number;
  scheduled_date: string;
};

export type VendorAlias = {
  normalized_alias: string;
  vendor_id: string;
  canonical_name: string;
};

export type MatchResult = {
  bankRowIndex: number;
  status: 'matched' | 'partial_match' | 'unmatched' | 'duplicate';
  candidateId: string | null;
  candidateName: string | null;
  confidence: string;
  daysDifference: number | null;
  amountDifference: number | null;
  score: number;
};

/**
 * Normalize a bank description for matching: lowercase, collapse whitespace,
 * strip common noise words and symbols.
 */
export function normalizeDescription(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[#*\/\\]/g, ' ')
    .replace(/\b(the|of|for|and|or|inc|llc|co|corp|ltd)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a check number from a description if present.
 */
export function extractCheckNumber(desc: string): string | null {
  const patterns = [
    /\bcheck\s*#?\s*(\d{3,})/i,
    /\bchk\s*#?\s*(\d{3,})/i,
    /\bck\s*#?\s*(\d{3,})/i,
    /\b#(\d{4,})\b/,
  ];
  for (const p of patterns) {
    const m = desc.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Build a deterministic fingerprint for duplicate detection.
 */
export function buildDuplicateFingerprint(
  postedDate: string,
  amount: number,
  normalizedDesc: string,
  checkNumber: string | null
): string {
  const parts = [
    postedDate,
    amount.toFixed(2),
    normalizedDesc,
  ];
  if (checkNumber) parts.push(`ck:${checkNumber}`);
  return parts.join('|');
}

/**
 * Detect which incoming fingerprints already exist.
 * Returns a Set of indexes that are duplicates.
 */
export function detectDuplicates(
  incomingFingerprints: string[],
  existingFingerprints: Set<string>
): Set<number> {
  const dupes = new Set<number>();
  for (let i = 0; i < incomingFingerprints.length; i++) {
    if (existingFingerprints.has(incomingFingerprints[i])) {
      dupes.add(i);
    }
  }
  return dupes;
}

/**
 * Find the best one-to-one matches between bank rows and outstanding expected transactions.
 * 
 * Rules:
 * - Only same-direction candidates are considered
 * - Scoring: exact amount +50, description/alias match +30, date proximity ±3 days +20
 * - Returns ONE best candidate per bank row
 * - If two candidates score within 5 points → classify as unmatched (ambiguous)
 * - Exact amount match → 'matched'
 * - Amount differs → 'partial_match'
 * - No candidate → 'unmatched'
 * - One-to-one enforced: once matched, candidate removed from pool
 */
export function findMatches(
  bankRows: BankRow[],
  outstanding: OutstandingCandidate[],
  _vendorAliases: VendorAlias[] = []
): MatchResult[] {
  const used = new Set<string>();
  const results: MatchResult[] = [];

  // Build alias lookup: normalized_alias → canonical_name
  const aliasMap = new Map<string, string>();
  for (const a of _vendorAliases) {
    aliasMap.set(a.normalized_alias, a.canonical_name.toLowerCase());
  }

  for (const row of bankRows) {
    const candidates: Array<{
      candidate: OutstandingCandidate;
      score: number;
      daysDiff: number;
      amountDiff: number;
    }> = [];

    for (const tx of outstanding) {
      if (used.has(tx.id)) continue;
      if (tx.direction !== row.direction) continue;

      let score = 0;

      // Amount scoring: +50 for exact match
      const amountDiff = Math.abs(tx.expected_amount - row.amount);
      if (amountDiff < 0.01) {
        score += 50;
      }
      // If amount doesn't match at all, still consider as partial candidate
      // but only if there's other signal (description/date)

      // Description/alias scoring: +30
      const txNorm = normalizeDescription(tx.name);
      const rowAlias = aliasMap.get(row.normalizedDescription);
      if (txNorm === row.normalizedDescription || (rowAlias && txNorm.includes(rowAlias))) {
        score += 30;
      } else if (txNorm.includes(row.normalizedDescription) || row.normalizedDescription.includes(txNorm)) {
        score += 15; // partial description match
      }

      // Date proximity scoring: +20 (scaled)
      const txDate = new Date(tx.scheduled_date + 'T00:00:00');
      const bankDate = new Date(row.postedDate + 'T00:00:00');
      const daysDiff = Math.abs(Math.round((txDate.getTime() - bankDate.getTime()) / 86400000));
      if (daysDiff <= 3) {
        score += Math.round(20 * (1 - daysDiff / 4)); // 20 at 0 days, 15 at 1, 10 at 2, 5 at 3
      }

      // Minimum: must have amount match OR strong description+date signal
      if (score >= 20) {
        candidates.push({ candidate: tx, score, daysDiff, amountDiff });
      }
    }

    if (candidates.length === 0) {
      results.push({
        bankRowIndex: row.index,
        status: 'unmatched',
        candidateId: null,
        candidateName: null,
        confidence: 'none',
        daysDifference: null,
        amountDifference: null,
        score: 0,
      });
      continue;
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Check for ambiguous tie: top two within 5 points
    if (candidates.length >= 2 && candidates[0].score - candidates[1].score < 5) {
      results.push({
        bankRowIndex: row.index,
        status: 'unmatched',
        candidateId: null,
        candidateName: null,
        confidence: 'ambiguous',
        daysDifference: null,
        amountDifference: null,
        score: candidates[0].score,
      });
      continue;
    }

    const best = candidates[0];
    used.add(best.candidate.id);

    const isExactAmount = best.amountDiff < 0.01;
    results.push({
      bankRowIndex: row.index,
      status: isExactAmount ? 'matched' : 'partial_match',
      candidateId: best.candidate.id,
      candidateName: best.candidate.name,
      confidence: best.score >= 70 ? 'high' : best.score >= 40 ? 'medium' : 'low',
      daysDifference: best.daysDiff,
      amountDifference: isExactAmount ? null : best.amountDiff,
      score: best.score,
    });
  }

  return results;
}
