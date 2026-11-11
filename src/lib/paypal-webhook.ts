import { getPayPalAccessToken, getPayPalBaseUrl, sanitizeCredential } from '@/lib/paypal';

export interface PayPalWebhookHeaders {
  transmissionId?: string | null;
  transmissionTime?: string | null;
  certUrl?: string | null;
  authAlgo?: string | null;
  transmissionSig?: string | null;
}

/**
 * Validates PayPal webhook signature via official PayPal REST endpoint.
 * Returns false if webhook ID or any required transmission headers are missing.
 */
export async function verifyPayPalWebhookSignature(
  headers: PayPalWebhookHeaders,
  bodyText: string,
  webhookIdOverride?: string
): Promise<boolean> {
  const webhookId = sanitizeCredential(webhookIdOverride || process.env.PAYPAL_WEBHOOK_ID);
  if (!webhookId) {
    // If webhook ID is not configured, reject verification (no mock pass)
    return false;
  }

  const { transmissionId, transmissionTime, certUrl, authAlgo, transmissionSig } = headers;

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return false;
  }

  try {
    const token = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();

    let parsedEvent: unknown;
    try {
      parsedEvent = JSON.parse(bodyText);
    } catch {
      return false;
    }

    const verifyPayload = {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: parsedEvent,
    };

    const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verifyPayload),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('Webhook verification error:', err);
    return false;
  }
}

/**
 * Resolves reconciled status from authoritative remote status or fallback event type.
 * Priority: Authoritative live PayPal status > Fallback event type.
 * Safeguard: Never regresses PAID to unpaid (SENT, DRAFT, OVERDUE, PARTIALLY_PAID).
 */
export function resolveReconciledStatus(
  currentLocalStatus: string,
  remoteStatus: string | null | undefined,
  eventType: string,
  dueDate?: string | null
): string {
  let reconciledStatus = currentLocalStatus;

  // 1. Authoritative remote PayPal status takes precedence
  if (remoteStatus) {
    const upperRemote = remoteStatus.toUpperCase();
    if (upperRemote === 'PAID' || upperRemote === 'MARKED_AS_PAID') {
      reconciledStatus = 'PAID';
    } else if (upperRemote === 'PARTIALLY_PAID') {
      reconciledStatus = 'PARTIALLY_PAID';
    } else if (upperRemote === 'SENT' || upperRemote === 'UNPAID') {
      const nowStr = new Date().toISOString().split('T')[0];
      if (dueDate && dueDate < nowStr) {
        reconciledStatus = 'OVERDUE';
      } else {
        reconciledStatus = 'SENT';
      }
    } else if (upperRemote === 'CANCELLED' || upperRemote === 'CANCELED') {
      reconciledStatus = 'CANCELED';
    } else if (upperRemote === 'REFUNDED') {
      reconciledStatus = 'REFUNDED';
    }
  } else {
    // 2. Fallback to webhook event type mapping when remote status is not available
    if (eventType === 'INVOICING.INVOICE.PAID') {
      reconciledStatus = 'PAID';
    } else if (eventType === 'INVOICING.INVOICE.CANCELLED' || eventType === 'INVOICING.INVOICE.CANCELED') {
      reconciledStatus = 'CANCELED';
    } else if (eventType === 'INVOICING.INVOICE.REFUNDED') {
      reconciledStatus = 'REFUNDED';
    } else if (eventType === 'INVOICING.INVOICE.SENT') {
      const nowStr = new Date().toISOString().split('T')[0];
      if (dueDate && dueDate < nowStr) {
        reconciledStatus = 'OVERDUE';
      } else {
        reconciledStatus = 'SENT';
      }
    } else if (eventType === 'INVOICING.INVOICE.CREATED') {
      reconciledStatus = 'DRAFT';
    } else if (eventType === 'INVOICING.INVOICE.UPDATED') {
      // In fallback mode when remote invoice details cannot be retrieved, retain current status
      reconciledStatus = currentLocalStatus;
    }
  }

  // SAFEGUARD: Never regress PAID to UNPAID (SENT, DRAFT, OVERDUE, PARTIALLY_PAID)
  if (
    currentLocalStatus === 'PAID' &&
    (reconciledStatus === 'SENT' ||
      reconciledStatus === 'DRAFT' ||
      reconciledStatus === 'OVERDUE' ||
      reconciledStatus === 'PARTIALLY_PAID')
  ) {
    reconciledStatus = 'PAID';
  }

  return reconciledStatus;
}

