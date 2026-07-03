import type { ShipmentId, UserId } from '../ids/index.js';

/**
 * Idempotency key builders for airbar-core → airbar-finance gRPC calls.
 * Patterns match scenario-b outbox doc and finance dedup expectations.
 */

export function escrowCreateKey(shipmentId: ShipmentId | string): string {
  return `escrow:${shipmentId}`;
}

export function fundEscrowKey(shipmentId: ShipmentId | string, paymentOrderId: string): string {
  return `fund:${shipmentId}:${paymentOrderId}`;
}

export function payFromWalletKey(shipmentId: ShipmentId | string): string {
  return `wallet-pay:${shipmentId}`;
}

export function paymentOrderKey(shipmentId: ShipmentId | string, nonce: string): string {
  return `pay:${shipmentId}:${nonce}`;
}

export function markDeliveredKey(shipmentId: ShipmentId | string): string {
  return `delivered:${shipmentId}`;
}

export function freezeEscrowKey(shipmentId: ShipmentId | string): string {
  return `freeze:${shipmentId}`;
}

export function releaseEscrowKey(shipmentId: ShipmentId | string): string {
  return `release:${shipmentId}`;
}

export function refundEscrowKey(shipmentId: ShipmentId | string): string {
  return `refund:${shipmentId}`;
}

export function partialRefundEscrowKey(
  shipmentId: ShipmentId | string,
  amountRials: string,
): string {
  return `partial:${shipmentId}:${amountRials}`;
}

export function withdrawalKey(userId: UserId | string, nonce: string): string {
  return `wd:${userId}:${nonce}`;
}

export function processWithdrawalKey(withdrawalId: string): string {
  return `wd-process:${withdrawalId}`;
}

export function approveWithdrawalKey(withdrawalId: string): string {
  return `wd-approve:${withdrawalId}`;
}

export function markWithdrawalSentKey(withdrawalId: string): string {
  return `wd-sent:${withdrawalId}`;
}

export function settleWithdrawalKey(withdrawalId: string): string {
  return `wd-settle:${withdrawalId}`;
}

export function failWithdrawalKey(withdrawalId: string): string {
  return `wd-fail:${withdrawalId}`;
}

export function rejectWithdrawalKey(withdrawalId: string): string {
  return `wd-reject:${withdrawalId}`;
}

export function grantCreditKey(campaignId: string, userId: string, nonce: string): string {
  return `credit-grant:${campaignId}:${userId}:${nonce}`;
}
