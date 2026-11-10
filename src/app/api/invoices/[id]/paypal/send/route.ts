import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPayPalInvoice } from '@/lib/paypal';

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
        { error: 'Cannot send invoice without creating a PayPal draft first.' },
        { status: 400 }
      );
    }

    if (invoice.localStatus === 'SENT' || invoice.localStatus === 'PAID') {
      return NextResponse.json({
        invoice,
        message: `Invoice is already in ${invoice.localStatus} state`,
        idempotent: true,
      });
    }

    // Call PayPal Send API
    const result = await sendPayPalInvoice(invoice.paypalInvoiceId);

    // Update local state to SENT
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        localStatus: 'SENT',
        lastSyncedAt: new Date(),
        statusHistory: {
          create: {
            previousStatus: invoice.localStatus,
            newStatus: 'SENT',
            source: result.isDemoFallback ? 'demo-fallback' : 'paypal',
            reason: `Invoice ${invoice.paypalInvoiceId} sent to recipient ${invoice.clientEmail}`,
          },
        },
      },
      include: {
        lineItems: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    return NextResponse.json({
      invoice: updated,
      isDemoFallback: result.isDemoFallback,
      message: 'Invoice sent successfully through PayPal Invoicing.',
    });
  } catch (error: any) {
    console.error('Error sending PayPal invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send PayPal invoice' },
      { status: 500 }
    );
  }
}

