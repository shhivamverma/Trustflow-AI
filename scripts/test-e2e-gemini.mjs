import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runE2ETest() {
  console.log('================================================================');
  console.log(' TRUSTFLOW AI - LIVE GEMINI API END-TO-END INTEGRATION TEST');
  console.log('================================================================\n');

  const sampleBrief = `Freelance Design & Development Agreement
Client: Horizon Media Labs
Contact: finance@horizonmedia.io
Project Reference: HML-2026-PORTAL
Payment Terms: Net 30 upon invoice delivery
Target Delivery & Due Date: 2026-12-10

Scope of Work & Deliverables:
1. Cloud Infrastructure & DevOps Setup: $1,450.00
2. Next.js Responsive Client Portal: $2,850.00
3. PayPal Invoicing & Automated Billing Engine: $900.00

Total Agreed Project Budget: $5,200.00`;

  console.log('[1/4] Preparing sample project brief:');
  console.log('----------------------------------------------------');
  console.log(sampleBrief);
  console.log('----------------------------------------------------\n');

  console.log('[2/4] Sending POST request to /api/ai/extract on local server...');
  const startTime = Date.now();
  
  const response = await fetch('http://localhost:3000/api/ai/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ brief: sampleBrief }),
  });

  const durationMs = Date.now() - startTime;
  console.log(`HTTP Response Status: ${response.status} ${response.statusText} (${durationMs}ms)`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Extraction Error:', errorText);
    process.exit(1);
  }

  const json = await response.json();
  const extraction = json.extraction;
  const briefId = json.briefId;

  console.log('\n[3/4] Validating Live Gemini Extraction Results:');
  console.log('----------------------------------------------------');
  console.log(`Provider:                ${extraction.provider}`);
  console.log(`Model:                   ${extraction.model}`);
  console.log(`Fallback Activated?:     ${extraction.provider === 'deterministic-fallback' ? 'YES (FALLBACK ACTIVE)' : 'NO (PURE LIVE GEMINI)'}`);
  console.log(`Brief Record ID:         ${briefId}`);
  console.log(`Extracted Client Name:   ${extraction.clientName}`);
  console.log(`Extracted Client Email:  ${extraction.clientEmail}`);
  console.log(`Extracted Currency:      ${extraction.currency}`);
  console.log(`Extracted Due Date:      ${extraction.dueDate}`);
  console.log(`Extracted Terms:         ${extraction.paymentTerms}`);
  console.log(`Extracted Ref:           ${extraction.projectReference}`);
  console.log(`Stated Project Total:    $${extraction.statedProjectTotal}`);
  console.log(`Calculated Subtotal:     $${extraction.calculatedTotal}`);
  console.log(`Overall Confidence:      ${(extraction.confidence.overall * 100).toFixed(1)}%`);
  
  console.log('\nExtracted Line Items:');
  let manualSumCents = 0;
  extraction.lineItems.forEach((item, idx) => {
    const totalCents = Math.round(parseFloat(item.amount) * 100);
    manualSumCents += totalCents;

    console.log(`  ${idx + 1}. "${item.description}"`);
    console.log(`     Qty: ${item.quantity} | Unit: $${item.unitAmount} | Total: $${item.amount}`);
    console.log(`     Source Quote: "${item.sourceQuote}"`);
    console.log(`     Character Range: [${item.startOffset}–${item.endOffset}]`);
    console.log(`     Evidence Status: ${item.evidenceStatus || 'N/A'}`);
  });

  console.log('\n[4/4] Independent Server Arithmetic & Audit Trail Verification:');
  console.log('----------------------------------------------------');
  const manualSumDollars = (manualSumCents / 100).toFixed(2);
  const mathMatchesCalculated = manualSumDollars === extraction.calculatedTotal;
  const mathMatchesStated = manualSumDollars === extraction.statedProjectTotal;

  console.log(`Independent Sum of Line Items: $${manualSumDollars}`);
  console.log(`Matches extraction.calculatedTotal? ${mathMatchesCalculated ? '✓ YES' : '✗ NO'}`);
  console.log(`Matches extraction.statedProjectTotal? ${mathMatchesStated ? '✓ YES' : '✗ NO'}`);

  const mathCheck = extraction.consistencyChecks.find((c) => c.type === 'ARITHMETIC_MATCH');
  console.log(`Arithmetic Consistency Check: ${mathCheck ? `✓ PASSED (${mathCheck.message})` : '✗ FAILED'}`);

  // Check SQLite Database
  const dbRecord = await prisma.invoiceExtraction.findFirst({
    where: { briefId: briefId },
    orderBy: { createdAt: 'desc' },
  });

  if (dbRecord) {
    console.log(`Database Audit Trail: Verified in SQLite`);
    console.log(`  - DB Extraction ID:  ${dbRecord.id}`);
    console.log(`  - DB Provider:       ${dbRecord.provider}`);
    console.log(`  - DB Model:          ${dbRecord.model}`);
    console.log(`  - DB Validation:     ${dbRecord.validationOutcome}`);
  } else {
    console.warn(`Database Audit Trail: Record not found for briefId ${briefId}`);
  }

  await prisma.$disconnect();

  console.log('\n================================================================');
  console.log(' TEST RESULT: ' + (extraction.provider === 'gemini' && mathMatchesCalculated ? 'SUCCESS (100% LIVE GEMINI INFERENCE)' : 'FAILED'));
  console.log('================================================================\n');
}

runE2ETest().catch((err) => {
  console.error('E2E Test Execution Error:', err);
  process.exit(1);
});
