import { ProcessAdminWithdrawalUseCase } from './payment.use-cases.js';

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
