import { Injectable } from '@nestjs/common';
import { CampaignType, Prisma } from '@prisma/client';

import { FinanceGrpcClient } from '../../adapters/grpc-client/finance-grpc.client.js';
import { PrismaService } from '../../adapters/persistence/prisma.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { grantCreditKey } from '../../shared/idempotency/keys.js';

function parseAmountRials(raw: number): string {
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new ValidationError('amount must be a positive integer in rials');
  }
  return String(raw);
}

function normalizeSlug(raw: string): string {
  const slug = raw.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ValidationError('slug must be lowercase alphanumeric with optional hyphens');
  }
  return slug;
}

function serializeCampaign(campaign: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: CampaignType;
  amountRials: number;
  expiresAt: Date | null;
  active: boolean;
  maxGrants: number | null;
  grantCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: campaign.id,
    slug: campaign.slug,
    name: campaign.name,
    description: campaign.description,
    type: campaign.type,
    amountRials: campaign.amountRials,
    expiresAt: campaign.expiresAt?.toISOString() ?? null,
    active: campaign.active,
    maxGrants: campaign.maxGrants,
    grantCount: campaign.grantCount,
    createdBy: campaign.createdBy,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

function assertCampaignGrantable(campaign: {
  active: boolean;
  expiresAt: Date | null;
  maxGrants: number | null;
  grantCount: number;
}) {
  if (!campaign.active) {
    throw new ConflictError('campaign is not active');
  }
  if (campaign.expiresAt && campaign.expiresAt.getTime() <= Date.now()) {
    throw new ConflictError('campaign has expired');
  }
  if (campaign.maxGrants != null && campaign.grantCount >= campaign.maxGrants) {
    throw new ConflictError('campaign grant limit reached');
  }
}

@Injectable()
export class CreateCampaignUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    adminId: string,
    input: {
      slug: string;
      name: string;
      description?: string;
      type?: CampaignType;
      amountRials: number;
      expiresAt?: string;
      maxGrants?: number;
    },
  ) {
    const slug = normalizeSlug(input.slug);
    const name = input.name.trim();
    if (!name) {
      throw new ValidationError('name is required');
    }
    if (input.maxGrants != null && (!Number.isInteger(input.maxGrants) || input.maxGrants <= 0)) {
      throw new ValidationError('maxGrants must be a positive integer');
    }

    try {
      const campaign = await this.prisma.campaign.create({
        data: {
          slug,
          name,
          description: input.description?.trim() || null,
          type: input.type ?? CampaignType.PROMO_CREDIT,
          amountRials: input.amountRials,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          maxGrants: input.maxGrants ?? null,
          createdBy: adminId,
        },
      });
      return serializeCampaign(campaign);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('campaign slug already exists');
      }
      throw error;
    }
  }
}

@Injectable()
export class ListCampaignsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input?: { active?: boolean }) {
    const campaigns = await this.prisma.campaign.findMany({
      ...(input?.active !== undefined ? { where: { active: input.active } } : {}),
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map(serializeCampaign);
  }
}

@Injectable()
export class GetCampaignUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundError('campaign not found');
    }
    return serializeCampaign(campaign);
  }
}

@Injectable()
export class UpdateCampaignUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    campaignId: string,
    input: {
      name?: string;
      description?: string | null;
      type?: CampaignType;
      amountRials?: number;
      expiresAt?: string | null;
      active?: boolean;
      maxGrants?: number | null;
    },
  ) {
    await this.getCampaignOrThrow(campaignId);

    if (input.amountRials != null) {
      parseAmountRials(input.amountRials);
    }
    if (input.maxGrants != null && input.maxGrants <= 0) {
      throw new ValidationError('maxGrants must be a positive integer');
    }

    const campaign = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.amountRials !== undefined ? { amountRials: input.amountRials } : {}),
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
          : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.maxGrants !== undefined ? { maxGrants: input.maxGrants } : {}),
      },
    });
    return serializeCampaign(campaign);
  }

  private async getCampaignOrThrow(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundError('campaign not found');
    }
    return campaign;
  }
}

@Injectable()
export class GrantCampaignCreditUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceGrpcClient,
  ) {}

  async execute(
    adminId: string,
    campaignId: string,
    input: { userId: string; amountRials?: number; nonce?: string },
  ) {
    const userId = input.userId.trim();
    if (!userId) {
      throw new ValidationError('userId is required');
    }

    const nonce = (input.nonce?.trim() || 'default').slice(0, 64);
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundError('campaign not found');
    }

    assertCampaignGrantable(campaign);

    const amountRials = input.amountRials ?? campaign.amountRials;
    parseAmountRials(amountRials);

    const grant = await this.finance.grantCredit({
      userId,
      amount: String(amountRials),
      reason: campaign.name,
      campaignRef: campaign.id,
      ...(campaign.expiresAt ? { expiresAt: campaign.expiresAt } : {}),
      grantedBy: adminId,
      idempotencyKey: grantCreditKey(campaign.id, userId, nonce),
    });

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { grantCount: { increment: 1 } },
    });

    return {
      campaignId: campaign.id,
      campaignSlug: campaign.slug,
      grant: {
        id: grant.id,
        userId: grant.userId,
        amount: grant.amount,
        reason: grant.reason,
        campaignRef: grant.campaignRef || null,
        status: grant.status,
        grantedBy: grant.grantedBy,
        expiresAt: grant.expiresAt?.toISOString() ?? null,
        createdAt: grant.createdAt?.toISOString() ?? null,
      },
    };
  }
}
