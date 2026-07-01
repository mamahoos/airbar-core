import { brandValue, isNonEmptyString, type Brand } from './brand.js';

export type UserId = Brand<string, 'UserId'>;
export type TripId = Brand<string, 'TripId'>;
export type ShipmentId = Brand<string, 'ShipmentId'>;
export type ChatId = Brand<string, 'ChatId'>;
export type PaymentOrderId = Brand<string, 'PaymentOrderId'>;
export type EscrowId = Brand<string, 'EscrowId'>;
export type WithdrawalId = Brand<string, 'WithdrawalId'>;
export type WalletTxnId = Brand<string, 'WalletTxnId'>;

function assertId(value: string, label: string): void {
  if (!isNonEmptyString(value)) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

export function userId(value: string): UserId {
  assertId(value, 'UserId');
  return brandValue<string, 'UserId'>(value);
}

export function tripId(value: string): TripId {
  assertId(value, 'TripId');
  return brandValue<string, 'TripId'>(value);
}

export function shipmentId(value: string): ShipmentId {
  assertId(value, 'ShipmentId');
  return brandValue<string, 'ShipmentId'>(value);
}

export function chatId(value: string): ChatId {
  assertId(value, 'ChatId');
  return brandValue<string, 'ChatId'>(value);
}

export function paymentOrderId(value: string): PaymentOrderId {
  assertId(value, 'PaymentOrderId');
  return brandValue<string, 'PaymentOrderId'>(value);
}

export function escrowId(value: string): EscrowId {
  assertId(value, 'EscrowId');
  return brandValue<string, 'EscrowId'>(value);
}

export function withdrawalId(value: string): WithdrawalId {
  assertId(value, 'WithdrawalId');
  return brandValue<string, 'WithdrawalId'>(value);
}

export function walletTxnId(value: string): WalletTxnId {
  assertId(value, 'WalletTxnId');
  return brandValue<string, 'WalletTxnId'>(value);
}
