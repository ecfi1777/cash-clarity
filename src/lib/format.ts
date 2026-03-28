export function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSignedCurrency(value: number, direction: string): string {
  const formatted = formatCurrency(Math.abs(value));
  return direction === 'pmt' ? `−$${formatted}` : `+$${formatted}`;
}

export function parseDate(dateStr: string): Date | null {
  // Try YYYY-MM-DD
  let m = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

  // Try M/D/YYYY or M-D-YYYY
  m = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);

  // Try M/D/YY
  m = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (m) {
    const year = +m[3] + 2000;
    return new Date(year, +m[1] - 1, +m[2]);
  }

  return null;
}

export function parseAmount(raw: string): number {
  let cleaned = raw.replace(/[$,\s]/g, '');
  // Handle (1234.56) notation
  const parenMatch = cleaned.match(/^\((.+)\)$/);
  if (parenMatch) {
    cleaned = '-' + parenMatch[1];
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}
