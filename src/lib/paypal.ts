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
  const id = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
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
  return process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
}

/**
 * Server-side OAuth 2.0 Client Credentials token exchange
 */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing in environment variables.');
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
  const hostedLink = invoiceData.links?.find((l: any) => l.rel === 'payer-view')?.href;

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
  const hostedLink = data.links?.find((l: any) => l.rel === 'payer-view')?.href;

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

