import { PayPalConnectionStatus, PayPalStatusCategory } from './types';

export { type PayPalConnectionStatus, type PayPalStatusCategory };

/**
 * Sanitizes credential values by trimming whitespace and stripping surrounding quotes
 */
export function sanitizeCredential(val?: string | null): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * PayPal Invoicing API v2 Sandbox Integration Adapter
 * Spec compliance: Page 12-13 of TrustFlow AI Build Specification.
 */

export interface PayPalInvoicePayload {
  detail: {
    invoice_number?: string;
    invoice_date?: string;
    payment_term?: {
      term_type?: string;
      due_date?: string;
    };
    currency_code: string;
    note?: string;
    terms_and_conditions?: string;
  };
  invoicer?: {
    name?: {
      given_name?: string;
      surname?: string;
    };
    email_address?: string;
  };
  primary_recipients: Array<{
    billing_info: {
      name?: {
        full_name?: string;
      };
      email_address: string;
    };
  }>;
  items: Array<{
    name: string;
    description?: string;
    quantity: string;
    unit_amount: {
      currency_code: string;
      value: string;
    };
  }>;
  amount?: {
    currency_code: string;
    value?: string;
    breakdown?: {
      item_total?: {
        currency_code: string;
        value: string;
      };
    };
  };
}

export function isPayPalConfigured(): boolean {
  const id = sanitizeCredential(process.env.PAYPAL_CLIENT_ID);
  const secret = sanitizeCredential(process.env.PAYPAL_CLIENT_SECRET);
  return Boolean(
    id &&
    secret &&
    id.length > 5 &&
    secret.length > 5 &&
    !id.includes('YOUR_CLIENT_ID') &&
    !secret.includes('YOUR_CLIENT_SECRET')
  );
}

export function getPayPalBaseUrl(): string {
  const raw = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
  return raw.trim().replace(/\/+$/, '');
}

let cachedPayPalStatus: PayPalConnectionStatus | null = null;
let lastPayPalCheckTime = 0;
const PAYPAL_CACHE_TTL_MS = 60000;

/**
 * Health check that verifies actual PayPal Sandbox API OAuth connection using configured credentials.
 * Status values strictly separated into:
 * - 'LIVE': Authenticated with live PayPal Sandbox OAuth (200 OK)
 * - 'MOCKED': Deterministic demo mode active
 * - 'NOT_CONFIGURED': Keys missing or template placeholder
 * - 'FAILED': Keys present but PayPal returned an error (e.g. 401 invalid_client)
 */
export async function checkPayPalConnection(
  customClientId?: string,
  customClientSecret?: string,
  forceCheck = false
): Promise<PayPalConnectionStatus> {
  const rawId = customClientId !== undefined ? customClientId : process.env.PAYPAL_CLIENT_ID;
  const rawSecret = customClientSecret !== undefined ? customClientSecret : process.env.PAYPAL_CLIENT_SECRET;

  const clientId = sanitizeCredential(rawId);
  const clientSecret = sanitizeCredential(rawSecret);
  const baseUrl = getPayPalBaseUrl();
  const hasWebhook = Boolean(
    process.env.PAYPAL_WEBHOOK_ID &&
    !process.env.PAYPAL_WEBHOOK_ID.includes('YOUR_WEBHOOK_ID') &&
    sanitizeCredential(process.env.PAYPAL_WEBHOOK_ID).length > 5
  );

  const isPlaceholder =
    !clientId ||
    !clientSecret ||
    clientId.includes('YOUR_CLIENT_ID') ||
    clientSecret.includes('YOUR_CLIENT_SECRET') ||
    clientId.length < 5 ||
    clientSecret.length < 5;

  if (isPlaceholder) {
    const status: PayPalConnectionStatus = {
      status: 'NOT_CONFIGURED',
      configured: false,
      message: 'PayPal Sandbox credentials are not configured in .env (PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET missing or placeholder).',
      clientIdMasked: null,
      baseUrl,
      webhookConfigured: hasWebhook,
      testedAt: new Date().toISOString(),
    };
    if (customClientId === undefined) {
      cachedPayPalStatus = status;
      lastPayPalCheckTime = Date.now();
    }
    return status;
  }

  if (!forceCheck && cachedPayPalStatus && Date.now() - lastPayPalCheckTime < PAYPAL_CACHE_TTL_MS) {
    return cachedPayPalStatus;
  }

  const clientIdMasked =
    clientId.length > 8
      ? `${clientId.slice(0, 8)}...${clientId.slice(-4)}`
      : `${clientId.slice(0, 4)}...`;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const hasGlobalWindow = typeof window !== 'undefined';
    let signal: any = undefined;
    if (!hasGlobalWindow && typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      signal = AbortSignal.timeout(8000);
    }

    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      ...(signal ? { signal } : {}),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        const status: PayPalConnectionStatus = {
          status: 'LIVE',
          configured: true,
          message: `Successfully authenticated with PayPal Sandbox API (${baseUrl}).`,
          clientIdMasked,
          baseUrl,
          webhookConfigured: hasWebhook,
          testedAt: new Date().toISOString(),
        };
        if (customClientId === undefined) {
          cachedPayPalStatus = status;
          lastPayPalCheckTime = Date.now();
        }
        return status;
      }
    }

    const errorText = await res.text();
    let errorDesc = errorText;
    try {
      const parsed = JSON.parse(errorText);
      errorDesc = parsed.error_description || parsed.error || errorText;
    } catch {}

    let diag = '';
    if (res.status === 401) {
      diag = 'HTTP 401 invalid_client: Client Authentication failed. Verify that Client ID and Secret were copied from the Sandbox tab (not Live) on developer.paypal.com, belong to the exact same REST App, and contain no accidental quotes or whitespace in .env.';
    }

    const status: PayPalConnectionStatus = {
      status: 'FAILED',
      configured: false,
      message: `PayPal OAuth verification failed [${res.status}]: ${errorDesc}`,
      errorDetails: diag || errorDesc,
      clientIdMasked,
      baseUrl,
      webhookConfigured: hasWebhook,
      testedAt: new Date().toISOString(),
    };

    if (customClientId === undefined) {
      cachedPayPalStatus = status;
      lastPayPalCheckTime = Date.now();
    }
    return status;
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout');
    const status: PayPalConnectionStatus = {
      status: 'FAILED',
      configured: false,
      message: isTimeout
        ? `Connection to PayPal Sandbox API timed out (${baseUrl}).`
        : `Network error connecting to PayPal API (${baseUrl}): ${err.message}`,
      errorDetails: err.message,
      clientIdMasked,
      baseUrl,
      webhookConfigured: hasWebhook,
      testedAt: new Date().toISOString(),
    };

    if (customClientId === undefined) {
      cachedPayPalStatus = status;
      lastPayPalCheckTime = Date.now();
    }
    return status;
  }
}

