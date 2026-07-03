import { IntegrationOutboxService } from './integration-outbox.service.js';
import {
  ApproveAdminWithdrawalUseCase,
  FailAdminWithdrawalUseCase,
  GetAdminOutboxUseCase,
  GetAdminTreasurySummaryUseCase,
  ListAdminOutboxUseCase,
  ListAdminProviderEventsUseCase,
  ListAdminReconciliationRunsUseCase,
  MarkAdminWithdrawalSentUseCase,
  ProcessAdminWithdrawalUseCase,
  ReplayOutboxUseCase,
  ResolveDisputeUseCase,
  SettleAdminWithdrawalUseCase,
} from './payment.use-cases.js';

import type { FinanceOrchestratorPort } from './finance-orchestrator.port.js';

describe('ResolveDisputeUseCase', () => {
  function prismaMock(status = 'DISPUTED') {
    return {
      shipment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ship-1',
          status,
          senderId: 'sender-1',
          carrierId: 'carrier-1',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
  }

  function notificationsMock() {
    return {
      notifyDisputeResolvedToParties: jest.fn(async () => undefined),
    };
  }

  it('releases escrow and resolves the shipment only after finance succeeds', async () => {
    const finance = {
      tryReleaseEscrow: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
      tryRefundEscrow: jest.fn(),
    };
    const prisma = prismaMock();
    const notifications = notificationsMock();
    const useCase = new ResolveDisputeUseCase(finance as never, prisma as never, notifications as never);

    await expect(useCase.execute('ship-1', 'RELEASE', 'carrier delivered')).resolves.toEqual({
      shipmentId: 'ship-1',
      resolution: 'RELEASE',
      note: 'carrier delivered',
      queued: false,
    });
    expect(finance.tryReleaseEscrow).toHaveBeenCalledWith({
      shipmentId: 'ship-1',
      disputeResolution: 'RELEASE: carrier delivered',
      disputeTargetStatus: 'CONFIRMED',
    });
    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ship-1' },
        data: expect.objectContaining({
          status: 'CONFIRMED',
          disputeResolution: 'RELEASE: carrier delivered',
        }),
      }),
    );
    expect(notifications.notifyDisputeResolvedToParties).toHaveBeenCalledWith(
      { senderId: 'sender-1', carrierId: 'carrier-1' },
      'ship-1',
      'RELEASE: carrier delivered',
      'CONFIRMED',
    );
  });

  it('keeps the shipment disputed when finance command is queued', async () => {
    const finance = {
      tryReleaseEscrow: jest.fn(),
      tryRefundEscrow: jest.fn().mockResolvedValue({ ok: false }),
    };
    const prisma = prismaMock();
    const notifications = notificationsMock();
    const useCase = new ResolveDisputeUseCase(finance as never, prisma as never, notifications as never);

    await expect(useCase.execute('ship-1', 'REFUND')).resolves.toEqual({
      shipmentId: 'ship-1',
      resolution: 'REFUND',
      note: null,
      queued: true,
    });
    expect(finance.tryRefundEscrow).toHaveBeenCalledWith({
      shipmentId: 'ship-1',
      disputeResolution: 'REFUND',
      disputeTargetStatus: 'REFUNDED',
    });
    expect(prisma.shipment.update).not.toHaveBeenCalled();
    expect(notifications.notifyDisputeResolvedToParties).not.toHaveBeenCalled();
  });
});

describe('ProcessAdminWithdrawalUseCase', () => {
  function financeMock(): jest.Mocked<Pick<FinanceOrchestratorPort, 'tryProcessWithdrawal'>> {
    return {
      tryProcessWithdrawal: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
    };
  }

  it('requires provider receipt fields before processing a withdrawal', async () => {
    const finance = financeMock();
    const useCase = new ProcessAdminWithdrawalUseCase(finance as unknown as FinanceOrchestratorPort);

    await expect(
      useCase.execute('wd_1', {
        providerRef: ' ',
        payoutChannel: 'PAYA',
        receiptUrl: 'https://pay.example/receipt/1',
      }),
    ).rejects.toThrow('providerRef, payoutChannel and receiptUrl are required');
    expect(finance.tryProcessWithdrawal).not.toHaveBeenCalled();
  });

  it('trims and forwards provider receipt fields to finance', async () => {
    const finance = financeMock();
    const useCase = new ProcessAdminWithdrawalUseCase(finance as unknown as FinanceOrchestratorPort);

    await expect(
      useCase.execute('wd_1', {
        providerRef: ' provider-123 ',
        payoutChannel: ' PAYA ',
        receiptUrl: ' https://pay.example/receipt/1 ',
      }),
    ).resolves.toEqual({
      withdrawalId: 'wd_1',
      providerRef: 'provider-123',
      payoutChannel: 'PAYA',
      receiptUrl: 'https://pay.example/receipt/1',
      processed: true,
    });
    expect(finance.tryProcessWithdrawal).toHaveBeenCalledWith({
      withdrawalId: 'wd_1',
      providerRef: 'provider-123',
      payoutChannel: 'PAYA',
      receiptUrl: 'https://pay.example/receipt/1',
    });
  });
});

