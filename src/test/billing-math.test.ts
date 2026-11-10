import { describe, it, expect } from 'vitest';
import {
  calculateItemTotal,
  calculateSubtotal,
  verifyQuoteInSource,
  runBillingIntelligenceChecks,
} from '../lib/billing-math';

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
});
