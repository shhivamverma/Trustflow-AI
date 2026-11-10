import { describe, it, expect } from 'vitest';
import {
  calculateItemTotal,
  calculateSubtotal,
  verifyQuoteInSource,
  verifyLineItemEvidence,
  runBillingIntelligenceChecks,
} from '../lib/billing-math';
import { extractWithDeterministicEngine } from '../lib/ai-adapter';

describe('Billing Math & Deterministic Arithmetic', () => {
  it('correctly handles 0.10 + 0.20 without binary floating-point drift', () => {
    const items = [
      { quantity: '1', unitAmount: '0.10' },
      { quantity: '1', unitAmount: '0.20' },
    ];
    const subtotal = calculateSubtotal(items);
    expect(subtotal).toBe('0.30');
  });

  it('multiplies fractional quantities and unit rates accurately', () => {
    // 3.5 hours @ $85.50/hr = $299.25
    const itemTotal = calculateItemTotal('3.5', '85.50');
    expect(itemTotal).toBe('299.25');
  });

  it('detects and flags arithmetic mismatch when line items do not equal stated total', () => {
    const rawBrief =
      'Total project fee is USD 800: frontend $200, backend $400 and payment integration $200.';
    const lineItems = [
      { description: 'Frontend development', quantity: '1', unitAmount: '200.00', amount: '200.00' },
      { description: 'Backend development', quantity: '1', unitAmount: '400.00', amount: '400.00' },
      { description: 'Payment integration', quantity: '1', unitAmount: '200.00', amount: '200.00' },
      { description: 'Additional consulting', quantity: '1', unitAmount: '150.00', amount: '150.00' },
    ]; // Sum = $950.00

    const result = runBillingIntelligenceChecks({
      rawBrief,
      clientName: 'Acme Corp',
      clientEmail: 'billing@acme.com',
      currency: 'USD',
      lineItems,
      statedProjectTotal: '800.00',
      evidence: [],
    });

    const mismatchCheck = result.checks.find((c) => c.type === 'ARITHMETIC_MISMATCH');
    expect(mismatchCheck).toBeDefined();
    expect(mismatchCheck?.severity).toBe('WARNING');
    expect(mismatchCheck?.message).toContain('Invoice line items total USD 950.00');
    expect(mismatchCheck?.message).toContain('quoted USD 800.00');
    expect(mismatchCheck?.message).toContain('150.00 difference');
  });

  it('validates verbatim source quotes against the original brief', () => {
    const rawBrief = 'Payment is due within 14 calendar days upon delivery to sarah@client.co.';

    const validQuote = verifyQuoteInSource('sarah@client.co', rawBrief);
    expect(validQuote.verified).toBe(true);
    expect(validQuote.startOffset).toBe(rawBrief.indexOf('sarah@client.co'));

    const fabricatedQuote = verifyQuoteInSource('payment within 30 days', rawBrief);
    expect(fabricatedQuote.verified).toBe(false);
  });

  it('flags missing email as a warning for PayPal Invoicing', () => {
    const result = runBillingIntelligenceChecks({
      rawBrief: 'Project for Acme Corp. Total fee $500.',
      clientName: 'Acme Corp',
      clientEmail: null,
      currency: 'USD',
      lineItems: [{ description: 'Project Work', quantity: '1', unitAmount: '500.00', amount: '500.00' }],
      evidence: [],
    });

    const missingEmailCheck = result.checks.find(
      (c) => c.type === 'MISSING_FIELD' && c.field === 'clientEmail'
    );
    expect(missingEmailCheck).toBeDefined();
  });

  describe('Source Evidence Verification Workflow (User Test Case)', () => {
    const originalBrief = `Frontend Development: $1,800
Backend API Development: $1,100
PayPal Integration: $500
Total project fee: $3,400`;

    it('extracts all items with exact character offsets and marks them VERIFIED when amounts match', () => {
      const extraction = extractWithDeterministicEngine(originalBrief);

      expect(extraction.lineItems.length).toBe(3);
      expect(extraction.calculatedTotal).toBe('3400.00');
      expect(extraction.statedProjectTotal).toBe('3400.00');

      // 1. Frontend Development: $1,800
      const item1 = extraction.lineItems[0];
      expect(item1.description).toBe('Frontend Development');
      expect(item1.amount).toBe('1800.00');
      expect(item1.sourceQuote).toBe('Frontend Development: $1,800');
      expect(item1.startOffset).toBe(0);
      expect(item1.endOffset).toBe(28);
      expect(originalBrief.substring(item1.startOffset!, item1.endOffset!)).toBe('Frontend Development: $1,800');
      expect(item1.evidenceStatus).toBe('VERIFIED');

      // 2. Backend API Development: $1,100
      const item2 = extraction.lineItems[1];
      expect(item2.description).toBe('Backend API Development');
      expect(item2.amount).toBe('1100.00');
      expect(item2.sourceQuote).toBe('Backend API Development: $1,100');
      expect(originalBrief.substring(item2.startOffset!, item2.endOffset!)).toBe('Backend API Development: $1,100');
      expect(item2.evidenceStatus).toBe('VERIFIED');

      // 3. PayPal Integration: $500
      const item3 = extraction.lineItems[2];
      expect(item3.description).toBe('PayPal Integration');
      expect(item3.amount).toBe('500.00');
      expect(item3.sourceQuote).toBe('PayPal Integration: $500');
      expect(originalBrief.substring(item3.startOffset!, item3.endOffset!)).toBe('PayPal Integration: $500');
      expect(item3.evidenceStatus).toBe('VERIFIED');

      // Check evidence array
      const frontendEvidence = extraction.evidence.find(
        (e) => e.fieldReference === 'lineItems[0].description'
      );
      expect(frontendEvidence?.status).toBe('VERIFIED');
      expect(frontendEvidence?.verified).toBe(true);

      const totalEvidence = extraction.evidence.find((e) => e.fieldReference === 'statedProjectTotal');
      expect(totalEvidence?.status).toBe('VERIFIED');
      expect(totalEvidence?.verified).toBe(true);
    });

    it('rejects incorrect amount and flags MISMATCH status', () => {
      // Deliberately introduce incorrect amount $200 for Frontend Development ($1,800)
      const tamperedItem = {
        description: 'Frontend Development',
        quantity: '1',
        unitAmount: '200.00',
        amount: '200.00',
        sourceQuote: 'Frontend Development: $1,800',
        startOffset: 0,
        endOffset: 28,
      };

      const result = verifyLineItemEvidence({
        item: tamperedItem,
        rawBrief: originalBrief,
      });

      expect(result.status).toBe('MISMATCH');
      expect(result.verified).toBe(false);
      expect(result.message).toContain('Amount mismatch');
      expect(result.message).toContain('$1800.00');
      expect(result.message).toContain('$200.00');
    });

    it('flags NOT FOUND when quote does not exist in the original brief', () => {
      const hallucinatedItem = {
        description: 'Cloud Infrastructure Setup',
        quantity: '1',
        unitAmount: '300.00',
        amount: '300.00',
        sourceQuote: 'cloud setup $300',
      };

      const result = verifyLineItemEvidence({
        item: hallucinatedItem,
        rawBrief: originalBrief,
      });

      expect(result.status).toBe('NOT FOUND');
      expect(result.verified).toBe(false);
    });

    it('flags AMBIGUOUS when deliverable quote contains no price or rate', () => {
      const ambiguousBrief = 'We need frontend design. Revisions will be required later.';
      const ambiguousItem = {
        description: 'Design revisions',
        quantity: '1',
        unitAmount: '100.00',
        amount: '100.00',
        sourceQuote: 'Revisions will be required later.',
      };

      const result = verifyLineItemEvidence({
        item: ambiguousItem,
        rawBrief: ambiguousBrief,
      });

      expect(result.status).toBe('AMBIGUOUS');
      expect(result.verified).toBe(false);
      expect(result.message).toContain('ambiguous or unstated');
    });
  });
});
