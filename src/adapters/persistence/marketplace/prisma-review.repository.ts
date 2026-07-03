import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type {
  CreateReviewInput,
  ReviewRecord,
  ReviewRepositoryPort,
  TargetRatingAggregate,
} from '../../../domain/marketplace/review.repository.port.js';

interface ReviewRow {
  id: string;
  shipmentId: string;
  authorId: string;
  targetId: string;
  rating: number;
  comment: string | null;
  communication: number | null;
  punctuality: number | null;
  packaging: number | null;
  overall: number | null;
  isVisible: boolean;
  createdAt: Date;
}

function roundRating(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class PrismaReviewRepository implements ReviewRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByShipmentAndAuthor(
    shipmentId: string,
    authorId: string,
  ): Promise<ReviewRecord | null> {
    const row = await this.prisma.review.findUnique({
      where: { shipmentId_authorId: { shipmentId, authorId } },
    });
    return row ? this.toRecord(row) : null;
  }

  async createAndRecomputeRating(
    input: CreateReviewInput,
  ): Promise<{ review: ReviewRecord; aggregate: TargetRatingAggregate }> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.review.create({
        data: {
          shipmentId: input.shipmentId,
          authorId: input.authorId,
          targetId: input.targetId,
          rating: input.rating,
          comment: input.comment ?? null,
          communication: input.communication ?? null,
          punctuality: input.punctuality ?? null,
          packaging: input.packaging ?? null,
          overall: input.overall ?? null,
        },
      });

      const agg = await tx.review.aggregate({
        where: { targetId: input.targetId, isVisible: true },
        _avg: { rating: true },
        _count: true,
      });
      const average = roundRating(agg._avg.rating ?? 0);
      const count = agg._count;

      await tx.user.update({
        where: { id: input.targetId },
        data: { rating: average },
      });

      return { review: this.toRecord(row), aggregate: { average, count } };
    });
  }

  async listByTarget(
    targetId: string,
    page: number,
    limit: number,
  ): Promise<{ data: readonly ReviewRecord[]; total: number; aggregate: TargetRatingAggregate }> {
    const [rows, total, agg] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { targetId, isVisible: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where: { targetId, isVisible: true } }),
      this.prisma.review.aggregate({
        where: { targetId, isVisible: true },
        _avg: { rating: true },
        _count: true,
      }),
    ]);
    return {
      data: rows.map((row) => this.toRecord(row)),
      total,
      aggregate: { average: roundRating(agg._avg.rating ?? 0), count: agg._count },
    };
  }

  async listByShipment(shipmentId: string): Promise<readonly ReviewRecord[]> {
    const rows = await this.prisma.review.findMany({
      where: { shipmentId, isVisible: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: ReviewRow): ReviewRecord {
    return {
      id: row.id,
      shipmentId: row.shipmentId,
      authorId: row.authorId,
      targetId: row.targetId,
      rating: row.rating,
      comment: row.comment,
      communication: row.communication,
      punctuality: row.punctuality,
      packaging: row.packaging,
      overall: row.overall,
      isVisible: row.isVisible,
      createdAt: row.createdAt,
    };
  }
}
