import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { getPayPalInvoiceDetails } from '@/lib/paypal';
import { verifyPayPalWebhookSignature, resolveReconciledStatus } from '@/lib/paypal-webhook';

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

    // 1. Cryptographic Signature Verification via official PayPal API
    const isValid = await verifyPayPalWebhookSignature(
      {
        transmissionId: req.headers.get('paypal-transmission-id'),
        transmissionTime: req.headers.get('paypal-transmission-time'),
        certUrl: req.headers.get('paypal-cert-url'),
        authAlgo: req.headers.get('paypal-auth-algo'),
        transmissionSig: req.headers.get('paypal-transmission-sig'),
      },
      bodyText
    );

    if (!isValid) {
      console.warn(`Rejected PayPal webhook with invalid signature or missing webhook config: ${eventId}`);
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
    let remoteStatus: string | null = null;
    try {
      const liveDetails = await getPayPalInvoiceDetails(paypalInvoiceId);
      remoteStatus = liveDetails.status || null;
    } catch (fetchErr) {
      console.warn(
        `Could not fetch live PayPal status for ${paypalInvoiceId}, falling back to event type ${eventType}:`,
        fetchErr
      );
      remoteStatus = null;
    }

    const reconciledStatus = resolveReconciledStatus(
      localInvoice.localStatus,
      remoteStatus,
      eventType,
      localInvoice.dueDate
    );

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
