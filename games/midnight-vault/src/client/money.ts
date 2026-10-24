// Money helpers. RGS amounts are integers with 6 implied decimals (1_000_000 = 1.00).
// Book amounts are integer centi-bet values (100 = 1x bet). All arithmetic stays in integers.

export const API_MULTIPLIER = 1_000_000;

interface CurrencyMeta {
  symbol: string;
  decimals: number;
  after?: boolean;
}

const CURRENCIES: Record<string, CurrencyMeta> = {
  USD: { symbol: '$', decimals: 2 }, CAD: { symbol: 'CA$', decimals: 2 }, JPY: { symbol: '¥', decimals: 0 },
  EUR: { symbol: '€', decimals: 2 }, RUB: { symbol: '₽', decimals: 2 }, CNY: { symbol: 'CN¥', decimals: 2 },
  PHP: { symbol: '₱', decimals: 2 }, INR: { symbol: '₹', decimals: 2 }, IDR: { symbol: 'Rp', decimals: 0 },
  KRW: { symbol: '₩', decimals: 0 }, BRL: { symbol: 'R$', decimals: 2 }, MXN: { symbol: 'MX$', decimals: 2 },
  DKK: { symbol: 'KR', decimals: 2, after: true }, PLN: { symbol: 'zł', decimals: 2, after: true },
  VND: { symbol: '₫', decimals: 0, after: true }, TRY: { symbol: '₺', decimals: 2 }, CLP: { symbol: 'CLP', decimals: 0, after: true },
  ARS: { symbol: 'ARS', decimals: 2, after: true }, PEN: { symbol: 'S/', decimals: 2, after: true }, NGN: { symbol: '₦', decimals: 0 },
  SAR: { symbol: 'SAR', decimals: 2, after: true }, ILS: { symbol: 'ILS', decimals: 2, after: true }, AED: { symbol: 'AED', decimals: 2, after: true },
  TWD: { symbol: 'NT$', decimals: 2 }, NOK: { symbol: 'kr', decimals: 2 }, KWD: { symbol: 'KD', decimals: 2 }, JOD: { symbol: 'JD', decimals: 2 },
  CRC: { symbol: '₡', decimals: 2 }, TND: { symbol: 'TND', decimals: 2, after: true }, SGD: { symbol: 'SG$', decimals: 2 },
  MYR: { symbol: 'RM', decimals: 2 }, OMR: { symbol: 'OMR', decimals: 2, after: true }, QAR: { symbol: 'QAR', decimals: 2, after: true },
  BHD: { symbol: 'BD', decimals: 2 }, XGC: { symbol: 'GC', decimals: 0, after: true }, XSC: { symbol: 'SC', decimals: 2, after: true },
};

/** Formats an RGS integer amount. Uses a fixed en-US number format so text never breaks for other `lang` values. */
export function formatMoney(micros: number, currency: string, opts: { decimals?: number } = {}): string {
  const meta = CURRENCIES[currency] ?? { symbol: currency, decimals: 2, after: true };
  const decimals = opts.decimals ?? meta.decimals;
  const value = micros / API_MULTIPLIER;
  const num = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  return meta.after ? `${num} ${meta.symbol}` : `${meta.symbol}${num}`;
}

/** Converts a book amount (centi-bet) to RGS micros for a base bet. Exact for bet levels divisible by 100. */
export function winMicros(betMicros: number, centi: number): number {
  return Math.round((betMicros * centi) / 100);
}
