import { describe, it, expect } from 'vitest';
import { prisma } from '../lib/db';

describe('Neon PostgreSQL Connectivity & Integration', () => {
  it('connects to Neon PostgreSQL and executes raw engine query', async () => {
    const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version();`;
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].version).toContain('PostgreSQL');
  });

  it('verifies WorkspaceSettings model read and write in Neon PostgreSQL', async () => {
    let settings = await prisma.workspaceSettings.findFirst();
    if (!settings) {
      settings = await prisma.workspaceSettings.create({
        data: {
          id: 'default-workspace',
          displayName: 'Freelancer Studio',
          defaultCurrency: 'USD',
          demoMode: false,
        },
      });
    }
    expect(settings).toBeDefined();
    expect(settings.id).toBe('default-workspace');
    expect(settings.defaultCurrency).toBe('USD');
  });

  it('verifies all relational tables are accessible without schema mismatch', async () => {
    const briefCount = await prisma.projectBrief.count();
    const invoiceCount = await prisma.invoice.count();
    const lineItemCount = await prisma.invoiceLineItem.count();
    const webhookCount = await prisma.webhookEvent.count();

    expect(typeof briefCount).toBe('number');
    expect(typeof invoiceCount).toBe('number');
    expect(typeof lineItemCount).toBe('number');
    expect(typeof webhookCount).toBe('number');
  });

  it('verifies project briefs and AI extractions persisted in Neon PostgreSQL', async () => {
    const latestBrief = await prisma.projectBrief.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { extractions: true },
    });

    expect(latestBrief).toBeDefined();
    expect(latestBrief?.rawText).toBeDefined();
    expect(latestBrief?.extractions.length).toBeGreaterThan(0);
    const extraction = latestBrief?.extractions[0];
    expect(extraction?.structuredOutput).toBeDefined();
    const parsed = JSON.parse(extraction!.structuredOutput);
    expect(parsed.clientName).toBeDefined();
    expect(parsed.calculatedTotal).toBeDefined();
  });
});

