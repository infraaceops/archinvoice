import { LineItem } from '../types';

export function calculateLineItemAmount(item: Partial<LineItem>): number {
  const qty = typeof item.qty === 'number' && !isNaN(item.qty) ? item.qty : 0;
  const rate = typeof item.rate === 'number' && !isNaN(item.rate) ? item.rate : 0;
  return Math.round(qty * rate * 100) / 100;
}

export function calculateInvoiceTotals(
  lineItems: LineItem[],
  taxRatePercent: number = 0
): { subtotal: number; tax: number; total: number } {
  const subtotal = Math.round(
    lineItems.reduce((acc, item) => acc + (calculateLineItemAmount(item) || 0), 0) * 100
  ) / 100;

  const validTaxRate = Math.max(0, taxRatePercent);
  const tax = Math.round((subtotal * (validTaxRate / 100)) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  return { subtotal, tax, total };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