describe('Withdrawal lifecycle admin use cases', () => {
  it('approves a pending withdrawal', async () => {
    const finance = {
      tryApproveWithdrawal: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
    };
    const useCase = new ApproveAdminWithdrawalUseCase(finance as never);

    await expect(useCase.execute('wd_1')).resolves.toEqual({
      withdrawalId: 'wd_1',
      approved: true,
    });
    expect(finance.tryApproveWithdrawal).toHaveBeenCalledWith({ withdrawalId: 'wd_1' });
  });

  it('trims and forwards sent-to-bank receipt fields', async () => {
    const finance = {
      tryMarkWithdrawalSent: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
    };
    const useCase = new MarkAdminWithdrawalSentUseCase(finance as never);

    await expect(
      useCase.execute('wd_1', {
        providerRef: ' provider-123 ',
        payoutChannel: ' PAYA ',
        receiptUrl: ' https://pay.example/receipt/1 ',
      }),
    ).resolves.toEqual({
      withdrawalId: 'wd_1',
      providerRef: 'provider-123',
      payoutChannel: 'PAYA',
      receiptUrl: 'https://pay.example/receipt/1',
      sent: true,
    });
    expect(finance.tryMarkWithdrawalSent).toHaveBeenCalledWith({
      withdrawalId: 'wd_1',
      providerRef: 'provider-123',
      payoutChannel: 'PAYA',
      receiptUrl: 'https://pay.example/receipt/1',
    });
  });

  it('requires sent-to-bank receipt fields', async () => {
    const finance = { tryMarkWithdrawalSent: jest.fn() };
    const useCase = new MarkAdminWithdrawalSentUseCase(finance as never);

    await expect(
      useCase.execute('wd_1', {
        providerRef: '',
        payoutChannel: 'PAYA',
        receiptUrl: 'https://pay.example/receipt/1',
      }),
    ).rejects.toThrow('providerRef, payoutChannel and receiptUrl are required');
    expect(finance.tryMarkWithdrawalSent).not.toHaveBeenCalled();
  });

  it('settles a sent withdrawal', async () => {
    const finance = {
      trySettleWithdrawal: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
    };
    const useCase = new SettleAdminWithdrawalUseCase(finance as never);

    await expect(useCase.execute('wd_1')).resolves.toEqual({
      withdrawalId: 'wd_1',
      settled: true,
    });
    expect(finance.trySettleWithdrawal).toHaveBeenCalledWith({ withdrawalId: 'wd_1' });
  });

  it('trims and forwards fail reason', async () => {
    const finance = {
      tryFailWithdrawal: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
    };
    const useCase = new FailAdminWithdrawalUseCase(finance as never);

    await expect(useCase.execute('wd_1', ' bank rejected ')).resolves.toEqual({
      withdrawalId: 'wd_1',
      failed: true,
    });
    expect(finance.tryFailWithdrawal).toHaveBeenCalledWith({
      withdrawalId: 'wd_1',
      reason: 'bank rejected',
    });
  });

  it('requires fail reason', async () => {
    const finance = { tryFailWithdrawal: jest.fn() };
    const useCase = new FailAdminWithdrawalUseCase(finance as never);

    await expect(useCase.execute('wd_1', ' ')).rejects.toThrow('Fail reason is required');
    expect(finance.tryFailWithdrawal).not.toHaveBeenCalled();
  });
});

describe('Admin finance ops use cases', () => {
  it('returns treasury accounts from finance gRPC', async () => {
    const finance = {
      getTreasurySummary: jest.fn().mockResolvedValue({
        currency: 'IRT',
        accounts: {
          walletLiability: '150000',
          escrowLiability: '420000',
        },
      }),
    };
    const useCase = new GetAdminTreasurySummaryUseCase(finance as never);

    await expect(useCase.execute()).resolves.toEqual({
      currency: 'IRT',
      accounts: {
        walletLiability: '150000',
        escrowLiability: '420000',
      },
    });
    expect(finance.getTreasurySummary).toHaveBeenCalledWith('IRT');
  });

  it('proxies reconciliation run history from finance gRPC', async () => {
    const finance = {
      listReconciliationRuns: jest.fn().mockResolvedValue({
        items: [{ id: 'run-1', status: 'PASSED', findings: { debitEqualsCredit: true } }],
      }),
    };
    const useCase = new ListAdminReconciliationRunsUseCase(finance as never);

    await expect(useCase.execute()).resolves.toEqual({
      items: [{ id: 'run-1', status: 'PASSED', findings: { debitEqualsCredit: true } }],
    });
    expect(finance.listReconciliationRuns).toHaveBeenCalledTimes(1);
  });

  it('proxies provider events from finance with bounded filters', async () => {
    const finance = {
      listProviderEvents: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'event-1',
            provider: 'ZIBAL',
            eventType: 'VERIFY',
            payloadHash: 'hash-1',
          },
        ],
        total: 1,
      }),
    };
    const useCase = new ListAdminProviderEventsUseCase(finance as never);

    await expect(
      useCase.execute({
        page: 1,
        limit: 10,
        eventType: 'verify',
        paymentOrderId: 'order-1',
      }),
    ).resolves.toMatchObject({
      data: [{ id: 'event-1', provider: 'ZIBAL', eventType: 'VERIFY' }],
      pagination: { totalItems: 1, page: 1, limit: 10 },
    });
    expect(finance.listProviderEvents).toHaveBeenCalledWith({
      provider: 'ZIBAL',
      eventType: 'VERIFY',
      paymentOrderId: 'order-1',
      page: 1,
      limit: 10,
    });
  });

  it('rejects invalid provider event type filters', async () => {
    const useCase = new ListAdminProviderEventsUseCase({ listProviderEvents: jest.fn() } as never);

    await expect(useCase.execute({ eventType: 'CAPTURE' })).rejects.toThrow(
      'Invalid provider event type',
    );
  });
});

