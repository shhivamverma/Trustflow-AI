import { describe, it, expect } from 'vitest';

describe('Context-Aware Payment Reminder Rules', () => {
  function checkEligibility(invoice: {
    localStatus: string;
    dueDate: string | null;
  }): { eligible: boolean; reason?: string } {
    if (invoice.localStatus === 'PAID') {
      return { eligible: false, reason: 'This invoice has already been fully paid.' };
    }
    if (invoice.localStatus === 'CANCELED' || invoice.localStatus === 'REFUNDED') {
      return { eligible: false, reason: 'Invoice is canceled/refunded.' };
    }
    if (!invoice.dueDate) {
      return { eligible: false, reason: 'No due date is set.' };
    }
    return { eligible: true };
  }

  function draftReminder(invoice: {
    clientName: string;
    invoiceNumber: string;
    total: string;
    currency: string;
    dueDate: string;
  }): string {
    return `Hi ${invoice.clientName},\n\nThis is a gentle follow-up regarding invoice ${invoice.invoiceNumber} for ${invoice.currency} ${invoice.total}, which was due on ${invoice.dueDate}.\n\nCould you kindly confirm an estimated timeline for payment?\n\nThank you for your partnership,\nFreelancer Studio`;
  }

  it('rejects reminder generation for already PAID invoices', () => {
    const res = checkEligibility({ localStatus: 'PAID', dueDate: '2026-10-01' });
    expect(res.eligible).toBe(false);
  });

  it('rejects reminder generation when due date is absent', () => {
    const res = checkEligibility({ localStatus: 'SENT', dueDate: null });
    expect(res.eligible).toBe(false);
  });

  it('permits reminder for OVERDUE invoices and generates courteous factual draft', () => {
    const res = checkEligibility({ localStatus: 'OVERDUE', dueDate: '2026-10-15' });
    expect(res.eligible).toBe(true);

    const draft = draftReminder({
      clientName: 'Nexus Tech',
      invoiceNumber: 'TF-894012',
      total: '1250.00',
      currency: 'USD',
      dueDate: '2026-10-15',
    });

    expect(draft).toContain('Nexus Tech');
    expect(draft).toContain('USD 1250.00');
    expect(draft).toContain('TF-894012');
    expect(draft).toContain('2026-10-15');
    // Polite and non-threatening
    expect(draft).toContain('gentle follow-up');
    expect(draft).not.toContain('legal action');
    expect(draft).not.toContain('penalty');
  });
});

