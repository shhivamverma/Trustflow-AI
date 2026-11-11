import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createPayPalInvoiceDraft, PayPalInvoicePayload } from '@/lib/paypal';
import { isInvoiceApprovalBlocked, extractAmountInCents, fromCents } from '@/lib/billing-math';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true, evidence: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Safeguard: Block PayPal draft creation if invoice has an unresolved arithmetic mismatch
    const totalEvidence = invoice.evidence?.find((e) => e.fieldReference === 'statedProjectTotal');
    if (totalEvidence) {
      const quotedCents = extractAmountInCents(totalEvidence.sourceQuote);
      const statedTotal = quotedCents !== null ? fromCents(quotedCents) : null;

      if (statedTotal) {
        const blockCheck = isInvoiceApprovalBlocked({
          statedProjectTotal: statedTotal,
          calculatedSubtotal: invoice.total,
        });

        if (blockCheck.isBlocked) {
          return NextResponse.json(
            {
              error:
                blockCheck.reason ||
                `PayPal draft creation blocked: Invoice total (${invoice.currency} ${invoice.total}) conflicts with quoted project fee (${invoice.currency} ${statedTotal}). Reconcile discrepancy before drafting.`,
              discrepancy: blockCheck.discrepancy,
            },
            { status: 422 }
          );
        }
      }
    }

    // Idempotency: if already created on PayPal, return existing record
    if (invoice.paypalInvoiceId) {
      return NextResponse.json({
        invoice,
        message: 'PayPal draft already created for this invoice',
        idempotent: true,
      });
    }

    // Construct official PayPal Invoicing v2 payload
    const payload: PayPalInvoicePayload = {
      detail: {
        invoice_number: `TF-${Date.now().toString().slice(-6)}`,
        invoice_date: new Date().toISOString().split('T')[0],
        currency_code: invoice.currency,
        note: invoice.terms || 'Thank you for your business. Processed via TrustFlow AI.',
        payment_term: invoice.dueDate
          ? {
              term_type: 'DUE_ON_DATE_SPECIFIED',
              due_date: invoice.dueDate,
            }
          : {
              term_type: 'DUE_ON_RECEIPT',
            },
      },
      invoicer: {
        name: {
          given_name: 'TrustFlow',
          surname: 'Freelancer',
        },
      },
      primary_recipients: [
        {
          billing_info: {
            name: {
              full_name: invoice.clientName,
            },
            email_address: invoice.clientEmail,
          },
        },
      ],
      items: invoice.lineItems.map((item) => ({
        name: item.description,
        quantity: item.quantity,
        unit_amount: {
          currency_code: invoice.currency,
          value: item.unitAmount,
        },
      })),
      amount: {
        currency_code: invoice.currency,
        value: invoice.total,
        breakdown: {
          item_total: {
            currency_code: invoice.currency,
            value: invoice.total,
          },
        },
      },
    };

    // Call PayPal Adapter
    const result = await createPayPalInvoiceDraft(payload);

    // Update local database with returned PayPal ID and hosted URL
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        paypalInvoiceId: result.id,
        hostedInvoiceUrl: result.hostedInvoiceUrl,
        localStatus: 'DRAFT',
        statusHistory: {
          create: {
            previousStatus: invoice.localStatus,
            newStatus: 'DRAFT',
            source: result.isDemoFallback ? 'demo-fallback' : 'paypal',
            reason: `Created PayPal draft invoice ${result.id}`,
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
      message: result.isDemoFallback
        ? 'PayPal Draft created in labelled demo mode (configure PayPal keys for live sandbox).'
        : 'Official PayPal Sandbox draft created successfully.',
    });
  } catch (error: any) {
    console.error('Error in PayPal draft creation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create PayPal invoice draft' },
      { status: 500 }
    );
  }
}

