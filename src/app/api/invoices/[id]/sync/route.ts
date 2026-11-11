import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPayPalInvoiceDetails } from '@/lib/paypal';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.paypalInvoiceId) {
      return NextResponse.json(
        { error: 'Cannot sync invoice before creating it on PayPal' },
        { status: 400 }
      );
    }

    // Fetch authoritative state from PayPal
    const details = await getPayPalInvoiceDetails(invoice.paypalInvoiceId);

    // Map PayPal status to TrustFlow local status
    let mappedStatus = invoice.localStatus;
    const rawStatus = (details.status || '').toUpperCase();

    if (rawStatus === 'PAID' || rawStatus === 'MARKED_AS_PAID') {
      mappedStatus = 'PAID';
    } else if (rawStatus === 'PARTIALLY_PAID') {
      mappedStatus = 'PARTIALLY_PAID';
    } else if (rawStatus === 'SENT' || rawStatus === 'UNPAID') {
      const nowStr = new Date().toISOString().split('T')[0];
      if (invoice.dueDate && invoice.dueDate < nowStr) {
        mappedStatus = 'OVERDUE';
      } else {
        mappedStatus = 'SENT';
      }
    } else if (rawStatus === 'CANCELLED' || rawStatus === 'CANCELED') {
      mappedStatus = 'CANCELED';
    } else if (rawStatus === 'REFUNDED') {
      mappedStatus = 'REFUNDED';
    }

    // SAFEGUARD: Never regress PAID to UNPAID
    if (invoice.localStatus === 'PAID' && mappedStatus !== 'PAID') {
      console.warn(`Prevented regression of PAID invoice ${id} to ${mappedStatus}`);
      mappedStatus = 'PAID';
    }

    const statusChanged = mappedStatus !== invoice.localStatus;

    // Update invoice record
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        localStatus: mappedStatus,
        lastSyncedAt: new Date(),
        hostedInvoiceUrl: details.hostedInvoiceUrl || invoice.hostedInvoiceUrl,
        statusHistory: statusChanged
          ? {
              create: {
                previousStatus: invoice.localStatus,
                newStatus: mappedStatus,
                source: 'sync',
                reason: `Synchronized from PayPal (remote status: ${details.status})`,
              },
            }
          : undefined,
      },
      include: {
        lineItems: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    return NextResponse.json({
      invoice: updated,
      statusChanged,
      remoteStatus: details.status,
      remoteAmount: details.totalAmount,
      currency: details.currency,
      isDemoFallback: details.isDemoFallback,
      message: `Invoice synchronized with PayPal: ${mappedStatus}`,
    });
  } catch (error: any) {
    console.error('Error synchronizing invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync with PayPal' },
      { status: 500 }
    );
  }
}

