import { NotificationService } from './notification.use-cases.js';

describe('NotificationService operational notifications', () => {
  const create = jest.fn(async (input: unknown) => input);
  const send = jest.fn(async () => undefined);
  const push = { send };
  const notifications = { create };
  const service = new NotificationService(notifications as never, push);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('notifyPaymentSecured notifies sender and carrier', async () => {
    await service.notifyPaymentSecured({ senderId: 'sender-1', carrierId: 'carrier-1' }, 'ship-1');

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'sender-1',
        data: expect.objectContaining({ type: 'PAYMENT_SECURED', shipmentId: 'ship-1' }),
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'carrier-1',
        data: expect.objectContaining({ type: 'PAYMENT_SECURED', shipmentId: 'ship-1' }),
      }),
    );
  });

  it('notifyKycUpgraded creates push notification', async () => {
    await service.notifyKycUpgraded('user-1', 'DOCUMENT_VERIFIED');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'PUSH',
        data: expect.objectContaining({ type: 'KYC_UPGRADED', kycLevel: 'DOCUMENT_VERIFIED' }),
      }),
    );
  });

  it('notifyWithdrawalStatus creates push notification', async () => {
    await service.notifyWithdrawalStatus('user-1', 'wd-1', 'SETTLED');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        data: expect.objectContaining({
          type: 'WITHDRAWAL_STATUS',
          withdrawalId: 'wd-1',
          status: 'SETTLED',
        }),
      }),
    );
  });

  it('notifyEscrowReleased notifies carrier and sender', async () => {
    await service.notifyEscrowReleased({ senderId: 'sender-1', carrierId: 'carrier-1' }, 'ship-1');

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'carrier-1',
        data: expect.objectContaining({ type: 'ESCROW_RELEASED' }),
      }),
    );
  });

  it('notifyEscrowRefunded notifies payer', async () => {
    await service.notifyEscrowRefunded('sender-1', 'ship-1');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'sender-1',
        data: expect.objectContaining({ type: 'ESCROW_REFUNDED', shipmentId: 'ship-1' }),
      }),
    );
  });

  it('notifyReviewReceived notifies target', async () => {
    await service.notifyReviewReceived('target-1', 'ship-1', 5);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'target-1',
        data: expect.objectContaining({ type: 'REVIEW_RECEIVED', rating: '5' }),
      }),
    );
  });
});
