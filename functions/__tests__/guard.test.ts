import { assertPricingSafety } from '../src/config/guard';

describe('Pricing Safety Guard', () => {
  it('should pass pricing safety check with current configuration', () => {
    expect(() => {
      const result = assertPricingSafety();
      expect(result.storageMargin).toBeGreaterThanOrEqual(0.40);
      expect(result.egressMargin).toBeGreaterThanOrEqual(0.40);
    }).not.toThrow();
  });
});
