import { ValidationError } from '../../shared/errors/index.js';

import { GrantAdminCreditUseCase, ReverseAdminCreditGrantUseCase } from './credit.use-cases.js';

describe('GrantAdminCreditUseCase', () => {
  it('rejects invalid amount', async () => {
    const finance = { grantCredit: jest.fn() };
    const useCase = new GrantAdminCreditUseCase(finance as never);

    await expect(
      useCase.execute('admin-1', { userId: 'user-1', amount: 0, reason: 'bonus' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(finance.grantCredit).not.toHaveBeenCalled();
  });

  it('grants credit via finance gRPC', async () => {
    const finance = {
      grantCredit: jest.fn().mockResolvedValue({
        id: 'grant-1',
        userId: 'user-1',
        amount: '10000',
        reason: 'bonus',
        campaignRef: '',
        status: 'ACTIVE',
        grantedBy: 'admin-1',
        expiresAt: undefined,
        createdAt: new Date('2026-07-03T00:00:00.000Z'),
      }),
    };
    const useCase = new GrantAdminCreditUseCase(finance as never);

    const result = await useCase.execute('admin-1', {
      userId: 'user-1',
      amount: 10000,
      reason: 'bonus',
    });

    expect(finance.grantCredit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: '10000',
        reason: 'bonus',
        grantedBy: 'admin-1',
      }),
    );
    expect(result).toMatchObject({ id: 'grant-1', amount: '10000', status: 'ACTIVE' });
  });
});

describe('ReverseAdminCreditGrantUseCase', () => {
  it('requires reverse reason', async () => {
    const finance = { reverseCreditGrant: jest.fn() };
    const useCase = new ReverseAdminCreditGrantUseCase(finance as never);

    await expect(useCase.execute('admin-1', 'grant-1', '   ')).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
