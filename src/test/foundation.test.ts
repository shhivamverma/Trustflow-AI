import { describe, it, expect } from 'vitest';

describe('TrustFlow AI - Foundation Environment', () => {
  it('loads environment variables safely', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
  });

  it('calculates deterministic decimal operations safely', () => {
    const a = 0.1;
    const b = 0.2;
    // Standard floating point error check
    expect(a + b).not.toBe(0.3);
    // Deterministic fixed string representation
    const safeSum = (Math.round((a + b) * 100) / 100).toFixed(2);
    expect(safeSum).toBe('0.30');
  });
});

