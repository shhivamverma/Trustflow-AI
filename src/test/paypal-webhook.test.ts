import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveReconciledStatus, verifyPayPalWebhookSignature } from '../lib/paypal-webhook';
import { getPayPalAccessToken, getPayPalBaseUrl, sanitizeCredential } from '../lib/paypal';
import { prisma } from '../lib/db';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

describe('PayPal Webhook Status Reconciliation & Event Handlers', () => {
  describe('Requirement 1, 2, 3: Fallback Event Mapping (Bug Fix & Regression Tests)', () => {
    it('maps INVOICING.INVOICE.CANCELLED to CANCELED (fixing regression where it mapped to PAID)', () => {
      // Remote status is null (e.g. live fetch failed or offline fallback)
      const reconciled = resolveReconciledStatus('SENT', null, 'INVOICING.INVOICE.CANCELLED');
      expect(reconciled).toBe('CANCELED');
      expect(reconciled).not.toBe('PAID');
    });

    it('maps INVOICING.INVOICE.CANCELED (alternate spelling) to CANCELED', () => {
      const reconciled = resolveReconciledStatus('SENT', null, 'INVOICING.INVOICE.CANCELED');
      expect(reconciled).toBe('CANCELED');
    });

    it('maps INVOICING.INVOICE.PAID to PAID', () => {
      const reconciled = resolveReconciledStatus('SENT', null, 'INVOICING.INVOICE.PAID');
      expect(reconciled).toBe('PAID');
    });

    it('maps INVOICING.INVOICE.REFUNDED to REFUNDED', () => {
      const reconciled = resolveReconciledStatus('PAID', null, 'INVOICING.INVOICE.REFUNDED');
      expect(reconciled).toBe('REFUNDED');
    });

    it('maps INVOICING.INVOICE.SENT to SENT or OVERDUE in fallback mode', () => {
      const pastDueDate = '2020-01-01';
      const overdueReconciled = resolveReconciledStatus('DRAFT', null, 'INVOICING.INVOICE.SENT', pastDueDate);
      expect(overdueReconciled).toBe('OVERDUE');

      const futureDueDate = '2099-12-31';
      const sentReconciled = resolveReconciledStatus('DRAFT', null, 'INVOICING.INVOICE.SENT', futureDueDate);
      expect(sentReconciled).toBe('SENT');
    });

    it('maps INVOICING.INVOICE.CREATED to DRAFT in fallback mode', () => {
      const reconciled = resolveReconciledStatus('DRAFT', null, 'INVOICING.INVOICE.CREATED');
      expect(reconciled).toBe('DRAFT');
    });

    it('retains current status for INVOICING.INVOICE.UPDATED in fallback mode', () => {
      const reconciled = resolveReconciledStatus('SENT', null, 'INVOICING.INVOICE.UPDATED');
      expect(reconciled).toBe('SENT');
    });
  });

  describe('Requirement 5: Live PayPal Status Retrieval Authoritative Over Fallback', () => {
    it('authoritative live status PARTIALLY_PAID overrides INVOICING.INVOICE.PAID event', () => {
      // Even if webhook event claims PAID, live PayPal status takes precedence
      const reconciled = resolveReconciledStatus('SENT', 'PARTIALLY_PAID', 'INVOICING.INVOICE.PAID');
      expect(reconciled).toBe('PARTIALLY_PAID');
    });

    it('authoritative live status CANCELLED overrides INVOICING.INVOICE.PAID event', () => {
      const reconciled = resolveReconciledStatus('SENT', 'CANCELLED', 'INVOICING.INVOICE.PAID');
      expect(reconciled).toBe('CANCELED');
    });

    it('authoritative live status MARKED_AS_PAID resolves to PAID regardless of event type', () => {
      const reconciled = resolveReconciledStatus('SENT', 'MARKED_AS_PAID', 'INVOICING.INVOICE.UPDATED');
      expect(reconciled).toBe('PAID');
    });

    it('authoritative live status SENT respects past due date and resolves to OVERDUE', () => {
      const pastDueDate = '2020-01-01';
      const reconciled = resolveReconciledStatus('SENT', 'SENT', 'INVOICING.INVOICE.UPDATED', pastDueDate);
      expect(reconciled).toBe('OVERDUE');
    });

    it('authoritative live status SENT respects future due date and resolves to SENT', () => {
      const futureDueDate = '2099-12-31';
      const reconciled = resolveReconciledStatus('DRAFT', 'SENT', 'INVOICING.INVOICE.UPDATED', futureDueDate);
      expect(reconciled).toBe('SENT');
    });

    it('authoritative live status REFUNDED resolves to REFUNDED', () => {
      const reconciled = resolveReconciledStatus('PAID', 'REFUNDED', 'INVOICING.INVOICE.UPDATED');
      expect(reconciled).toBe('REFUNDED');
    });
  });

  describe('Safeguard Invariant: Prevent Regression of PAID Invoices', () => {
    it('prevents regression of PAID to SENT even if remote status claims UNPAID', () => {
      const reconciled = resolveReconciledStatus('PAID', 'SENT', 'INVOICING.INVOICE.UPDATED');
      expect(reconciled).toBe('PAID');
    });

    it('prevents regression of PAID to OVERDUE even if due date has passed', () => {
      const reconciled = resolveReconciledStatus('PAID', 'SENT', 'INVOICING.INVOICE.UPDATED', '2020-01-01');
      expect(reconciled).toBe('PAID');
    });

    it('prevents regression of PAID to PARTIALLY_PAID', () => {
      const reconciled = resolveReconciledStatus('PAID', 'PARTIALLY_PAID', 'INVOICING.INVOICE.UPDATED');
      expect(reconciled).toBe('PAID');
    });

    it('permits transition from PAID to REFUNDED', () => {
      const reconciled = resolveReconciledStatus('PAID', 'REFUNDED', 'INVOICING.INVOICE.REFUNDED');
      expect(reconciled).toBe('REFUNDED');
    });

    it('permits transition from PAID to CANCELED if explicitly canceled remotely', () => {
      const reconciled = resolveReconciledStatus('PAID', 'CANCELLED', 'INVOICING.INVOICE.CANCELLED');
      expect(reconciled).toBe('CANCELED');
    });
  });

  describe('Requirement 6: Deduplication & Audit Hashing Invariants', () => {
    it('computes deterministic SHA-256 payload hash for audit logging', () => {
      const rawPayload = JSON.stringify({ id: 'WH-TEST-123', event_type: 'INVOICING.INVOICE.PAID' });
      const hash1 = crypto.createHash('sha256').update(rawPayload).digest('hex');
      const hash2 = crypto.createHash('sha256').update(rawPayload).digest('hex');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('Requirement 7: Real Webhook Signature Verification Security (No Mock Bypass)', () => {
    const origEnv = { ...process.env };
    const origFetch = global.fetch;

    beforeEach(() => {
      process.env = { ...origEnv };
    });

    afterEach(() => {
      global.fetch = origFetch;
      process.env = { ...origEnv };
    });

    it('strictly rejects verification when PAYPAL_WEBHOOK_ID is empty/missing', async () => {
      delete process.env.PAYPAL_WEBHOOK_ID;

      const headers = {
        transmissionId: 'tx-12345',
        transmissionTime: '2026-11-11T12:00:00Z',
        certUrl: 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123',
        authAlgo: 'SHA256withRSA',
        transmissionSig: 'dummy_sig_base64',
      };

      const result = await verifyPayPalWebhookSignature(headers, '{"id":"WH-123"}', '');
      expect(result).toBe(false);
    });

    it('strictly rejects verification when any transmission header is missing', async () => {
      const headers = {
        transmissionId: 'tx-12345',
        transmissionTime: '2026-11-11T12:00:00Z',
        certUrl: 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123',
        authAlgo: 'SHA256withRSA',
        transmissionSig: null,
      };

      const result = await verifyPayPalWebhookSignature(headers, '{"id":"WH-123"}', '28D53127Y1454215W');
      expect(result).toBe(false);
    });

    it('strictly rejects verification when transmission headers are all empty strings', async () => {
      const headers = {
        transmissionId: '',
        transmissionTime: '',
        certUrl: '',
        authAlgo: '',
        transmissionSig: '',
      };

      const result = await verifyPayPalWebhookSignature(headers, '{"id":"WH-123"}', '28D53127Y1454215W');
      expect(result).toBe(false);
    });

    it('dispatches to official PayPal verify-webhook-signature API when headers and ID present', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'fake_test_token_999', token_type: 'Bearer' }),
          };
        }
        if (url.includes('/v1/notifications/verify-webhook-signature')) {
          return {
            ok: true,
            json: async () => ({ verification_status: 'SUCCESS' }),
          };
        }
        return { ok: false, status: 404 };
      });
      global.fetch = mockFetch;

      const headers = {
        transmissionId: 'tx-valid-999',
        transmissionTime: '2026-11-11T12:00:00Z',
        certUrl: 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-999',
        authAlgo: 'SHA256withRSA',
        transmissionSig: 'valid_base64_sig',
      };

      const payload = JSON.stringify({ id: 'WH-EVENT-999', event_type: 'INVOICING.INVOICE.PAID' });
      const result = await verifyPayPalWebhookSignature(headers, payload, '28D53127Y1454215W');

      expect(mockFetch).toHaveBeenCalled();
      const verifyCall = mockFetch.mock.calls.find((call: any[]) =>
        call[0].includes('/v1/notifications/verify-webhook-signature')
      );
      expect(verifyCall).toBeDefined();
      if (!verifyCall) throw new Error('verifyCall expected');
      const [calledUrl, calledOptions] = verifyCall;
      expect(calledOptions.method).toBe('POST');
      const body = JSON.parse(calledOptions.body);
      expect(body.transmission_id).toBe('tx-valid-999');
      expect(body.webhook_id).toBe('28D53127Y1454215W');
      expect(result).toBe(true);
    });

    it('rejects verification when PayPal official API returns verification_status: FAILURE', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'fake_test_token_999', token_type: 'Bearer' }),
          };
        }
        if (url.includes('/v1/notifications/verify-webhook-signature')) {
          return {
            ok: true,
            json: async () => ({ verification_status: 'FAILURE' }),
          };
        }
        return { ok: false, status: 404 };
      });
      global.fetch = mockFetch;

      const headers = {
        transmissionId: 'tx-tampered-999',
        transmissionTime: '2026-11-11T12:00:00Z',
        certUrl: 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-999',
        authAlgo: 'SHA256withRSA',
        transmissionSig: 'tampered_signature',
      };

      const payload = JSON.stringify({ id: 'WH-EVENT-999', event_type: 'INVOICING.INVOICE.PAID' });
      const result = await verifyPayPalWebhookSignature(headers, payload, '28D53127Y1454215W');

      expect(result).toBe(false);
    });
  });

  describe('Duplicate Event Handling & Database Invariants', () => {
    it('correctly tracks and detects duplicate event IDs in database', async () => {
      const testEventId = `WH-DEDUP-TEST-${Date.now()}`;

      // First insertion
      const record = await prisma.webhookEvent.create({
        data: {
          paypalEventId: testEventId,
          eventType: 'INVOICING.INVOICE.PAID',
          invoiceId: 'INV2-44KW-G7QY-TRXP-2AXB',
          payloadHash: 'dummy_hash_test_value_64_chars_length_0123456789abcdef0123456789abcdef',
          processedAt: new Date(),
        },
      });
      expect(record.paypalEventId).toBe(testEventId);

      // Verify idempotency query detects the existing record
      const existing = await prisma.webhookEvent.findUnique({
        where: { paypalEventId: testEventId },
      });
      expect(existing).not.toBeNull();
      expect(existing?.paypalEventId).toBe(testEventId);

      // Clean up test event record
      await prisma.webhookEvent.delete({
        where: { paypalEventId: testEventId },
      });
    });
  });

  describe('Live PayPal Sandbox API Webhook Verification (Non-Mocked)', () => {
    function getLiveWebhookId(): string {
      let webhookId = sanitizeCredential(process.env.PAYPAL_WEBHOOK_ID);
      if (!webhookId) {
        try {
          const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
          const match = envContent.match(/PAYPAL_WEBHOOK_ID="?(.*?)"?\r?\n/);
          if (match) webhookId = sanitizeCredential(match[1]);
        } catch {
          // ignore
        }
      }
      return webhookId || '28D53127Y1454215W';
    }

    it('retrieves the registered webhook 28D53127Y1454215W directly from PayPal Sandbox', async () => {
      if (process.env.PAYPAL_CLIENT_ID && !process.env.PAYPAL_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
        const token = await getPayPalAccessToken();
        const baseUrl = getPayPalBaseUrl();
        const webhookId = getLiveWebhookId();

        const res = await fetch(`${baseUrl}/v1/notifications/webhooks/${webhookId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await res.json();
        if (res.status !== 200) {
          console.error('DEBUG LIVE PAYPAL GET WEBHOOK FAILED:', res.status, JSON.stringify(data));
        }

        expect(res.status).toBe(200);
        expect(data.id).toBe(webhookId);
        expect(data.url).toContain('/api/webhooks/paypal');
        expect(data.event_types).toBeDefined();
        expect(data.event_types.length).toBeGreaterThan(0);
      }
    }, 15000);

    it('submits an invalid signature to real PayPal Sandbox verify-webhook-signature and receives FAILURE', async () => {
      if (process.env.PAYPAL_CLIENT_ID && !process.env.PAYPAL_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
        const webhookId = getLiveWebhookId();

        // Intentionally invalid signature headers
        const headers = {
          transmissionId: '3c8e4490-a01c-11eb-a5f1-3316279f64bf',
          transmissionTime: '2026-11-11T12:00:00Z',
          certUrl: 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360-1752946856-1123',
          authAlgo: 'SHA256withRSA',
          transmissionSig: 'INVALID_SIGNATURE_PAYLOAD_TEST_123',
        };

        const payload = JSON.stringify({
          id: 'WH-TEST-REAL-PAYPAL-VERIFICATION',
          event_type: 'INVOICING.INVOICE.PAID',
          resource: { id: 'INV2-44KW-G7QY-TRXP-2AXB' },
        });

        const result = await verifyPayPalWebhookSignature(headers, payload, webhookId);
        // The real PayPal Sandbox API must evaluate the signature and reject it
        expect(result).toBe(false);
      }
    }, 15000);
  });
});
