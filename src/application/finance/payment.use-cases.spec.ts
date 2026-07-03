import {
  GetAdminTreasurySummaryUseCase,
  ListAdminReconciliationRunsUseCase,
  ProcessAdminWithdrawalUseCase,
} from './payment.use-cases.js';

import type { FinanceOrchestratorPort } from './finance-orchestrator.port.js';

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
});
