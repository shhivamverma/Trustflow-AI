import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

    // Check Eligibility Rules (Page 6 & 14)
    if (invoice.localStatus === 'PAID') {
      return NextResponse.json(
        {
          eligible: false,
          reason: 'This invoice has already been fully paid. No reminder is necessary.',
        },
        { status: 400 }
      );
    }

    if (invoice.localStatus === 'CANCELED' || invoice.localStatus === 'REFUNDED') {
      return NextResponse.json(
        {
          eligible: false,
          reason: `Invoice is currently ${invoice.localStatus}. Reminders cannot be generated.`,
        },
        { status: 400 }
      );
    }

    if (!invoice.dueDate) {
      return NextResponse.json(
        {
          eligible: false,
          reason: 'No due date is set for this invoice. An invoice cannot be declared overdue without a scheduled due date.',
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const dueDateObj = new Date(invoice.dueDate);
    const isPastDue = dueDateObj < now;

    const daysOverdue = Math.max(
      1,
      Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Context-Aware Courteous Reminder Drafting (Using actual facts only)
    const invoiceNumber = invoice.paypalInvoiceId || `INV-${invoice.id.slice(-6).toUpperCase()}`;
    const clientName = invoice.clientName || 'there';
    const amountStr = `${invoice.currency} ${invoice.total}`;
    const dueDateFormatted = invoice.dueDate;
    const hostedLinkText = invoice.hostedInvoiceUrl
      ? `\n\nYou can review and settle the invoice securely via PayPal here:\n${invoice.hostedInvoiceUrl}`
      : '';

    const draftMessage = `Hi ${clientName},

I hope this message finds you well.

This is a gentle follow-up regarding invoice ${invoiceNumber} for ${amountStr}, which was due on ${dueDateFormatted}${
      isPastDue ? ` (${daysOverdue} days ago)` : ''
    }.

If you have already initiated this transfer, please disregard this note. Otherwise, could you kindly confirm an estimated timeline for payment?${hostedLinkText}

Please let me know if you have any questions or require any additional documentation.

Thank you for your partnership,
Freelancer Studio`;

    // Persist draft in ReminderDraft table
    const reminder = await prisma.reminderDraft.create({
      data: {
        invoiceId: invoice.id,
        message: draftMessage,
      },
    });

    return NextResponse.json({
      eligible: true,
      isPastDue,
      daysOverdue,
      draft: reminder.message,
      reminderId: reminder.id,
      invoiceNumber,
      clientEmail: invoice.clientEmail,
    });
  } catch (error: any) {
    console.error('Error generating reminder:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate reminder' }, { status: 500 });
  }
}

