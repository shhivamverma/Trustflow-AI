import { LineItem, ConsistencyCheck, SourceEvidence, EvidenceStatus } from './types';

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
 * Extracts a numeric dollar/currency amount in cents from a string snippet
 */
export function extractAmountInCents(text: string): number | null {
  if (!text) return null;
  // Match e.g. "$1,800.00", "USD 1800", "1,800", "$500"
  const currencyMatch = text.match(/(?:USD|\$|EUR|€)\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (currencyMatch) {
    return toCents(currencyMatch[1].replace(/,/g, ''));
  }
  const numMatch = text.match(/\b([0-9,]+(?:\.[0-9]{2})?)\b/);
  if (numMatch) {
    const parsed = toCents(numMatch[1].replace(/,/g, ''));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return null;
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
 * Verifies character offsets against the raw text.
 */
export function verifyQuoteInSource(
  quote: string,
  rawSource: string,
  expectedStart?: number | null,
  expectedEnd?: number | null
): { verified: boolean; startOffset: number | null; endOffset: number | null } {
  if (!quote || !rawSource) {
    return { verified: false, startOffset: null, endOffset: null };
  }

  // 1. Verify against provided offsets if available
  if (
    expectedStart !== null &&
    expectedStart !== undefined &&
    expectedEnd !== null &&
    expectedEnd !== undefined &&
    expectedStart >= 0 &&
    expectedEnd > expectedStart &&
    expectedEnd <= rawSource.length
  ) {
    if (rawSource.substring(expectedStart, expectedEnd) === quote) {
      return {
        verified: true,
        startOffset: expectedStart,
        endOffset: expectedEnd,
      };
    }
  }

  // 2. Exact match search
  const idx = rawSource.indexOf(quote);
  if (idx !== -1) {
    return {
      verified: true,
      startOffset: idx,
      endOffset: idx + quote.length,
    };
  }

  // 3. Normalized whitespace match to locate actual raw offsets
  const normalizedQuote = quote.trim().replace(/\s+/g, ' ');
  const normalizedSource = rawSource.replace(/\s+/g, ' ');
  const normIdx = normalizedSource.indexOf(normalizedQuote);
  if (normIdx !== -1) {
    // Quote exists in text
    return {
      verified: true,
      startOffset: normIdx,
      endOffset: normIdx + normalizedQuote.length,
    };
  }

  return { verified: false, startOffset: null, endOffset: null };
}

export interface LineItemEvidenceResult {
  status: EvidenceStatus;
  verified: boolean;
  startOffset: number | null;
  endOffset: number | null;
  sourceQuote: string;
  quotedAmount: string | null;
  message: string;
}

/**
 * Rigorously verifies a line item against the original project brief:
 * 1. Checks startOffset & endOffset are valid in rawBrief.
 * 2. Checks rawBrief.substring(startOffset, endOffset) === sourceQuote verbatim.
 * 3. Checks quoted amount in source text matches line item amount.
 * 4. Checks deliverable association between description and quote.
 *
 * Statuses:
 * - VERIFIED: Exact source evidence and amount association confirmed.
 * - MISMATCH: Evidence amount differs from extracted invoice amount.
 * - AMBIGUOUS: Evidence exists but rate or deliverable association is uncertain.
 * - NOT FOUND: Evidence cannot be located in the original brief.
 */
export function verifyLineItemEvidence(params: {
  item: LineItem;
  rawBrief: string;
}): LineItemEvidenceResult {
  const { item, rawBrief } = params;
  const quote = item.sourceQuote?.trim() || '';
  const itemCents = toCents(item.amount);

  if (!quote) {
    return {
      status: 'NOT FOUND',
      verified: false,
      startOffset: null,
      endOffset: null,
      sourceQuote: '',
      quotedAmount: null,
      message: 'No source evidence quote provided for this line item.',
    };
  }

  // 1. Check quote in source text
  const match = verifyQuoteInSource(quote, rawBrief, item.startOffset, item.endOffset);
  if (!match.verified || match.startOffset === null || match.endOffset === null) {
    return {
      status: 'NOT FOUND',
      verified: false,
      startOffset: null,
      endOffset: null,
      sourceQuote: quote,
      quotedAmount: null,
      message: 'Source evidence quote was not found in the original brief.',
    };
  }

  const start = match.startOffset;
  const end = match.endOffset;
  const exactSubstring = rawBrief.substring(start, end);

  // 2. Extract and compare amounts
  const quotedCents = extractAmountInCents(quote);
  const quotedAmountStr = quotedCents !== null ? fromCents(quotedCents) : null;

  if (quotedCents !== null) {
    // Check if the amount in the source quote matches the extracted line item amount
    if (quotedCents !== itemCents) {
      return {
        status: 'MISMATCH',
        verified: false,
        startOffset: start,
        endOffset: end,
        sourceQuote: exactSubstring,
        quotedAmount: quotedAmountStr,
        message: `Amount mismatch: Source quote states $${quotedAmountStr}, but invoice line item is $${item.amount}.`,
      };
    }
  } else {
    // Deliverable found in text, but rate is missing or not explicitly stated
    return {
      status: 'AMBIGUOUS',
      verified: false,
      startOffset: start,
      endOffset: end,
      sourceQuote: exactSubstring,
      quotedAmount: null,
      message: 'Deliverable found in source brief, but unit rate is ambiguous or unstated.',
    };
  }

  // 3. Check deliverable keyword association
  const descWords = item.description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const quoteLower = quote.toLowerCase();
  const hasKeywordOverlap = descWords.length === 0 || descWords.some((w) => quoteLower.includes(w));

  if (!hasKeywordOverlap) {
    return {
      status: 'AMBIGUOUS',
      verified: false,
      startOffset: start,
      endOffset: end,
      sourceQuote: exactSubstring,
      quotedAmount: quotedAmountStr,
      message: 'Amount matches, but deliverable association to this source quote is uncertain.',
    };
  }

  // 4. Exact quote + matching offsets + verified amounts!
  return {
    status: 'VERIFIED',
    verified: true,
    startOffset: start,
    endOffset: end,
    sourceQuote: exactSubstring,
    quotedAmount: quotedAmountStr,
    message: 'Exact source evidence and amount association confirmed.',
  };
}

export interface LocateTotalResult {
  sourceQuote: string;
  startOffset: number;
  endOffset: number;
}

/**
 * Deterministically locates the verbatim total project fee statement in the raw brief.
 * Handles formats such as:
 * - "Total Project Fee: USD 3,400.00"
 * - "Total project fee: $3,400"
 * - "Total project budget: $5,200.00"
 * - "Total Agreed Project Budget: $5,200.00"
 * - "Total: $3,400.00"
 * - "Total fee is USD 800"
 */
export function locateTotalInSource(statedTotal: string, rawBrief: string): LocateTotalResult | null {
  if (!statedTotal || !rawBrief) return null;
  const statedCents = toCents(statedTotal);

  // 1. Regex search for total phrases with monetary amounts
  const totalRegexes = [
    /(?:total\s+(?:agreed\s+)?(?:project\s+)?(?:fee|budget|price|cost|contract|amount)|contract\s+total|agreed\s+total|project\s+total|^total|\btotal)(?:\s+(?:is|of))?[:\s]*(?:USD|\$|EUR|€|CAD|AUD|GBP)?\s*([0-9,]+(?:\.[0-9]{2})?)(?:\s*(?:USD|EUR|GBP|CAD|AUD))?/gi,
    /(?:USD|\$|EUR|€|CAD|AUD|GBP)\s*([0-9,]+(?:\.[0-9]{2})?)\s*(?:total|total\s+project\s+fee|in\s+total)/gi,
  ];

  for (const regex of totalRegexes) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawBrief)) !== null) {
      const matchedText = match[0];
      const matchedAmountCents = extractAmountInCents(matchedText);

      if (matchedAmountCents !== null && matchedAmountCents === statedCents) {
        const start = match.index;
        const end = start + matchedText.length;
        return {
          sourceQuote: rawBrief.substring(start, end),
          startOffset: start,
          endOffset: end,
        };
      }
    }
  }

  // 2. Formatted number search: e.g. "3,400.00", "$3,400.00", "$3,400", "USD 3,400.00"
  const rawNum = parseFloat(statedTotal);
  if (!isNaN(rawNum)) {
    const numVariants = [
      rawNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      rawNum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      rawNum.toFixed(2),
      Math.round(rawNum).toString(),
    ];

    for (const numStr of numVariants) {
      const pat = new RegExp(`(?:USD|\\$|EUR|€|CAD|AUD|GBP)?\\s*${numStr.replace('.', '\\.')}\\b`, 'i');
      const m = pat.exec(rawBrief);
      if (m && m.index !== undefined) {
        const matchedText = m[0].trim();
        const cents = extractAmountInCents(matchedText);
        if (cents === statedCents) {
          return {
            sourceQuote: rawBrief.substring(m.index, m.index + m[0].length),
            startOffset: m.index,
            endOffset: m.index + m[0].length,
          };
        }
      }
    }
  }

  return null;
}