/**
 * Server-side OAuth 2.0 Client Credentials token exchange
 */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = sanitizeCredential(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = sanitizeCredential(process.env.PAYPAL_CLIENT_SECRET);

  if (!clientId || !clientSecret || clientId.includes('YOUR_CLIENT_ID') || clientSecret.includes('YOUR_CLIENT_SECRET')) {
    throw new Error('PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing or still set to template placeholder in .env.');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const baseUrl = getPayPalBaseUrl();

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal OAuth authentication failed [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Generates official PayPal Invoice Draft
 */
export async function createPayPalInvoiceDraft(payload: PayPalInvoicePayload): Promise<{
  id: string;
  status: string;
  hostedInvoiceUrl?: string;
  isDemoFallback: boolean;
}> {
  if (!isPayPalConfigured()) {
    // Labelled deterministic fallback for demo evaluation without keys
    const mockId = `INV2-DEMO-${Date.now().toString().slice(-6)}`;
    return {
      id: mockId,
      status: 'DRAFT',
      hostedInvoiceUrl: `https://www.sandbox.paypal.com/invoice/s/details/${mockId}`,
      isDemoFallback: true,
    };
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const response = await fetch(`${baseUrl}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `PayPal Draft Creation Error [${response.status}]: ${
        errorData.message || JSON.stringify(errorData)
      }`
    );
  }

  const invoiceData = await response.json();
  const hostedLink =
    invoiceData.links?.find((l: any) => l.rel === 'payer-view')?.href ||
    `https://www.sandbox.paypal.com/invoice/s/details/${invoiceData.id}`;

  return {
    id: invoiceData.id,
    status: invoiceData.status || 'DRAFT',
    hostedInvoiceUrl: hostedLink,
    isDemoFallback: false,
  };
}

/**
 * Explicitly sends an existing PayPal draft invoice
 */
export async function sendPayPalInvoice(invoiceId: string): Promise<{
  status: string;
  isDemoFallback: boolean;
}> {
  if (!isPayPalConfigured() || invoiceId.startsWith('INV2-DEMO-')) {
    return {
      status: 'SENT',
      isDemoFallback: true,
    };
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const response = await fetch(`${baseUrl}/v2/invoicing/invoices/${invoiceId}/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      send_to_recipient: true,
      send_to_invoicer: true,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `PayPal Send Invoice Error [${response.status}]: ${
        errorData.message || JSON.stringify(errorData)
      }`
    );
  }

  return {
    status: 'SENT',
    isDemoFallback: false,
  };
}

/**
 * Retrieves current invoice details from PayPal
 */
export async function getPayPalInvoiceDetails(invoiceId: string): Promise<{
  id: string;
  status: string;
  totalAmount: string;
  paidAmount: string;
  currency: string;
  hostedInvoiceUrl?: string;
  isDemoFallback: boolean;
}> {
  if (!isPayPalConfigured() || invoiceId.startsWith('INV2-DEMO-')) {
    // Deterministic fallback response for demo records
    return {
      id: invoiceId,
      status: 'SENT',
      totalAmount: '0.00',
      paidAmount: '0.00',
      currency: 'USD',
      hostedInvoiceUrl: `https://www.sandbox.paypal.com/invoice/s/details/${invoiceId}`,
      isDemoFallback: true,
    };
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const response = await fetch(`${baseUrl}/v2/invoicing/invoices/${invoiceId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `PayPal Get Invoice Error [${response.status}]: ${
        errorData.message || JSON.stringify(errorData)
      }`
    );
  }

  const data = await response.json();
  const hostedLink =
    data.links?.find((l: any) => l.rel === 'payer-view')?.href ||
    `https://www.sandbox.paypal.com/invoice/s/details/${data.id}`;

  return {
    id: data.id,
    status: data.status,
    totalAmount: data.amount?.value || '0.00',
    paidAmount: data.payments?.paid_amount?.value || '0.00',
    currency: data.amount?.currency_code || 'USD',
    hostedInvoiceUrl: hostedLink,
    isDemoFallback: false,
  };
}

