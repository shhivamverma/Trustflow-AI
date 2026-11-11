import { describe, it, expect } from 'vitest';
import {
  calculateItemTotal,
  calculateSubtotal,
  verifyQuoteInSource,
  verifyLineItemEvidence,
  runBillingIntelligenceChecks,
  locateTotalInSource,
  verifyTotalEvidence,
  isInvoiceApprovalBlocked,
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

    describe('Regression Test: Total project fee quote location and evidence verification', () => {
      const briefWithFormattedTotal = `Client: Acme Global
Services required:
Frontend Development: $1,800
Backend API Development: $1,100
PayPal Integration: $500

Total Project Fee: USD 3,400.00`;

      it('locates "Total Project Fee: USD 3,400.00" verbatim from raw brief with exact character offsets', () => {
        const located = locateTotalInSource('3400.00', briefWithFormattedTotal);
        expect(located).not.toBeNull();
        expect(located?.sourceQuote).toBe('Total Project Fee: USD 3,400.00');
        expect(located?.startOffset).toBe(briefWithFormattedTotal.indexOf('Total Project Fee: USD 3,400.00'));
        expect(located?.endOffset).toBe(
          briefWithFormattedTotal.indexOf('Total Project Fee: USD 3,400.00') + 'Total Project Fee: USD 3,400.00'.length
        );
        expect(
          briefWithFormattedTotal.substring(located!.startOffset, located!.endOffset)
        ).toBe('Total Project Fee: USD 3,400.00');
      });

      it('marks stated total evidence VERIFIED when amount and line-item arithmetic match', () => {
        const lineItems = [
          { description: 'Frontend Development', quantity: '1', unitAmount: '1800.00', amount: '1800.00' },
          { description: 'Backend API Development', quantity: '1', unitAmount: '1100.00', amount: '1100.00' },
          { description: 'PayPal Integration', quantity: '1', unitAmount: '500.00', amount: '500.00' },
        ];

        const initialEvidence = [
          {
            fieldReference: 'statedProjectTotal',
            sourceQuote: '3400.00', // initially unformatted or bare string
            startOffset: null,
            endOffset: null,
            status: 'VERIFIED' as const,
            verified: true,
          },
        ];

        const result = runBillingIntelligenceChecks({
          rawBrief: briefWithFormattedTotal,
          clientName: 'Acme Global',
          clientEmail: 'billing@acme.com',
          currency: 'USD',
          lineItems,
          statedProjectTotal: '3400.00',
          evidence: initialEvidence,
        });

        const totalEv = result.validatedEvidence.find((e) => e.fieldReference === 'statedProjectTotal');
        expect(totalEv).toBeDefined();
        expect(totalEv?.status).toBe('VERIFIED');
        expect(totalEv?.verified).toBe(true);
        expect(totalEv?.sourceQuote).toBe('Total Project Fee: USD 3,400.00');
        expect(totalEv?.startOffset).not.toBeNull();
        expect(totalEv?.endOffset).not.toBeNull();
        expect(
          briefWithFormattedTotal.substring(totalEv!.startOffset!, totalEv!.endOffset!)
        ).toBe('Total Project Fee: USD 3,400.00');
      });

      it('flags MISMATCH when the located total quote amount does not match line-item total', () => {
        const tamperedLineItems = [
          { description: 'Frontend Development', quantity: '1', unitAmount: '1500.00', amount: '1500.00' },
          { description: 'Backend API Development', quantity: '1', unitAmount: '1000.00', amount: '1000.00' },
        ]; // Total = 2500.00, stated is 3400.00

        const calculatedSubtotal = calculateSubtotal(tamperedLineItems); // 2500.00, stated is 3400.00

        const result = verifyTotalEvidence({
          statedProjectTotal: '3400.00',
          totalEv: {
            fieldReference: 'statedProjectTotal',
            sourceQuote: 'Total Project Fee: USD 3,400.00',
            startOffset: briefWithFormattedTotal.indexOf('Total Project Fee: USD 3,400.00'),
            endOffset: briefWithFormattedTotal.indexOf('Total Project Fee: USD 3,400.00') + 'Total Project Fee: USD 3,400.00'.length,
            status: 'VERIFIED',
            verified: true,
          },
          rawBrief: briefWithFormattedTotal,
          calculatedSubtotal,
        });

        expect(result.status).toBe('MISMATCH');
        expect(result.verified).toBe(false);
        expect(result.message).toContain('differs from line items sum ($2500.00)');
      });

      it('flags NOT FOUND when stated total does not exist anywhere in the brief', () => {
        const result = verifyTotalEvidence({
          statedProjectTotal: '9999.00',
          totalEv: {
            fieldReference: 'statedProjectTotal',
            sourceQuote: '9999.00',
            startOffset: null,
            endOffset: null,
            status: 'VERIFIED',
            verified: true,
          },
          rawBrief: briefWithFormattedTotal,
          calculatedSubtotal: '9999.00',
        });

        expect(result.status).toBe('NOT FOUND');
        expect(result.verified).toBe(false);
        expect(result.startOffset).toBeNull();
        expect(result.endOffset).toBeNull();
      });
    });

    describe('Approval Safeguard: Math Mismatch Blocking Rule ($800 vs $950)', () => {
      const mismatchBrief = `Consulting Engagement Agreement
Client: Apex Cloud Services
Billing Contact: billing@apexcloud.io
Project Reference: Infrastructure & Payment Modernization

Agreed scope breakdown:
Frontend user dashboard: $200.00
Backend microservices integration: $400.00
PayPal payment flow integration: $200.00
Cloud infrastructure & automated deployment: $150.00

Note: "Total project fee is USD 800: frontend $200, backend $400 and payment integration $200."
Payment due upon receipt.`;

      it('blocks PayPal approval when line items sum ($950) conflicts with quoted fee ($800)', () => {
        const lineItems = [
          { description: 'Frontend user dashboard', quantity: '1', unitAmount: '200.00', amount: '200.00' },
          { description: 'Backend microservices integration', quantity: '1', unitAmount: '400.00', amount: '400.00' },
          { description: 'PayPal payment flow integration', quantity: '1', unitAmount: '200.00', amount: '200.00' },
          { description: 'Cloud infrastructure', quantity: '1', unitAmount: '150.00', amount: '150.00' },
        ]; // Total = 950.00, stated is 800.00

        const blockResult = isInvoiceApprovalBlocked({
          statedProjectTotal: '800.00',
          lineItems,
        });

        expect(blockResult.isBlocked).toBe(true);
        expect(blockResult.discrepancy).toBe('150.00');
        expect(blockResult.reason).toContain('$950.00');
        expect(blockResult.reason).toContain('$800.00');
        expect(blockResult.reason).toContain('$150.00');
      });

      it('permits PayPal approval when line items sum ($800) matches quoted project fee ($800)', () => {
        const reconciledLineItems = [
          { description: 'Frontend user dashboard', quantity: '1', unitAmount: '200.00', amount: '200.00' },
          { description: 'Backend microservices integration', quantity: '1', unitAmount: '400.00', amount: '400.00' },
          { description: 'PayPal payment flow integration', quantity: '1', unitAmount: '200.00', amount: '200.00' },
        ]; // Total = 800.00, stated is 800.00

        const blockResult = isInvoiceApprovalBlocked({
          statedProjectTotal: '800.00',
          lineItems: reconciledLineItems,
        });

        expect(blockResult.isBlocked).toBe(false);
      });

      it('permits PayPal approval when brief contains no stated overall total', () => {
        const lineItems = [
          { description: 'Ad-hoc consulting', quantity: '1', unitAmount: '350.00', amount: '350.00' },
        ];

        const blockResult = isInvoiceApprovalBlocked({
          statedProjectTotal: null,
          lineItems,
        });

        expect(blockResult.isBlocked).toBe(false);
      });

      it('verifies that extracting Math Mismatch preset marks approval blocked, and unblocks upon reconciliation', () => {
        const extraction = extractWithDeterministicEngine(mismatchBrief);

        expect(extraction.statedProjectTotal).toBe('800.00');
        expect(extraction.calculatedTotal).toBe('950.00');

        // Initial extraction has discrepancy: approval must be blocked!
        const initialCheck = isInvoiceApprovalBlocked({
          statedProjectTotal: extraction.statedProjectTotal,
          calculatedSubtotal: extraction.calculatedTotal,
        });
        expect(initialCheck.isBlocked).toBe(true);
        expect(initialCheck.discrepancy).toBe('150.00');

        // Freelancer reconciles by removing the $150 additional scope item or adjusting fees
        const reconciledItems = extraction.lineItems.filter(
          (item) => !item.description.toLowerCase().includes('cloud infrastructure')
        );
        const reconciledSubtotal = calculateSubtotal(reconciledItems);
        expect(reconciledSubtotal).toBe('800.00');

        // Now approval check unblocks!
        const reconciledCheck = isInvoiceApprovalBlocked({
          statedProjectTotal: extraction.statedProjectTotal,
          calculatedSubtotal: reconciledSubtotal,
        });
        expect(reconciledCheck.isBlocked).toBe(false);
      });
    });
  });
});
