import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: true,
        evidence: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        revisions: {
          orderBy: { createdAt: 'desc' },
        },
        reminderDrafts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Derive Overdue if currently SENT and due date has passed
    const nowStr = new Date().toISOString().split('T')[0];
    let localStatus = invoice.localStatus;
    if (localStatus === 'SENT' && invoice.dueDate && invoice.dueDate < nowStr) {
      localStatus = 'OVERDUE';
    }

    return NextResponse.json({
      invoice: {
        ...invoice,
        localStatus,
      },
    });
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch invoice' }, { status: 500 });
  }
}

