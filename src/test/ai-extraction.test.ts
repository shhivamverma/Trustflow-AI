import { describe, it, expect } from 'vitest';
import { extractWithDeterministicEngine } from '../lib/ai-adapter';
import { AIExtractionOutputSchema } from '../lib/types';

describe('AI Billing Intelligence & Extraction Engine', () => {
  it('extracts structured facts from a clean brief and validates against strict schema', () => {
    const brief = `
Project Agreement: Acme Corp Mobile Redesign
Client: Acme Corp
Email: billing@acme.com
Reference: Q4 Redesign

Deliverables:
- UI Mockups & Design Tokens: 1 @ $1200.00
- React Frontend Architecture: 1 @ $2200.00

Total project fee is USD 3400.00.
Payment due within 14 days upon receipt.
    `;

    const result = extractWithDeterministicEngine(brief);
    const parsed = AIExtractionOutputSchema.safeParse(result);

    expect(parsed.success).toBe(true);
    expect(result.clientName).toBe('Acme Corp');
    expect(result.clientEmail).toBe('billing@acme.com');
    expect(result.currency).toBe('USD');
    expect(result.calculatedTotal).toBe('3400.00');
    expect(result.statedProjectTotal).toBe('3400.00');
    expect(result.lineItems.length).toBe(2);

    // Verify arithmetic check found matching totals
    const mathCheck = result.consistencyChecks.find((c) => c.type === 'ARITHMETIC_MATCH');
    expect(mathCheck).toBeDefined();
    expect(mathCheck?.severity).toBe('INFO');
  });

  it('detects deliberate $800 vs $950 mismatch and flags discrepancy alarm', () => {
    const brief = `
Total project fee is USD 800: frontend $200, backend $400 and payment integration $200.
Also including cloud deployment $150.
    `;

    const result = extractWithDeterministicEngine(brief);
    expect(result.statedProjectTotal).toBe('800.00');
    expect(result.calculatedTotal).toBe('950.00');

    const mismatchCheck = result.consistencyChecks.find((c) => c.type === 'ARITHMETIC_MISMATCH');
    expect(mismatchCheck).toBeDefined();
    expect(mismatchCheck?.severity).toBe('WARNING');
    expect(mismatchCheck?.message).toContain('USD 950.00');
    expect(mismatchCheck?.message).toContain('USD 800.00');
    expect(mismatchCheck?.message).toContain('USD 150.00 difference');
  });

  it('leaves missing fields as null rather than hallucinating', () => {
    const brief = `Short task description for redesign. Fee is $300.`;
    const result = extractWithDeterministicEngine(brief);

    expect(result.clientEmail).toBeNull();
    expect(result.missingFields).toContain('clientEmail');
  });

  it('verifies that extracted evidence quotes exist in the original text', () => {
    const brief = `Development for Apex Cloud Services. Total $500.`;
    const result = extractWithDeterministicEngine(brief);

    for (const ev of result.evidence) {
      expect(ev.verified).toBe(true);
      expect(brief).toContain(ev.sourceQuote);
    }
  });
});

