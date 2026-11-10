import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPayPalAccessToken } from '@/lib/paypal';

export async function GET() {
  try {
    const hasPayPalId = !!process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_ID.trim().length > 5;
    const hasPayPalSecret = !!process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_CLIENT_SECRET.trim().length > 5;
    const hasWebhook = !!process.env.PAYPAL_WEBHOOK_ID && process.env.PAYPAL_WEBHOOK_ID.trim().length > 5;
    const hasGemini = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5;

    // Get or create workspace settings
    let workspace = await prisma.workspaceSettings.findFirst();
    if (!workspace) {
      workspace = await prisma.workspaceSettings.create({
        data: {
          id: 'default-workspace',
          displayName: 'Freelancer Studio',
          defaultCurrency: 'USD',
          demoMode: !hasPayPalId || !hasPayPalSecret,
        },
      });
    }

    return NextResponse.json({
      workspace,
      envStatus: {
        paypalConfigured: hasPayPalId && hasPayPalSecret,
        paypalClientIdMasked: hasPayPalId ? `${process.env.PAYPAL_CLIENT_ID?.slice(0, 8)}...` : null,
        paypalBaseUrl: process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com',
        paypalWebhookConfigured: hasWebhook,
        geminiConfigured: hasGemini,
      },
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, defaultCurrency, displayName } = body;

    if (action === 'RESET_DEMO') {
      // Clear database and reseed
      await prisma.invoiceLineItem.deleteMany();
      await prisma.sourceEvidence.deleteMany();
      await prisma.invoiceRevision.deleteMany();
      await prisma.invoiceStatusHistory.deleteMany();
      await prisma.reminderDraft.deleteMany();
      await prisma.invoice.deleteMany();
      await prisma.projectBrief.deleteMany();

      return NextResponse.json({ message: 'Demo data reset successfully' });
    }

    if (action === 'CLEAR_ALL') {
      await prisma.invoiceLineItem.deleteMany();
      await prisma.sourceEvidence.deleteMany();
      await prisma.invoiceRevision.deleteMany();
      await prisma.invoiceStatusHistory.deleteMany();
      await prisma.reminderDraft.deleteMany();
      await prisma.invoice.deleteMany();
      await prisma.projectBrief.deleteMany();

      return NextResponse.json({ message: 'All invoices and briefs cleared' });
    }

    if (action === 'TEST_PAYPAL') {
      // Test real PayPal OAuth token retrieval if credentials configured
      try {
        await getPayPalAccessToken();
        return NextResponse.json({ success: true, message: 'Successfully authenticated with PayPal Sandbox API.' });
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            message: `PayPal Sandbox OAuth verification failed: ${err.message}. Deterministic demo mode will be used for continuity.`,
          },
          { status: 400 }
        );
      }
    }

    // Update workspace settings
    const updated = await prisma.workspaceSettings.upsert({
      where: { id: 'default-workspace' },
      update: {
        defaultCurrency: defaultCurrency || 'USD',
        displayName: displayName || 'Freelancer Studio',
      },
      create: {
        id: 'default-workspace',
        defaultCurrency: defaultCurrency || 'USD',
        displayName: displayName || 'Freelancer Studio',
      },
    });

    return NextResponse.json({ workspace: updated });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
  }
}
