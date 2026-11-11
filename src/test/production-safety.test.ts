import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as simulatePaymentPOST } from '../app/api/invoices/[id]/simulate-payment/route';
import { POST as settingsPOST } from '../app/api/settings/route';

describe('Production Safety Guards (NODE_ENV === production)', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  describe('Payment Simulation Guard (/api/invoices/[id]/simulate-payment)', () => {
    it('strictly returns HTTP 403 when NODE_ENV === production', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      const req = new NextRequest('http://localhost:3000/api/invoices/test-id/simulate-payment', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: 'test-invoice-id' });

      const res = await simulatePaymentPOST(req, { params });
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toBe('Payment simulation is disabled in production mode.');
      expect(body.code).toBe('SIMULATION_DISABLED_IN_PRODUCTION');
    });

    it('allows execution path (does not reject with 403) when NODE_ENV is test or development', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';

      const req = new NextRequest('http://localhost:3000/api/invoices/nonexistent-id/simulate-payment', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: 'nonexistent-id' });

      const res = await simulatePaymentPOST(req, { params });
      // In non-production, it proceeds past the guard and reaches business logic (404 for nonexistent id)
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Invoice not found');
    });
  });

  describe('Settings Database Deletion Guard (/api/settings)', () => {
    it('strictly returns HTTP 403 for CLEAR_ALL when NODE_ENV === production', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      const req = new NextRequest('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLEAR_ALL' }),
      });

      const res = await settingsPOST(req);
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toBe('Clearing all database records is disabled in production mode.');
      expect(body.code).toBe('CLEAR_ALL_DISABLED_IN_PRODUCTION');
    });

    it('strictly returns HTTP 403 for RESET_DEMO when NODE_ENV === production', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      const req = new NextRequest('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_DEMO' }),
      });

      const res = await settingsPOST(req);
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toBe('Resetting demo data is disabled in production mode.');
      expect(body.code).toBe('RESET_DISABLED_IN_PRODUCTION');
    });

    it('allows non-destructive workspace updates when NODE_ENV === production', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      const req = new NextRequest('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Production Studio',
          defaultCurrency: 'USD',
          demoMode: false,
        }),
      });

      const res = await settingsPOST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.workspace).toBeDefined();
      expect(body.workspace.displayName).toBe('Production Studio');
      expect(body.workspace.demoMode).toBe(false);
    });
  });
});
