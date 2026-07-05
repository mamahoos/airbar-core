import { describe, expect, it, jest } from '@jest/globals';
import { CampaignType } from '@prisma/client';

import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/index.js';

import {
  CreateCampaignUseCase,
  GetCampaignUseCase,
  GrantCampaignCreditUseCase,
  ListCampaignsUseCase,
  UpdateCampaignUseCase,
} from './campaign.use-cases.js';

const baseCampaign = {
  id: 'camp-1',
  slug: 'welcome-bonus',
  name: 'Welcome Bonus',
  description: null,
  type: CampaignType.PROMO_CREDIT,
  amountRials: 5000,
  expiresAt: null,
  active: true,
  maxGrants: 100,
  grantCount: 0,
  createdBy: 'admin-1',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('CreateCampaignUseCase', () => {
  it('creates a campaign with normalized slug', async () => {
    const prisma = {
      campaign: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...baseCampaign,
          ...data,
        })),
      },
    };
    const useCase = new CreateCampaignUseCase(prisma as never);
    const result = await useCase.execute('admin-1', {
      slug: 'Welcome-Bonus',
      name: 'Welcome Bonus',
      amountRials: 5000,
    });
    expect(result.slug).toBe('welcome-bonus');
    expect(prisma.campaign.create).toHaveBeenCalled();
  });

  it('rejects invalid slug', async () => {
    const useCase = new CreateCampaignUseCase({ campaign: { create: jest.fn() } } as never);
    await expect(
      useCase.execute('admin-1', { slug: 'bad slug!', name: 'x', amountRials: 1000 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('GrantCampaignCreditUseCase', () => {
  it('grants credit with deterministic campaign ref and idempotency key', async () => {
    const prisma = {
      campaign: {
        findUnique: jest.fn(async () => baseCampaign),
        update: jest.fn(async () => ({ ...baseCampaign, grantCount: 1 })),
      },
    };
    const finance = {
      grantCredit: jest.fn(async () => ({
        id: 'grant-1',
        userId: 'user-1',
        amount: '5000',
        reason: 'Welcome Bonus',
        campaignRef: 'camp-1',
        status: 'ACTIVE',
        grantedBy: 'admin-1',
        expiresAt: undefined,
        createdAt: new Date(),
      })),
    };
    const useCase = new GrantCampaignCreditUseCase(prisma as never, finance as never);
    const result = await useCase.execute('admin-1', 'camp-1', {
      userId: 'user-1',
      nonce: 'first',
    });

    expect(result.grant.campaignRef).toBe('camp-1');
    expect(finance.grantCredit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: '5000',
        campaignRef: 'camp-1',
        reason: 'Welcome Bonus',
        idempotencyKey: 'credit-grant:camp-1:user-1:first',
      }),
    );
    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 'camp-1' },
      data: { grantCount: { increment: 1 } },
    });
  });

  it('rejects inactive campaign', async () => {
    const prisma = {
      campaign: {
        findUnique: jest.fn(async () => ({ ...baseCampaign, active: false })),
      },
    };
    const useCase = new GrantCampaignCreditUseCase(
      prisma as never,
      { grantCredit: jest.fn() } as never,
    );
    await expect(useCase.execute('admin-1', 'camp-1', { userId: 'user-1' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('rejects expired campaign', async () => {
    const prisma = {
      campaign: {
        findUnique: jest.fn(async () => ({
          ...baseCampaign,
          expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        })),
      },
    };
    const useCase = new GrantCampaignCreditUseCase(
      prisma as never,
      { grantCredit: jest.fn() } as never,
    );
    await expect(useCase.execute('admin-1', 'camp-1', { userId: 'user-1' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('rejects missing campaign', async () => {
    const prisma = { campaign: { findUnique: jest.fn(async () => null) } };
    const useCase = new GrantCampaignCreditUseCase(
      prisma as never,
      { grantCredit: jest.fn() } as never,
    );
    await expect(
      useCase.execute('admin-1', 'missing', { userId: 'user-1' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ListCampaignsUseCase', () => {
  it('filters active campaigns when requested', async () => {
    const findMany = jest.fn(async () => [baseCampaign]);
    const useCase = new ListCampaignsUseCase({ campaign: { findMany } } as never);
    await useCase.execute({ active: true });
    expect(findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('GetCampaignUseCase', () => {
  it('returns campaign by id', async () => {
    const useCase = new GetCampaignUseCase({
      campaign: { findUnique: jest.fn(async () => baseCampaign) },
    } as never);
    const result = await useCase.execute('camp-1');
    expect(result.id).toBe('camp-1');
  });
});

describe('UpdateCampaignUseCase', () => {
  it('updates campaign active flag', async () => {
    const update = jest.fn(async () => ({ ...baseCampaign, active: false }));
    const useCase = new UpdateCampaignUseCase({
      campaign: {
        findUnique: jest.fn(async () => baseCampaign),
        update,
      },
    } as never);
    const result = await useCase.execute('camp-1', { active: false });
    expect(result.active).toBe(false);
    expect(update).toHaveBeenCalled();
  });
});
