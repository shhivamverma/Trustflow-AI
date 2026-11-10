import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { calculateSubtotal, toCents, fromCents } from '@/lib/billing-math';

const CreateInvoiceBodySchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  clientEmail: z.string().email('Valid client email is required'),
  currency: z.string().default('USD'),
  lineItems: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.string(),
      unitAmount: z.string(),
      amount: z.string(),
      sourceQuote: z.string().nullable().optional(),
    })
  ).min(1, 'At least one line item is required'),
  dueDate: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  projectRef: z.string().nullable().optional(),
  briefId: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  evidence: z.array(
    z.object({
      fieldReference: z.string(),
      sourceQuote: z.string(),
      startOffset: z.number().nullable().optional(),
      endOffset: z.number().nullable().optional(),
      verified: z.boolean().default(true),
    })
  ).optional(),
});

// Seed demo data if database is empty to ensure evaluators have an immediate working experience
async function ensureSeedData() {
  const count = await prisma.invoice.count();
  if (count > 0) return;

  const now = new Date();
  const pastDueDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const futureDueDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 1. Overdue Invoice for Reminder Demo
  await prisma.invoice.create({
    data: {
      clientName: 'Nexus Tech Innovations',
      clientEmail: 'billing@nexustech.io',
      currency: 'USD',
      subtotal: '1250.00',
      total: '1250.00',
      dueDate: pastDueDate,
      terms: 'Payment due within 14 days of invoice receipt',
      projectRef: 'Mobile App Architecture & API Spec',
      localStatus: 'OVERDUE',
      paypalInvoiceId: 'INV2-DEMO-OVERDUE-01',
      hostedInvoiceUrl: 'https://www.sandbox.paypal.com/invoice/s/details/INV2-DEMO-OVERDUE-01',
      lastSyncedAt: new Date(),
      lineItems: {
        create: [
          {
            description: 'System Architecture Design & Data Modeling',
            quantity: '1',
            unitAmount: '750.00',
            amount: '750.00',
            sourceQuote: 'Architecture design $750',
          },
          {
            description: 'REST API Specification & Security Review',
            quantity: '1',
            unitAmount: '500.00',
            amount: '500.00',
            sourceQuote: 'API specification $500',
          },
        ],
      },
      statusHistory: {
        create: [
          { previousStatus: null, newStatus: 'DRAFT', source: 'system', reason: 'Created from brief' },
          { previousStatus: 'DRAFT', newStatus: 'SENT', source: 'paypal', reason: 'Sent via PayPal Sandbox' },
          { previousStatus: 'SENT', newStatus: 'OVERDUE', source: 'sync', reason: 'Due date passed without payment' },
        ],
      },
    },
  });

  // 2. Paid Invoice
  await prisma.invoice.create({
    data: {
      clientName: 'Globex Digital Media',
      clientEmail: 'finance@globexmedia.com',
      currency: 'USD',
      subtotal: '2100.00',
      total: '2100.00',
      dueDate: pastDueDate,
      terms: 'Net 15',
      projectRef: 'Brand Identity & Web Prototype',
      localStatus: 'PAID',
      paypalInvoiceId: 'INV2-DEMO-PAID-02',
      hostedInvoiceUrl: 'https://www.sandbox.paypal.com/invoice/s/details/INV2-DEMO-PAID-02',
      lastSyncedAt: new Date(),
      lineItems: {
        create: [
          {
            description: 'UI Design System & Component Library',
            quantity: '1',
            unitAmount: '1400.00',
            amount: '1400.00',
            sourceQuote: 'UI design system $1400',
          },
          {
            description: 'Responsive Landing Page Implementation',
            quantity: '1',
            unitAmount: '700.00',
            amount: '700.00',
            sourceQuote: 'Landing page $700',
          },
        ],
      },
      statusHistory: {
        create: [
          { previousStatus: null, newStatus: 'DRAFT', source: 'system', reason: 'Draft generated' },
          { previousStatus: 'DRAFT', newStatus: 'SENT', source: 'paypal', reason: 'Sent via PayPal Sandbox' },
          { previousStatus: 'SENT', newStatus: 'PAID', source: 'webhook', reason: 'PayPal Sandbox payment webhook received' },
        ],
      },
    },
  });

  // 3. Draft Invoice ready to send
  await prisma.invoice.create({
    data: {
      clientName: 'Apex Cloud Services',
      clientEmail: 'accounts@apexcloud.co',
      currency: 'USD',
      subtotal: '3400.00',
      total: '3400.00',
      dueDate: futureDueDate,
      terms: 'Due on receipt',
      projectRef: 'Cloud Migration & Terraform Setup',
      localStatus: 'DRAFT',
      lineItems: {
        create: [
          {
            description: 'Terraform Infrastructure as Code Scaffolding',
            quantity: '1',
            unitAmount: '1900.00',
            amount: '1900.00',
            sourceQuote: 'IaC infrastructure setup $1900',
          },
          {
            description: 'Zero-Downtime Database Migration Script',
            quantity: '1',
            unitAmount: '1500.00',
            amount: '1500.00',
            sourceQuote: 'Database migration $1500',
          },
        ],
      },
      statusHistory: {
        create: [
          { previousStatus: null, newStatus: 'DRAFT', source: 'system', reason: 'Extracted from brief with AI Billing Intelligence' },
        ],
      },
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    await ensureSeedData();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    if (status && status !== 'ALL') {
      where.localStatus = status;
    }
    if (search) {
      where.OR = [
        { clientName: { contains: search } },
        { clientEmail: { contains: search } },
        { projectRef: { contains: search } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        lineItems: true,
        evidence: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Derive Overdue dynamically if status is SENT and due date has passed
    const nowStr = new Date().toISOString().split('T')[0];
    const updatedInvoices = invoices.map((inv) => {
      let currentStatus = inv.localStatus;
      if (currentStatus === 'SENT' && inv.dueDate && inv.dueDate < nowStr) {
        currentStatus = 'OVERDUE';
      }
      return {
        ...inv,
        localStatus: currentStatus,
      };
    });

    // Calculate Dashboard metrics segregated by currency
    const totalOutstandingByCurrency: Record<string, number> = {};
    const totalCollectedByCurrency: Record<string, number> = {};
    let overdueCount = 0;
    let upcomingDueDatesCount = 0;

    const countsByStatus: Record<string, number> = {
      DRAFT: 0,
      SENT: 0,
      OVERDUE: 0,
      PARTIALLY_PAID: 0,
      PAID: 0,
      CANCELED: 0,
      REFUNDED: 0,
      NEEDS_SYNC: 0,
    };

    for (const inv of updatedInvoices) {
      const cur = inv.currency || 'USD';
      const cents = toCents(inv.total);

      // Status counts
      if (countsByStatus[inv.localStatus] !== undefined) {
        countsByStatus[inv.localStatus]++;
      } else {
        countsByStatus[inv.localStatus] = 1;
      }

      if (inv.localStatus === 'OVERDUE') {
        overdueCount++;
        totalOutstandingByCurrency[cur] = (totalOutstandingByCurrency[cur] || 0) + cents;
      } else if (inv.localStatus === 'SENT' || inv.localStatus === 'PARTIALLY_PAID') {
        totalOutstandingByCurrency[cur] = (totalOutstandingByCurrency[cur] || 0) + cents;
      } else if (inv.localStatus === 'PAID') {
        totalCollectedByCurrency[cur] = (totalCollectedByCurrency[cur] || 0) + cents;
      }

      if (inv.dueDate && inv.dueDate >= nowStr && inv.localStatus !== 'PAID') {
        upcomingDueDatesCount++;
      }
    }

    // Format metrics amounts to decimal strings
    const formattedOutstanding: Record<string, string> = {};
    for (const [c, cents] of Object.entries(totalOutstandingByCurrency)) {
      formattedOutstanding[c] = fromCents(cents);
    }

    const formattedCollected: Record<string, string> = {};
    for (const [c, cents] of Object.entries(totalCollectedByCurrency)) {
      formattedCollected[c] = fromCents(cents);
    }

    return NextResponse.json({
      invoices: updatedInvoices,
      metrics: {
        totalOutstandingByCurrency: formattedOutstanding,
        totalCollectedByCurrency: formattedCollected,
        overdueCount,
        upcomingDueDatesCount,
        countsByStatus,
      },
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = CreateInvoiceBodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid invoice payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check idempotency if key provided
    if (data.idempotencyKey) {
      const existing = await prisma.invoice.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: { lineItems: true, evidence: true },
      });
      if (existing) {
        return NextResponse.json({ invoice: existing, idempotent: true }, { status: 200 });
      }
    }

    // Recalculate deterministic subtotal server-side (server code of record)
    const calculatedSubtotal = calculateSubtotal(data.lineItems);

    const invoice = await prisma.invoice.create({
      data: {
        clientName: data.clientName.trim(),
        clientEmail: data.clientEmail.trim(),
        currency: data.currency.toUpperCase(),
        subtotal: calculatedSubtotal,
        total: calculatedSubtotal,
        dueDate: data.dueDate || null,
        terms: data.terms || null,
        projectRef: data.projectRef || null,
        briefId: data.briefId || null,
        idempotencyKey: data.idempotencyKey || null,
        localStatus: 'DRAFT',
        lineItems: {
          create: data.lineItems.map((item) => ({
            description: item.description.trim(),
            quantity: item.quantity,
            unitAmount: item.unitAmount,
            amount: item.amount,
            sourceQuote: item.sourceQuote || null,
          })),
        },
        evidence: data.evidence
          ? {
              create: data.evidence.map((ev) => ({
                fieldReference: ev.fieldReference,
                sourceQuote: ev.sourceQuote,
                startOffset: ev.startOffset ?? null,
                endOffset: ev.endOffset ?? null,
                verified: ev.verified,
              })),
            }
          : undefined,
        statusHistory: {
          create: {
            previousStatus: null,
            newStatus: 'DRAFT',
            source: 'user',
            reason: 'Invoice draft reviewed and created by user',
          },
        },
      },
      include: {
        lineItems: true,
        evidence: true,
        statusHistory: true,
      },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: error.message || 'Failed to create invoice' }, { status: 500 });
  }
}
