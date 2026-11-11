import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkPayPalConnection } from '@/lib/paypal';
import { checkGeminiConnection } from '@/lib/ai-adapter';

export async function GET() {
  try {
    const hasWebhook =
      !!process.env.PAYPAL_WEBHOOK_ID &&
      process.env.PAYPAL_WEBHOOK_ID.trim().length > 5 &&
      !process.env.PAYPAL_WEBHOOK_ID.includes('YOUR_WEBHOOK_ID');
    const hasGemini =
      !!process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY.trim().length > 5 &&
      !process.env.GEMINI_API_KEY.includes('YOUR_GEMINI_API_KEY');

    // Check actual PayPal and Gemini health/connection status
    const paypalStatus = await checkPayPalConnection();
    const geminiStatus = await checkGeminiConnection();

    // Get or create workspace settings
    let workspace = await prisma.workspaceSettings.findFirst();
    if (!workspace) {
      workspace = await prisma.workspaceSettings.create({
        data: {
          id: 'default-workspace',
          displayName: 'Freelancer Studio',
          defaultCurrency: 'USD',
          demoMode: paypalStatus.status !== 'LIVE',
        },
      });
    } else if (paypalStatus.status === 'LIVE' && workspace.demoMode) {
      workspace = await prisma.workspaceSettings.update({
        where: { id: workspace.id },
        data: { demoMode: false },
      });
    }

    return NextResponse.json({
      workspace,
      envStatus: {
        paypalConfigured: paypalStatus.status === 'LIVE',
        paypalStatus,
        paypalClientIdMasked: paypalStatus.clientIdMasked,
        paypalBaseUrl: paypalStatus.baseUrl,
        paypalWebhookConfigured: hasWebhook,
        geminiConfigured: hasGemini,
        geminiStatus,
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
    const { action, defaultCurrency, displayName, demoMode } = body;

    if (action === 'RESET_DEMO') {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          {
            error: 'Resetting demo data is disabled in production mode.',
            code: 'RESET_DISABLED_IN_PRODUCTION',
          },
          { status: 403 }
        );
      }

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
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          {
            error: 'Clearing all database records is disabled in production mode.',
            code: 'CLEAR_ALL_DISABLED_IN_PRODUCTION',
          },
          { status: 403 }
        );
      }

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
      try {
        const paypalStatus = await checkPayPalConnection(undefined, undefined, true);
        if (paypalStatus.status === 'LIVE') {
          return NextResponse.json({
            success: true,
            paypalStatus,
            message: paypalStatus.message,
          });
        } else {
          return NextResponse.json(
            {
              success: false,
              paypalStatus,
              message: paypalStatus.message,
              errorDetails: paypalStatus.errorDetails,
            },
            { status: 400 }
          );
        }
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            message: `PayPal Sandbox OAuth verification failed: ${err.message}.`,
          },
          { status: 400 }
        );
      }
    }

    if (action === 'TEST_GEMINI') {
      try {
        const geminiStatus = await checkGeminiConnection(undefined, true);
        if (geminiStatus.status === 'CONNECTED') {
          return NextResponse.json({
            success: true,
            geminiStatus,
            message: geminiStatus.message,
          });
        } else {
          return NextResponse.json(
            {
              success: false,
              geminiStatus,
              message: geminiStatus.message,
            },
            { status: 400 }
          );
        }
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            message: `Gemini API check failed: ${err.message}`,
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
        ...(typeof demoMode === 'boolean' ? { demoMode } : {}),
      },
      create: {
        id: 'default-workspace',
        defaultCurrency: defaultCurrency || 'USD',
        displayName: displayName || 'Freelancer Studio',
        demoMode: typeof demoMode === 'boolean' ? demoMode : true,
      },
    });

    return NextResponse.json({ workspace: updated });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
  }
}
