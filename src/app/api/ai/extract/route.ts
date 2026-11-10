import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractWithGemini, extractWithDeterministicEngine } from '@/lib/ai-adapter';
import { AIExtractionOutputSchema } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawBrief = body?.brief;

    if (!rawBrief || typeof rawBrief !== 'string' || rawBrief.trim().length === 0) {
      return NextResponse.json({ error: 'Project brief text is required' }, { status: 400 });
    }

    if (rawBrief.length > 50000) {
      return NextResponse.json(
        { error: 'Project brief exceeds the 50,000 character maximum limit.' },
        { status: 413 }
      );
    }

    // Persist raw brief in SQLite
    const briefRecord = await prisma.projectBrief.create({
      data: {
        rawText: rawBrief,
      },
    });

    // Check Gemini API key
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    let extractionResult;

    if (geminiKey && geminiKey.length > 5) {
      try {
        extractionResult = await extractWithGemini(geminiKey, rawBrief);
        console.log(`[AI Extraction] Successfully parsed with Gemini model: ${extractionResult.model}`);
      } catch (err: any) {
        console.warn('[AI Extraction] Gemini extraction failed, falling back to deterministic billing engine:', err.message);
        extractionResult = extractWithDeterministicEngine(rawBrief);
      }
    } else {
      extractionResult = extractWithDeterministicEngine(rawBrief);
    }

    // Validate output with Zod
    const validated = AIExtractionOutputSchema.safeParse(extractionResult);
    if (!validated.success) {
      console.error('Validation error on extraction output:', validated.error);
      return NextResponse.json(
        { error: 'AI output validation failed', details: validated.error.format() },
        { status: 502 }
      );
    }

    // Store extraction audit trail
    await prisma.invoiceExtraction.create({
      data: {
        briefId: briefRecord.id,
        structuredOutput: JSON.stringify(validated.data),
        provider: validated.data.provider,
        model: validated.data.model,
        validationOutcome:
          validated.data.consistencyChecks.some((c) => c.severity === 'ERROR')
            ? 'ERRORS'
            : validated.data.consistencyChecks.some((c) => c.severity === 'WARNING')
            ? 'WARNINGS'
            : 'VALID',
      },
    });

    return NextResponse.json({
      extraction: validated.data,
      briefId: briefRecord.id,
    });
  } catch (error: any) {
    console.error('Extraction API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error processing project brief' },
      { status: 500 }
    );
  }
}

