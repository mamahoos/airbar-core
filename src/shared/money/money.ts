/**
 * Money in integer rials — matches airbar-finance ledger and proto contract.
 * Use string for values that may exceed Number.MAX_SAFE_INTEGER in APIs;
 * use bigint for arithmetic inside the domain.
 */

const RIALS_PATTERN = /^\d+$/;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function parseRialsString(value: string): bigint {
  const trimmed = value.trim();
  if (!RIALS_PATTERN.test(trimmed)) {
    throw new MoneyError(`Invalid rials amount: "${value}" — expected non-negative integer string`);
  }
  return BigInt(trimmed);
}

export function formatRials(amount: bigint): string {
  if (amount < 0n) {
    throw new MoneyError('Rials amount cannot be negative');
  }
  return amount.toString();
}

export function addRials(a: bigint, b: bigint): bigint {
  const sum = a + b;
  if (sum < 0n) throw new MoneyError('Rials sum underflow');
  return sum;
}

export function subtractRials(a: bigint, b: bigint): bigint {
  const diff = a - b;
  if (diff < 0n) throw new MoneyError('Rials subtraction would be negative');
  return diff;
}

/** Platform fee: floor( amount * percent / 100 ) in integer rials. */
export function platformFeeRials(amount: bigint, percent: number): bigint {
  if (percent < 0 || percent > 100) {
    throw new MoneyError(`Invalid fee percent: ${percent}`);
  }
  return (amount * BigInt(Math.round(percent * 100))) / 10_000n;
}

export function carrierNetRials(amount: bigint, feePercent: number): bigint {
  const fee = platformFeeRials(amount, feePercent);
  return subtractRials(amount, fee);
}
