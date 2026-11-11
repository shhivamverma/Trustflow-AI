import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as extractPOST } from '../app/api/ai/extract/route';
import { prisma } from '../lib/db';

describe('AI Extract API Route Integration with Neon PostgreSQL', () => {
  it(
    'extracts and persists project brief and extraction in PostgreSQL',
    async () => {
      const sampleBrief = `
Project Agreement: Nexus Cloud Migration
Client: Nexus Tech Innovations
Email: billing@nexustech.io
Reference: NC-2026

Deliverables:
- Database Schema Architecture: 1 @ $1500.00
- Serverless API Migration: 1 @ $2500.00

Total project fee is USD 4000.00.
Payment due within 14 days upon receipt.
      `;

      const req = new NextRequest('http://localhost:3000/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: sampleBrief }),
      });

      const res = await extractPOST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.extraction).toBeDefined();
      expect(body.briefId).toBeDefined();
      expect(body.extraction.clientName).toContain('Nexus Tech');
      expect(body.extraction.calculatedTotal).toBe('4000.00');

      // Verify it was actually saved in the PostgreSQL database
      const savedBrief = await prisma.projectBrief.findUnique({
        where: { id: body.briefId },
        include: { extractions: true },
      });

      expect(savedBrief).toBeDefined();
      expect(savedBrief?.rawText).toContain('Nexus Cloud Migration');
      expect(savedBrief?.extractions.length).toBeGreaterThan(0);

      // Clean up test record
      if (savedBrief) {
        await prisma.projectBrief.delete({ where: { id: savedBrief.id } });
      }
    },
    25000
  );
});
