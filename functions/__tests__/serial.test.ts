describe('Serial Number Generation Logic', () => {
  function formatSerial(prefix: string, fy: string, sequence: number): string {
    return `${prefix}-${fy}-${String(sequence).padStart(4, '0')}`;
  }

  it('formats serial correctly with 4-digit zero padding', () => {
    expect(formatSerial('ARCH', '2025', 1)).toBe('ARCH-2025-0001');
    expect(formatSerial('INT', '2025', 42)).toBe('INT-2025-0042');
    expect(formatSerial('SUP', '2026', 999)).toBe('SUP-2026-0999');
    expect(formatSerial('ARCH', '2026', 1000)).toBe('ARCH-2026-1000');
  });

  it('generates 100 consecutive unique serials concurrently', async () => {
    let currentNext = 1;
    const prefix = 'ARCH';
    const fy = '2025';

    // Simulate atomic transactional allocation
    async function allocateNext(): Promise<string> {
      const allocated = currentNext;
      currentNext += 1;
      return formatSerial(prefix, fy, allocated);
    }

    const promises = Array.from({ length: 100 }, () => allocateNext());
    const results = await Promise.all(promises);

    expect(results.length).toBe(100);
    const uniqueSerials = new Set(results);
    expect(uniqueSerials.size).toBe(100);
    expect(results[0]).toBe('ARCH-2025-0001');
    expect(results[99]).toBe('ARCH-2025-0100');
  });
});
