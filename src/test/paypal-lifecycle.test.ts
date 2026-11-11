import { describe, it, expect } from 'vitest';
import {
  createPayPalInvoiceDraft,
  sendPayPalInvoice,
  getPayPalInvoiceDetails,
  checkPayPalConnection,
  sanitizeCredential,
  getPayPalAccessToken,
} from '../lib/paypal';

describe('PayPal Invoicing API Adapter & Lifecycle Rules', () => {
  describe('Credential Sanitization & Validation', () => {
    it('properly sanitizes quotes and whitespace from credentials', () => {
      expect(sanitizeCredential('  "test_client_id"  ')).toBe('test_client_id');
      expect(sanitizeCredential(" 'test_secret' \n")).toBe('test_secret');
      expect(sanitizeCredential(null)).toBe('');
      expect(sanitizeCredential(undefined)).toBe('');
    });

    it('reports NOT_CONFIGURED when credentials are empty or placeholder', async () => {
      const status1 = await checkPayPalConnection('', '', true);
      expect(status1.status).toBe('NOT_CONFIGURED');
      expect(status1.configured).toBe(false);
      expect(status1.clientIdMasked).toBeNull();

      const status2 = await checkPayPalConnection('YOUR_CLIENT_ID', 'YOUR_CLIENT_SECRET', true);
      expect(status2.status).toBe('NOT_CONFIGURED');
      expect(status2.configured).toBe(false);
    });

    it('reports FAILED (401 invalid_client) when real OAuth request rejects invalid credentials', async () => {
      const status = await checkPayPalConnection(
        'A_INVALID_SANDBOX_CLIENT_ID_1234567890',
        'E_INVALID_SANDBOX_SECRET_0987654321',
        true
      );
      expect(status.status).toBe('FAILED');
      expect(status.configured).toBe(false);
      expect(status.message).toContain('401');
      expect(status.errorDetails).toContain('invalid_client');
      // Secret must NEVER be present anywhere in the status response
      expect(JSON.stringify(status)).not.toContain('E_INVALID_SANDBOX_SECRET_0987654321');
    });

    it('prevents getPayPalAccessToken from sending template placeholders', async () => {
      const origId = process.env.PAYPAL_CLIENT_ID;
      const origSecret = process.env.PAYPAL_CLIENT_SECRET;
      try {
        process.env.PAYPAL_CLIENT_ID = 'YOUR_CLIENT_ID';
        process.env.PAYPAL_CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
        await expect(getPayPalAccessToken()).rejects.toThrow(/missing or still set to template placeholder/);
      } finally {
        process.env.PAYPAL_CLIENT_ID = origId;
        process.env.PAYPAL_CLIENT_SECRET = origSecret;
      }
    });
  });

  describe('Invoice Lifecycle & Fallbacks', () => {
    it('creates draft invoice in deterministic demo fallback mode when keys absent', async () => {
      const origId = process.env.PAYPAL_CLIENT_ID;
      const origSecret = process.env.PAYPAL_CLIENT_SECRET;
      try {
        delete process.env.PAYPAL_CLIENT_ID;
        delete process.env.PAYPAL_CLIENT_SECRET;

        const payload = {
          detail: {
            currency_code: 'USD',
            invoice_number: `TF-TEST-${Date.now().toString().slice(-4)}`,
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
      } finally {
        process.env.PAYPAL_CLIENT_ID = origId;
        process.env.PAYPAL_CLIENT_SECRET = origSecret;
      }
    });

    it('creates real PayPal Sandbox draft invoice when valid credentials configured', async () => {
      // If environment has live sandbox credentials, test real creation
      if (process.env.PAYPAL_CLIENT_ID && !process.env.PAYPAL_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
        const payload = {
          detail: {
            currency_code: 'USD',
            invoice_number: `TF-REAL-${Date.now().toString().slice(-4)}`,
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
              name: 'Real Sandbox Test Deliverable',
              quantity: '1',
              unit_amount: { currency_code: 'USD', value: '250.00' },
            },
          ],
        };

        const draft = await createPayPalInvoiceDraft(payload);
        expect(draft.id).toBeDefined();
        expect(draft.id).not.toContain('INV2-DEMO-');
        expect(draft.id.startsWith('INV2-')).toBe(true);
        expect(draft.isDemoFallback).toBe(false);
        expect(draft.status).toBe('DRAFT');
        expect(draft.hostedInvoiceUrl).toContain('paypal.com');
      }
    }, 15000);

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
});