describe('Admin outbox ops use cases', () => {
  it('masks sensitive payload fields in admin outbox rows', async () => {
    const service = new IntegrationOutboxService(
      {
        list: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'outbox-1',
              aggregateType: 'withdrawal',
              aggregateId: 'wd-1',
              command: 'CreateWithdrawal',
              payload: {
                destinationIban: 'IR820540102680020817909002',
                nested: { nationalId: '0012345678', amount: '100000' },
              },
              idempotencyKey: 'wd:user-1:nonce',
              status: 'FAILED',
              attemptCount: 1,
              nextRetryAt: null,
              lastError: 'timeout',
              createdAt: new Date('2026-07-03T00:00:00.000Z'),
              processedAt: null,
            },
          ],
          total: 1,
        }),
      } as never,
      { add: jest.fn() } as never,
      { outboxMaxAttempts: 10 } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.listForAdmin({ page: 1, limit: 10 }),
    ).resolves.toMatchObject({
      data: [
        {
          id: 'outbox-1',
          payload: {
            destinationIban: '[masked]',
            nested: { nationalId: '[masked]', amount: '100000' },
          },
        },
      ],
      total: 1,
    });
  });

  it('lists outbox rows with filters and pagination', async () => {
    const outbox = {
      listForAdmin: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'outbox-1',
            command: 'ProcessWithdrawal',
            status: 'FAILED',
            attemptCount: 10,
            payload: { destinationIban: '[masked]' },
          },
        ],
        total: 1,
      }),
    };
    const useCase = new ListAdminOutboxUseCase(outbox as never);

    await expect(
      useCase.execute({
        page: 1,
        limit: 10,
        status: 'FAILED',
        command: 'ProcessWithdrawal',
        aggregateType: 'withdrawal',
      }),
    ).resolves.toMatchObject({
      data: [{ id: 'outbox-1', status: 'FAILED' }],
      pagination: { totalItems: 1, page: 1, limit: 10 },
    });
    expect(outbox.listForAdmin).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      status: 'FAILED',
      command: 'ProcessWithdrawal',
      aggregateType: 'withdrawal',
      aggregateId: undefined,
    });
  });

  it('rejects invalid outbox filters', async () => {
    const useCase = new ListAdminOutboxUseCase({ listForAdmin: jest.fn() } as never);

    await expect(useCase.execute({ status: 'BROKEN' })).rejects.toThrow('Invalid outbox status');
    await expect(useCase.execute({ command: 'BrokenCommand' })).rejects.toThrow(
      'Invalid outbox command',
    );
  });

  it('loads an outbox detail through the outbox service', async () => {
    const outbox = {
      getForAdmin: jest.fn().mockResolvedValue({ id: 'outbox-1', payload: { iban: '[masked]' } }),
    };
    const useCase = new GetAdminOutboxUseCase(outbox as never);

    await expect(useCase.execute('outbox-1')).resolves.toEqual({
      id: 'outbox-1',
      payload: { iban: '[masked]' },
    });
  });

  it('requires reason and audits replay', async () => {
    const outbox = {
      getForAdmin: jest.fn().mockResolvedValue({
        id: 'outbox-1',
        command: 'ProcessWithdrawal',
        aggregateType: 'withdrawal',
        aggregateId: 'wd-1',
        status: 'FAILED',
        attemptCount: 10,
        lastError: 'timeout',
      }),
      replay: jest.fn().mockResolvedValue(undefined),
    };
    const activity = { log: jest.fn().mockResolvedValue(undefined) };
    const useCase = new ReplayOutboxUseCase(outbox as never, activity as never);

    await expect(
      useCase.execute('admin-1', 'outbox-1', {
        reason: ' retry after finance recovery ',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      }),
    ).resolves.toEqual({ replayed: true });
    expect(outbox.replay).toHaveBeenCalledWith('outbox-1');
    expect(activity.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'ADMIN_OUTBOX_REPLAY',
        resource: 'integration_outbox',
        resourceId: 'outbox-1',
        details: expect.objectContaining({
          reason: 'retry after finance recovery',
          previousStatus: 'FAILED',
          previousAttemptCount: 10,
        }),
      }),
    );

    await expect(
      useCase.execute('admin-1', 'outbox-1', { reason: ' ' }),
    ).rejects.toThrow('Replay reason is required');
  });
});
