/** Finance integration outbox command names — must match scenario-b outbox doc. */
export const OUTBOX_COMMANDS = [
  'CreateEscrow',
  'CreatePaymentOrder',
  'PayFromWallet',
  'MarkDelivered',
  'FreezeEscrow',
  'ReleaseEscrow',
  'RefundEscrow',
  'PartialRefundEscrow',
  'CreateWithdrawal',
  'ApproveWithdrawal',
  'MarkWithdrawalSent',
  'SettleWithdrawal',
  'FailWithdrawal',
  'ProcessWithdrawal',
  'RejectWithdrawal',
] as const;

export type OutboxCommand = (typeof OUTBOX_COMMANDS)[number];

export function isOutboxCommand(value: string): value is OutboxCommand {
  return (OUTBOX_COMMANDS as readonly string[]).includes(value);
}
