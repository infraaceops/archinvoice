export function formatPKR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'PKR 0.00';
  return `PKR ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactPKR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'PKR 0';
  if (amount >= 1_000_000) {
    return `PKR ${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `PKR ${(amount / 1_000).toFixed(1)}k`;
  }
  return `PKR ${amount.toFixed(0)}`;
}

export function usdToPkr(usd: number, fxRate: number = 280): number {
  return Math.round(usd * fxRate * 100) / 100;
}
