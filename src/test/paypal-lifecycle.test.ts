import { describe, it, expect } from 'vitest';
import { createPayPalInvoiceDraft, sendPayPalInvoice, getPayPalInvoiceDetails } from '../lib/paypal';

describe('PayPal Invoicing API Adapter & Lifecycle Rules', () => {
  it('creates draft invoice in deterministic demo fallback mode when keys absent', async () => {
    const payload = {
      detail: {
        currency_code: 'USD',
        invoice_number: 'TF-TEST-001',
      },
      primary_recipients: [
        {
          billing_info: {
            email_address: 'client@example.com',
          },
        },
      ],
      items: [
        {
          name: 'Consulting',
          quantity: '1',
          unit_amount: { currency_code: 'USD', value: '500.00' },
        },
      ],
    };

    const draft = await createPayPalInvoiceDraft(payload);
    expect(draft.id).toBeDefined();
    expect(draft.id).toContain('INV2-DEMO-');
    expect(draft.status).toBe('DRAFT');
    expect(draft.isDemoFallback).toBe(true);
    expect(draft.hostedInvoiceUrl).toContain('paypal.com');
  });

  it('sends invoice in demo fallback mode without error', async () => {
    const sendResult = await sendPayPalInvoice('INV2-DEMO-123456');
    expect(sendResult.status).toBe('SENT');
    expect(sendResult.isDemoFallback).toBe(true);
  });

  it('retrieves demo invoice details and returns authoritative payload', async () => {
    const details = await getPayPalInvoiceDetails('INV2-DEMO-999999');
    expect(details.id).toBe('INV2-DEMO-999999');
    expect(details.isDemoFallback).toBe(true);
  });
});

