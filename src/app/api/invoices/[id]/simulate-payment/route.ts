import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.localStatus === 'PAID') {
      return NextResponse.json({ invoice, message: 'Invoice is already marked as PAID' });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        localStatus: 'PAID',
        lastSyncedAt: new Date(),
        statusHistory: {
          create: {
            previousStatus: invoice.localStatus,
            newStatus: 'PAID',
            source: 'sandbox-simulation',
            reason: 'Sandbox client payment simulation completed (Demo Harness)',
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
      message: 'Sandbox payment successfully simulated and reconciled to PAID.',
    });
  } catch (error: any) {
    console.error('Error simulating payment:', error);
    return NextResponse.json({ error: error.message || 'Simulation failed' }, { status: 500 });
  }
}

