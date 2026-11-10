import { describe, it, expect } from 'vitest';
import { extractWithDeterministicEngine, checkGeminiConnection } from '../lib/ai-adapter';
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

  it('correctly reports KEY_MISSING when GEMINI_API_KEY is absent or empty', async () => {
    const status = await checkGeminiConnection('', true);
    expect(status.status).toBe('KEY_MISSING');
    expect(status.configured).toBe(false);
    expect(status.message).toContain('not configured');
  });

  it('correctly reports AUTH_ERROR when an invalid GEMINI_API_KEY is supplied', async () => {
    const status = await checkGeminiConnection('AIzaSyDummyInvalidKeyForTest987654321', true);
    expect(status.status).toBe('AUTH_ERROR');
    expect(status.configured).toBe(true);
  });

  describe('Ambiguous Scope & Unpriced Deliverables Preservation (User Scenario)', () => {
    const ambiguousBrief = `Freelance Web Application Contract
Client: Stellar Media Labs
Billing Contact: accounts@stellarmedia.com
Project Reference: Interactive 3D Platform Prototype

Agreed deliverables:
- UI Concept & Wireframing: $800.00
- Custom WebGL & 3D Shaders: $1,200.00
- Additional client revision rounds (rate to be negotiated based on scope)
- Performance profiling and cloud hosting setup

Total project fee: $2,000.00`;

    it('extracts priced items into lineItems while preserving unpriced deliverables as pending clarification', () => {
      const result = extractWithDeterministicEngine(ambiguousBrief);
      const parsed = AIExtractionOutputSchema.safeParse(result);

      expect(parsed.success).toBe(true);

      // 1. Priced line items
      expect(result.lineItems.length).toBe(2);
      expect(result.lineItems[0].description).toBe('UI Concept & Wireframing');
      expect(result.lineItems[0].amount).toBe('800.00');
      expect(result.lineItems[0].evidenceStatus).toBe('VERIFIED');

      expect(result.lineItems[1].description).toBe('Custom WebGL & 3D Shaders');
      expect(result.lineItems[1].amount).toBe('1200.00');
      expect(result.lineItems[1].evidenceStatus).toBe('VERIFIED');

      // 2. Subtotal and stated fee (Unpriced items are strictly excluded from subtotal)
      expect(result.calculatedTotal).toBe('2000.00');
      expect(result.statedProjectTotal).toBe('2000.00');

      // 3. Unpriced deliverables preserved
      expect(result.unpricedScopeItems.length).toBe(2);

      const scope1 = result.unpricedScopeItems[0];
      expect(scope1.description).toBe('Additional client revision rounds (rate to be negotiated based on scope)');
      expect(scope1.sourceQuote).toBe('- Additional client revision rounds (rate to be negotiated based on scope)');
      expect(scope1.reason).toContain('negotiated');
      expect(scope1.status).toBe('PENDING_CLARIFICATION');
      expect(scope1.evidenceStatus).toBe('AMBIGUOUS');
      expect(scope1.startOffset).not.toBeNull();
      expect(scope1.endOffset).not.toBeNull();
      expect(ambiguousBrief.substring(scope1.startOffset!, scope1.endOffset!)).toBe(scope1.sourceQuote);

      const scope2 = result.unpricedScopeItems[1];
      expect(scope2.description).toBe('Performance profiling and cloud hosting setup');
      expect(scope2.sourceQuote).toBe('- Performance profiling and cloud hosting setup');
      expect(scope2.status).toBe('PENDING_CLARIFICATION');
      expect(scope2.evidenceStatus).toBe('AMBIGUOUS');
      expect(scope2.startOffset).not.toBeNull();
      expect(scope2.endOffset).not.toBeNull();
      expect(ambiguousBrief.substring(scope2.startOffset!, scope2.endOffset!)).toBe(scope2.sourceQuote);
    });

    it('never marks unpriced deliverables as VERIFIED in evidence', () => {
      const result = extractWithDeterministicEngine(ambiguousBrief);

      const unpricedEvidence = result.evidence.filter((e) =>
        e.fieldReference.startsWith('unpricedScopeItems')
      );
      expect(unpricedEvidence.length).toBe(2);

      for (const ev of unpricedEvidence) {
        expect(ev.status).toBe('AMBIGUOUS');
        expect(ev.verified).toBe(false); // Unsupported amounts must never receive VERIFIED
        expect(ev.quotedAmount).toBeNull();
        expect(ambiguousBrief).toContain(ev.sourceQuote);
      }
    });

    it('flags scope ambiguity check and records missing pricing in ambiguities array', () => {
      const result = extractWithDeterministicEngine(ambiguousBrief);

      const ambiguityCheck = result.consistencyChecks.find(
        (c) => c.type === 'AMBIGUITY' && c.field === 'unpricedScopeItems'
      );
      expect(ambiguityCheck).toBeDefined();
      expect(ambiguityCheck?.severity).toBe('WARNING');
      expect(ambiguityCheck?.message).toContain('2 unpriced scope item(s)');
      expect(ambiguityCheck?.message).toContain('Excluded from invoice subtotal');

      expect(result.ambiguities.length).toBeGreaterThanOrEqual(2);
      expect(result.ambiguities.some((a) => a.includes('Additional client revision rounds'))).toBe(true);
      expect(result.ambiguities.some((a) => a.includes('Performance profiling'))).toBe(true);
    });
  });
});

