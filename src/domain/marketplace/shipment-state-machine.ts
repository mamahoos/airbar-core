export enum ShipmentStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  ACCEPTED = 'ACCEPTED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CONFIRMED = 'CONFIRMED',
  DISPUTED = 'DISPUTED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export type ShipmentActor = 'sender' | 'carrier' | 'admin';

const STATUS_TRANSITIONS: Readonly<
  Record<ShipmentStatus, readonly { to: ShipmentStatus; actor: ShipmentActor }[]>
> = {
  [ShipmentStatus.PENDING]: [],
  [ShipmentStatus.MATCHED]: [],
  [ShipmentStatus.ACCEPTED]: [],
  [ShipmentStatus.PAYMENT_PENDING]: [],
  [ShipmentStatus.PAID]: [{ to: ShipmentStatus.PICKED_UP, actor: 'carrier' }],
  [ShipmentStatus.PICKED_UP]: [{ to: ShipmentStatus.IN_TRANSIT, actor: 'carrier' }],
  [ShipmentStatus.IN_TRANSIT]: [{ to: ShipmentStatus.DELIVERED, actor: 'carrier' }],
  [ShipmentStatus.DELIVERED]: [{ to: ShipmentStatus.CONFIRMED, actor: 'sender' }],
  [ShipmentStatus.CONFIRMED]: [],
  [ShipmentStatus.DISPUTED]: [],
  [ShipmentStatus.CANCELLED]: [],
  [ShipmentStatus.REFUNDED]: [],
};

const DISPUTE_FROM: readonly ShipmentStatus[] = [
  ShipmentStatus.PAID,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERED,
];

export function canTransitionStatus(
  from: ShipmentStatus,
  to: ShipmentStatus,
  actor: ShipmentActor,
): boolean {
  if (to === ShipmentStatus.DISPUTED) {
    return DISPUTE_FROM.includes(from);
  }
  const allowed = STATUS_TRANSITIONS[from] ?? [];
  return allowed.some((t) => t.to === to && t.actor === actor);
}

export function assertStatusTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
  actor: ShipmentActor,
): void {
  if (!canTransitionStatus(from, to, actor)) {
    throw new Error(`Invalid shipment status transition: ${from} -> ${to} by ${actor}`);
  }
}
