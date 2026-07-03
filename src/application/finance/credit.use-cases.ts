import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { FinanceGrpcClient } from '../../adapters/grpc-client/finance-grpc.client.js';
import { ValidationError } from '../../shared/errors/index.js';

function parseAmountRials(raw: number): string {
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new ValidationError('amount must be a positive integer in rials');
  }
  return String(raw);
}

@Injectable()
export class GrantAdminCreditUseCase {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute(
    adminId: string,
    input: {
      userId: string;
      amount: number;
      reason: string;
      campaignRef?: string;
      expiresAt?: string;
    },
  ) {
    const userId = input.userId.trim();
    const reason = input.reason.trim();
    if (!userId || !reason) {
      throw new ValidationError('userId and reason are required');
    }

    const grant = await this.finance.grantCredit({
      userId,
      amount: parseAmountRials(input.amount),
      reason,
      ...(input.campaignRef?.trim() ? { campaignRef: input.campaignRef.trim() } : {}),
      ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt) } : {}),
      grantedBy: adminId,
      idempotencyKey: randomUUID(),
    });

    return {
      id: grant.id,
      userId: grant.userId,
      amount: grant.amount,
      reason: grant.reason,
      campaignRef: grant.campaignRef || null,
      status: grant.status,
      grantedBy: grant.grantedBy,
      expiresAt: grant.expiresAt?.toISOString() ?? null,
      createdAt: grant.createdAt?.toISOString() ?? null,
    };
  }
}

@Injectable()
export class ReverseAdminCreditGrantUseCase {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute(adminId: string, grantId: string, reverseReason: string) {
    const reason = reverseReason.trim();
    if (!grantId.trim() || !reason) {
      throw new ValidationError('grantId and reverseReason are required');
    }

    const grant = await this.finance.reverseCreditGrant({
      grantId,
      reverseReason: reason,
      reversedBy: adminId,
      idempotencyKey: randomUUID(),
    });

    return {
      id: grant.id,
      userId: grant.userId,
      amount: grant.amount,
      status: grant.status,
      reverseReason: grant.reverseReason || null,
      reversedBy: grant.reversedBy || null,
      reversedAt: grant.reversedAt?.toISOString() ?? null,
    };
  }
}

@Injectable()
export class GetAdminUserCreditUseCase {
  constructor(private readonly finance: FinanceGrpcClient) {}

  async execute(userId: string) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      throw new ValidationError('userId is required');
    }

    const [balance, grants] = await Promise.all([
      this.finance.getCreditBalance(normalizedUserId),
      this.finance.listCreditGrants({ userId: normalizedUserId, limit: 50, offset: 0 }),
    ]);

    return {
      userId: normalizedUserId,
      balance: balance.balance,
      accountCode: balance.accountCode,
      currency: balance.currency,
      grants: (grants.items ?? []).map((grant) => ({
        id: grant.id,
        amount: grant.amount,
        reason: grant.reason,
        campaignRef: grant.campaignRef || null,
        status: grant.status,
        grantedBy: grant.grantedBy,
        expiresAt: grant.expiresAt?.toISOString() ?? null,
        createdAt: grant.createdAt?.toISOString() ?? null,
        reversedAt: grant.reversedAt?.toISOString() ?? null,
        reverseReason: grant.reverseReason || null,
        reversedBy: grant.reversedBy || null,
      })),
    };
  }
}
