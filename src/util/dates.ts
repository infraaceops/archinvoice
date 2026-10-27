export function formatDate(dateStringOrTimestamp?: string | number | null): string {
  if (!dateStringOrTimestamp) return 'N/A';
  try {
    const d = new Date(dateStringOrTimestamp);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateStringOrTimestamp);
  }
}

export function getCurrentFinancialYear(): string {
  return new Date().getFullYear().toString();
}

export function formatDateTime(dateStringOrTimestamp?: string | number | null): string {
  if (!dateStringOrTimestamp) return 'N/A';
  try {
    const d = new Date(dateStringOrTimestamp);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStringOrTimestamp);
  }
}
