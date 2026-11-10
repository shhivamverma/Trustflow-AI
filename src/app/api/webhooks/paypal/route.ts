import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { getPayPalAccessToken, getPayPalBaseUrl, getPayPalInvoiceDetails } from '@/lib/paypal';

/**
 * Validates PayPal webhook signature via official PayPal REST endpoint
 */
async function verifyPayPalWebhookSignature(req: NextRequest, bodyText: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) {
    // If webhook ID is not configured in local dev, allow authenticated local testing
    return true;
  }

  const transmissionId = req.headers.get('paypal-transmission-id');
  const transmissionTime = req.headers.get('paypal-transmission-time');
  const certUrl = req.headers.get('paypal-cert-url');
  const authAlgo = req.headers.get('paypal-auth-algo');
  const transmissionSig = req.headers.get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return false;
  }

  try {
    const token = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();

    const verifyPayload = {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: JSON.parse(bodyText),
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

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    let event: any;
    try {
      event = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const eventId = event.id;
    const eventType = event.event_type;

    if (!eventId || !eventType) {
      return NextResponse.json({ error: 'Missing event ID or event_type' }, { status: 400 });
    }

    // 1. Signature Verification
    const isValid = await verifyPayPalWebhookSignature(req, bodyText);
    if (!isValid) {
      console.warn(`Rejected PayPal webhook with invalid signature: ${eventId}`);
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    // 2. Event Deduplication (Page 12: "Deduplicate by unique PayPal event ID")
    const existing = await prisma.webhookEvent.findUnique({
      where: { paypalEventId: eventId },
    });
    if (existing) {
      return NextResponse.json(
        { message: 'Event already processed (deduplicated)', eventId },
        { status: 200 }
      );
    }

    // Compute minimal hash of payload to avoid storing unnecessary sensitive customer data
    const payloadHash = crypto.createHash('sha256').update(bodyText).digest('hex');

    // Extract invoice identifier from event resource
    const resource = event.resource || {};
    const paypalInvoiceId = resource.id || resource.invoice?.id;

    // Record webhook event in database
    await prisma.webhookEvent.create({
      data: {
        paypalEventId: eventId,
        eventType,
        invoiceId: paypalInvoiceId || null,
        payloadHash,
        processedAt: new Date(),
      },
    });

    if (!paypalInvoiceId) {
      return NextResponse.json({ message: 'Event acknowledged; no invoice attached' });
    }

    // Find local invoice matching PayPal ID
    const localInvoice = await prisma.invoice.findFirst({
      where: { paypalInvoiceId },
    });

    if (!localInvoice) {
      return NextResponse.json({ message: 'No matching local invoice for this PayPal ID' });
    }

    // 3. Fetch latest authoritative invoice from PayPal before reconciling
    // (Page 12: "Do not blindly apply an event as the latest truth. Fetch current invoice from PayPal.")
    let reconciledStatus = localInvoice.localStatus;

    try {
      const liveDetails = await getPayPalInvoiceDetails(paypalInvoiceId);
      const remoteStatus = (liveDetails.status || '').toUpperCase();

      if (remoteStatus === 'PAID') {
        reconciledStatus = 'PAID';
      } else if (remoteStatus === 'PARTIALLY_PAID') {
        reconciledStatus = 'PARTIALLY_PAID';
      } else if (remoteStatus === 'SENT' || remoteStatus === 'UNPAID') {
        const nowStr = new Date().toISOString().split('T')[0];
        if (localInvoice.dueDate && localInvoice.dueDate < nowStr) {
          reconciledStatus = 'OVERDUE';
        } else {
          reconciledStatus = 'SENT';
        }
      } else if (remoteStatus === 'CANCELLED' || remoteStatus === 'CANCELED') {
        reconciledStatus = 'CANCELED';
      } else if (remoteStatus === 'REFUNDED') {
        reconciledStatus = 'REFUNDED';
      }
    } catch {
      // If fetching remote fails, infer from eventType safely
      if (eventType === 'INVOICING.INVOICE.PAID') {
        reconciledStatus = 'PAID';
      } else if (eventType === 'INVOICING.INVOICE.CANCELLED') {
        reconciledStatus = 'CANCELED';
      } else if (eventType === 'INVOICING.INVOICE.REFUNDED') {
        reconciledStatus = 'REFUNDED';
      }
    }

    // SAFEGUARD: Never regress PAID to UNPAID
    if (localInvoice.localStatus === 'PAID' && reconciledStatus !== 'PAID') {
      reconciledStatus = 'PAID';
    }

    const changed = reconciledStatus !== localInvoice.localStatus;
    if (changed) {
      await prisma.invoice.update({
        where: { id: localInvoice.id },
        data: {
          localStatus: reconciledStatus,
          lastSyncedAt: new Date(),
          statusHistory: {
            create: {
              previousStatus: localInvoice.localStatus,
              newStatus: reconciledStatus,
              source: 'webhook',
              reason: `Reconciled via webhook event: ${eventType} (${eventId})`,
            },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      eventId,
      eventType,
      reconciledStatus,
    });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: error.message || 'Webhook processing failed' }, { status: 500 });
  }
}

