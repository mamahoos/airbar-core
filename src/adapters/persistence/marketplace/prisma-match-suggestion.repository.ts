import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type {
  MatchSuggestionInput,
  MatchSuggestionRecord,
  MatchSuggestionRepositoryPort,
  MatchSuggestionStatus,
} from '../../../domain/marketplace/match-suggestion.repository.port.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class PrismaMatchSuggestionRepository implements MatchSuggestionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: MatchSuggestionInput): Promise<MatchSuggestionRecord> {
    const row = await this.prisma.matchSuggestion.upsert({
      where: {
        shipmentId_tripId: {
          shipmentId: input.shipmentId,
          tripId: input.tripId,
        },
      },
      create: {
        shipmentId: input.shipmentId,
        tripId: input.tripId,
        score: input.score,
        factors: input.factors as Prisma.InputJsonValue,
        source: input.source,
      },
      update: {
        score: input.score,
        factors: input.factors as Prisma.InputJsonValue,
        source: input.source,
        status: 'SUGGESTED',
      },
    });
    return this.toRecord(row);
  }

  async listForShipment(
    shipmentId: string,
    limit: number,
  ): Promise<readonly MatchSuggestionRecord[]> {
    const rows = await this.prisma.matchSuggestion.findMany({
      where: { shipmentId, status: 'SUGGESTED' },
      orderBy: [{ score: 'desc' }, { suggestedAt: 'desc' }],
      take: Math.max(1, Math.min(50, limit)),
    });
    return rows.map((row) => this.toRecord(row));
  }

  async listForTrip(tripId: string, limit: number): Promise<readonly MatchSuggestionRecord[]> {
    const rows = await this.prisma.matchSuggestion.findMany({
      where: { tripId, status: 'SUGGESTED' },
      orderBy: [{ score: 'desc' }, { suggestedAt: 'desc' }],
      take: Math.max(1, Math.min(50, limit)),
    });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: {
    id: string;
    shipmentId: string;
    tripId: string;
    score: number;
    factors: Prisma.JsonValue;
    source: string;
    status: string;
    suggestedAt: Date;
    updatedAt: Date;
  }): MatchSuggestionRecord {
    return {
      ...row,
      status: row.status as MatchSuggestionStatus,
    };
  }
}
