import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Line Item Schema & Types                                                   */
/* -------------------------------------------------------------------------- */

export type EvidenceStatus = 'VERIFIED' | 'AMBIGUOUS' | 'NOT FOUND' | 'MISMATCH';

export const LineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.string().regex(/^\d+(\.\d+)?$/, 'Quantity must be a positive number'),
  unitAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Unit price must be a valid decimal amount'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Total amount must be a valid decimal amount'),
  sourceQuote: z.string().nullable().optional(),
  startOffset: z.number().nullable().optional(),
  endOffset: z.number().nullable().optional(),
  evidenceStatus: z.enum(['VERIFIED', 'AMBIGUOUS', 'NOT FOUND', 'MISMATCH']).optional(),
});

export type LineItem = z.infer<typeof LineItemSchema>;

/* -------------------------------------------------------------------------- */
/* AI Extraction Schema & Billing Intelligence Types                          */
/* -------------------------------------------------------------------------- */

export const SourceEvidenceSchema = z.object({
  fieldReference: z.string(),
  sourceQuote: z.string(),
  startOffset: z.number().nullable().optional(),
  endOffset: z.number().nullable().optional(),
  status: z.enum(['VERIFIED', 'AMBIGUOUS', 'NOT FOUND', 'MISMATCH']).default('VERIFIED'),
  verified: z.boolean().default(true),
  lineItemIndex: z.number().nullable().optional(),
  quotedAmount: z.string().nullable().optional(),
  message: z.string().optional(),
});

export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;

export const ConsistencyCheckSchema = z.object({
  type: z.enum(['ARITHMETIC_MATCH', 'ARITHMETIC_MISMATCH', 'SCOPE_SUPPORTED', 'SCOPE_UNSUPPORTED', 'MISSING_FIELD', 'AMBIGUITY']),
  severity: z.enum(['INFO', 'WARNING', 'ERROR']),
  message: z.string(),
  field: z.string().optional(),
  details: z.record(z.any()).optional(),
});

export type ConsistencyCheck = z.infer<typeof ConsistencyCheckSchema>;

export const AIExtractionOutputSchema = z.object({
  clientName: z.string().nullable(),
  clientEmail: z.string().nullable(),
  currency: z.string().default('USD'),
  lineItems: z.array(LineItemSchema),
  statedProjectTotal: z.string().nullable(),
  calculatedTotal: z.string(),
  dueDate: z.string().nullable(), // YYYY-MM-DD
  paymentTerms: z.string().nullable(),
  projectReference: z.string().nullable(),
  confidence: z.object({
    overall: z.number().min(0).max(1),
    fields: z.record(z.number()),
  }),
  missingFields: z.array(z.string()),
  ambiguities: z.array(z.string()),
  consistencyChecks: z.array(ConsistencyCheckSchema),
  evidence: z.array(SourceEvidenceSchema),
  rawBrief: z.string(),
  provider: z.enum(['gemini', 'deterministic-fallback']),
  model: z.string(),
});

export type AIExtractionOutput = z.infer<typeof AIExtractionOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Invoice Entity & State Types                                               */
/* -------------------------------------------------------------------------- */

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'CANCELED'
  | 'REFUNDED'
  | 'NEEDS_SYNC';

export interface InvoiceDetail {
  id: string;
  briefId?: string | null;
  clientName: string;
  clientEmail: string;
  currency: string;
  subtotal: string;
  total: string;
  dueDate?: string | null;
  terms?: string | null;
  projectRef?: string | null;
  localStatus: InvoiceStatus;
  paypalInvoiceId?: string | null;
  hostedInvoiceUrl?: string | null;
  lastSyncedAt?: string | null;
  idempotencyKey?: string | null;
  lineItems: LineItem[];
  evidence?: SourceEvidence[];
  statusHistory?: Array<{
    id: string;
    previousStatus?: string | null;
    newStatus: string;
    source: string;
    reason?: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardMetrics {
  totalOutstandingByCurrency: Record<string, string>;
  totalCollectedByCurrency: Record<string, string>;
  overdueCount: number;
  upcomingDueDatesCount: number;
  countsByStatus: {
    DRAFT: number;
    SENT: number;
    OVERDUE: number;
    PARTIALLY_PAID: number;
    PAID: number;
    CANCELED: number;
    REFUNDED: number;
    NEEDS_SYNC: number;
  };
}