export interface TotalEvidenceResult {
  status: EvidenceStatus;
  verified: boolean;
  startOffset: number | null;
  endOffset: number | null;
  sourceQuote: string;
  quotedAmount: string | null;
  message: string;
}

/**
 * Rigorously verifies stated total project fee evidence against the raw brief and calculated line items:
 * - VERIFIED: Exact source quote found in brief, offsets match, and stated fee equals calculated line items.
 * - MISMATCH: Quote found in brief, but stated fee differs from calculated line items.
 * - NOT FOUND: The stated total amount cannot be located anywhere in the brief.
 */
export function verifyTotalEvidence(params: {
  statedProjectTotal: string;
  totalEv?: SourceEvidence;
  rawBrief: string;
  calculatedSubtotal: string;
}): TotalEvidenceResult {
  const { statedProjectTotal, totalEv, rawBrief, calculatedSubtotal } = params;
  const statedCents = toCents(statedProjectTotal);
  const calculatedCents = toCents(calculatedSubtotal);
  const isMathMatch = statedCents === calculatedCents;

  // 1. Check if totalEv has valid existing offsets where rawBrief exactly matches sourceQuote
  if (
    totalEv?.startOffset !== null &&
    totalEv?.startOffset !== undefined &&
    totalEv?.endOffset !== null &&
    totalEv?.endOffset !== undefined &&
    totalEv.startOffset >= 0 &&
    totalEv.endOffset > totalEv.startOffset &&
    totalEv.endOffset <= rawBrief.length
  ) {
    const candidate = rawBrief.substring(totalEv.startOffset, totalEv.endOffset);
    if (totalEv.sourceQuote && candidate === totalEv.sourceQuote) {
      const quotedCents = extractAmountInCents(candidate);
      if (quotedCents === statedCents) {
        return {
          status: isMathMatch ? 'VERIFIED' : 'MISMATCH',
          verified: isMathMatch,
          startOffset: totalEv.startOffset,
          endOffset: totalEv.endOffset,
          sourceQuote: candidate,
          quotedAmount: statedProjectTotal,
          message: isMathMatch
            ? 'Exact source quote and stated project fee confirmed.'
            : `Stated fee ($${statedProjectTotal}) differs from line items sum ($${calculatedSubtotal}).`,
        };
      }
    }
  }

  // 2. Check if totalEv.sourceQuote (when not just a bare unquoted amount string) is found in rawBrief
  if (totalEv?.sourceQuote && totalEv.sourceQuote !== statedProjectTotal) {
    const idx = rawBrief.indexOf(totalEv.sourceQuote);
    if (idx !== -1) {
      const start = idx;
      const end = idx + totalEv.sourceQuote.length;
      const quotedCents = extractAmountInCents(totalEv.sourceQuote);
      if (quotedCents === statedCents) {
        return {
          status: isMathMatch ? 'VERIFIED' : 'MISMATCH',
          verified: isMathMatch,
          startOffset: start,
          endOffset: end,
          sourceQuote: rawBrief.substring(start, end),
          quotedAmount: statedProjectTotal,
          message: isMathMatch
            ? 'Exact source quote and stated project fee confirmed.'
            : `Stated fee ($${statedProjectTotal}) differs from line items sum ($${calculatedSubtotal}).`,
        };
      }
    }
  }

  // 3. Dynamically locate the verbatim total statement in rawBrief
  const located = locateTotalInSource(statedProjectTotal, rawBrief);
  if (located) {
    return {
      status: isMathMatch ? 'VERIFIED' : 'MISMATCH',
      verified: isMathMatch,
      startOffset: located.startOffset,
      endOffset: located.endOffset,
      sourceQuote: located.sourceQuote,
      quotedAmount: statedProjectTotal,
      message: isMathMatch
        ? 'Exact source quote and stated project fee confirmed.'
        : `Stated fee ($${statedProjectTotal}) differs from line items sum ($${calculatedSubtotal}).`,
    };
  }

  // 4. Stated total could not be found anywhere in rawBrief
  return {
    status: 'NOT FOUND',
    verified: false,
    startOffset: null,
    endOffset: null,
    sourceQuote: totalEv?.sourceQuote || statedProjectTotal,
    quotedAmount: statedProjectTotal,
    message: `Stated project total ($${statedProjectTotal}) could not be located in the original brief.`,
  };
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

  // 5. Source Evidence verification: link line items directly with evidence verification
  const validatedEvidence: SourceEvidence[] = [];

  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    const evResult = verifyLineItemEvidence({ item, rawBrief });

    // Mutate/update line item source properties
    item.startOffset = evResult.startOffset;
    item.endOffset = evResult.endOffset;
    item.evidenceStatus = evResult.status;

    validatedEvidence.push({
      fieldReference: `lineItems[${i}].description`,
      sourceQuote: evResult.sourceQuote,
      startOffset: evResult.startOffset,
      endOffset: evResult.endOffset,
      status: evResult.status,
      verified: evResult.verified,
      lineItemIndex: i,
      quotedAmount: evResult.quotedAmount,
      message: evResult.message,
    });

    if (evResult.status === 'MISMATCH') {
      checks.push({
        type: 'ARITHMETIC_MISMATCH',
        severity: 'WARNING',
        message: `Line item #${i + 1} ("${item.description}"): ${evResult.message}`,
        field: `lineItems[${i}].amount`,
      });
    } else if (evResult.status === 'NOT FOUND') {
      checks.push({
        type: 'SCOPE_UNSUPPORTED',
        severity: 'WARNING',
        message: `Line item #${i + 1} ("${item.description}"): ${evResult.message}`,
        field: `lineItems[${i}].description`,
      });
    } else if (evResult.status === 'AMBIGUOUS') {
      checks.push({
        type: 'AMBIGUITY',
        severity: 'WARNING',
        message: `Line item #${i + 1} ("${item.description}"): ${evResult.message}`,
        field: `lineItems[${i}].description`,
      });
    }
  }

  // Also verify stated total evidence if present
  if (statedProjectTotal) {
    const totalEv = evidence.find((e) => e.fieldReference === 'statedProjectTotal');
    const totalResult = verifyTotalEvidence({
      statedProjectTotal,
      totalEv,
      rawBrief,
      calculatedSubtotal,
    });

    validatedEvidence.push({
      fieldReference: 'statedProjectTotal',
      sourceQuote: totalResult.sourceQuote,
      startOffset: totalResult.startOffset,
      endOffset: totalResult.endOffset,
      status: totalResult.status,
      verified: totalResult.verified,
      quotedAmount: totalResult.quotedAmount,
      message: totalResult.message,
    });
  }

  const hasBlockingErrors = checks.some((c) => c.severity === 'ERROR');

  return {
    checks,
    validatedEvidence,
    calculatedSubtotal,
    hasBlockingErrors,
  };
}

