import { LineItem, ConsistencyCheck, SourceEvidence } from './types';

/**
 * Converts a decimal string or number to integer cents to guarantee precision
 * without JavaScript binary floating-point errors (e.g. 0.1 + 0.2 !== 0.3)
 */
export function toCents(amount: string | number): number {
  if (typeof amount === 'number') {
    return Math.round(amount * 100);
  }
  const clean = amount.trim().replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/**
 * Converts integer cents back to formatted decimal string with 2 decimal places
 */
export function fromCents(cents: number): string {
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainingCents = abs % 100;
  const formatted = `${dollars}.${remainingCents.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Safely multiplies quantity by unit amount in decimal cents
 */
export function calculateItemTotal(quantityStr: string, unitAmountStr: string): string {
  const qty = parseFloat(quantityStr) || 1;
  const unitCents = toCents(unitAmountStr);
  const totalCents = Math.round(qty * unitCents);
  return fromCents(totalCents);
}

/**
 * Sums up an array of LineItems deterministically
 */
export function calculateSubtotal(items: Array<{ quantity: string; unitAmount: string }>): string {
  let subtotalCents = 0;
  for (const item of items) {
    const qty = parseFloat(item.quantity) || 1;
    const unitCents = toCents(item.unitAmount);
    subtotalCents += Math.round(qty * unitCents);
  }
  return fromCents(subtotalCents);
}

/**
 * Checks whether an evidence quote actually appears verbatim inside the original raw brief.
 * Returns true if found, and attaches exact character offsets.
 */
export function verifyQuoteInSource(
  quote: string,
  rawSource: string
): { verified: boolean; startOffset: number | null; endOffset: number | null } {
  if (!quote || !rawSource) {
    return { verified: false, startOffset: null, endOffset: null };
  }

  // Exact match
  const idx = rawSource.indexOf(quote);
  if (idx !== -1) {
    return {
      verified: true,
      startOffset: idx,
      endOffset: idx + quote.length,
    };
  }

  // Normalized whitespace match
  const normalizedSource = rawSource.replace(/\s+/g, ' ');
  const normalizedQuote = quote.trim().replace(/\s+/g, ' ');
  const normIdx = normalizedSource.indexOf(normalizedQuote);
  if (normIdx !== -1) {
    return {
      verified: true,
      startOffset: normIdx,
      endOffset: normIdx + normalizedQuote.length,
    };
  }

  return { verified: false, startOffset: null, endOffset: null };
}

/**
 * Performs deterministic AI Billing Intelligence checks:
 * 1. Line-item sum vs Stated project total (e.g. $800 sum vs $950 stated fee)
 * 2. Missing client email, missing currency, missing due date
 * 3. Non-negative checks
 * 4. Verifies each evidence quote exists in source text
 */
export function runBillingIntelligenceChecks(params: {
  rawBrief: string;
  clientName?: string | null;
  clientEmail?: string | null;
  currency: string;
  lineItems: LineItem[];
  statedProjectTotal?: string | null;
  dueDate?: string | null;
  evidence: SourceEvidence[];
}): {
  checks: ConsistencyCheck[];
  validatedEvidence: SourceEvidence[];
  calculatedSubtotal: string;
  hasBlockingErrors: boolean;
} {
  const { rawBrief, clientName, clientEmail, currency, lineItems, statedProjectTotal, dueDate, evidence } = params;
  const checks: ConsistencyCheck[] = [];

  // 1. Calculate deterministic line-item total
  const calculatedSubtotal = calculateSubtotal(lineItems);
  const calculatedCents = toCents(calculatedSubtotal);

  // 2. Validate line items count and non-negative amounts
  if (lineItems.length === 0) {
    checks.push({
      type: 'MISSING_FIELD',
      severity: 'ERROR',
      message: 'At least one line item is required to create a PayPal invoice.',
      field: 'lineItems',
    });
  }

  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    const itemCents = toCents(item.amount);
    if (itemCents < 0) {
      checks.push({
        type: 'ARITHMETIC_MISMATCH',
        severity: 'ERROR',
        message: `Line item #${i + 1} ("${item.description}") has a negative amount.`,
        field: `lineItems[${i}].amount`,
      });
    }

    // Verify item calculation matches qty * unit
    const expectedItemTotal = calculateItemTotal(item.quantity, item.unitAmount);
    if (toCents(expectedItemTotal) !== itemCents) {
      checks.push({
        type: 'ARITHMETIC_MISMATCH',
        severity: 'WARNING',
        message: `Line item #${i + 1} extension mismatch: ${item.quantity} × ${item.unitAmount} = ${expectedItemTotal}, but got ${item.amount}. Recalculated.`,
        field: `lineItems[${i}].amount`,
      });
    }
  }

  // 3. Stated project total comparison (Example Mismatch Requirement)
  if (statedProjectTotal) {
    const statedCents = toCents(statedProjectTotal);
    if (statedCents !== calculatedCents) {
      const diffCents = Math.abs(calculatedCents - statedCents);
      const diffStr = fromCents(diffCents);
      checks.push({
        type: 'ARITHMETIC_MISMATCH',
        severity: 'WARNING',
        message: `Invoice line items total ${currency} ${calculatedSubtotal}, but the project brief explicitly quoted ${currency} ${statedProjectTotal}. Review the ${currency} ${diffStr} difference before creating the PayPal invoice.`,
        field: 'total',
        details: {
          calculatedTotal: calculatedSubtotal,
          statedTotal: statedProjectTotal,
          difference: diffStr,
        },
      });
    } else {
      checks.push({
        type: 'ARITHMETIC_MATCH',
        severity: 'INFO',
        message: `Line items sum (${currency} ${calculatedSubtotal}) exactly matches the stated project total in the brief.`,
        field: 'total',
      });
    }
  }

  // 4. Missing required PayPal fields check
  if (!clientName || clientName.trim() === '') {
    checks.push({
      type: 'MISSING_FIELD',
      severity: 'WARNING',
      message: 'Client name is missing or ambiguous. Required for invoice creation.',
      field: 'clientName',
    });
  }

  if (!clientEmail || clientEmail.trim() === '') {
    checks.push({
      type: 'MISSING_FIELD',
      severity: 'WARNING',
      message: 'Client email is missing from the brief. PayPal Invoicing requires a valid recipient email to deliver the invoice.',
      field: 'clientEmail',
    });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
    checks.push({
      type: 'AMBIGUITY',
      severity: 'WARNING',
      message: `Extracted email "${clientEmail}" does not appear to be a valid email format.`,
      field: 'clientEmail',
    });
  }

  if (!dueDate || dueDate.trim() === '') {
    checks.push({
      type: 'MISSING_FIELD',
      severity: 'INFO',
      message: 'No due date was found in the brief. Please select a payment due date.',
      field: 'dueDate',
    });
  }

  // 5. Source Evidence verification against raw brief
  const validatedEvidence = evidence.map((ev) => {
    const match = verifyQuoteInSource(ev.sourceQuote, rawBrief);
    if (!match.verified) {
      checks.push({
        type: 'SCOPE_UNSUPPORTED',
        severity: 'WARNING',
        message: `Evidence quote "${ev.sourceQuote.slice(0, 45)}..." could not be verified in the source text.`,
        field: ev.fieldReference,
      });
    }
    return {
      ...ev,
      verified: match.verified,
      startOffset: match.startOffset,
      endOffset: match.endOffset,
    };
  });

  const hasBlockingErrors = checks.some((c) => c.severity === 'ERROR');

  return {
    checks,
    validatedEvidence,
    calculatedSubtotal,
    hasBlockingErrors,
  };
}

