import type { CargoType } from './pricing-calculator.js';

/** Whether a trip accepts the given cargo type (empty list = all types). */
export function tripAcceptsCargoType(
  acceptedCargoTypes: readonly CargoType[],
  cargoType: CargoType,
): boolean {
  return acceptedCargoTypes.length === 0 || acceptedCargoTypes.includes(cargoType);
}

/** Cargo types a trip search should include when filtering pending shipments. */
export function shipmentCargoTypesForTrip(
  acceptedCargoTypes: readonly CargoType[],
): readonly CargoType[] | null {
  return acceptedCargoTypes.length > 0 ? acceptedCargoTypes : null;
}

export interface MatchScoreFactors {
  readonly dateMatch: number;
  readonly capacityMatch: number;
  readonly cargoTypeMatch: number;
  readonly carrierRating: number;
  readonly priceCompetitiveness: number;
}

export interface MatchScore {
  readonly tripId: string;
  readonly score: number;
  readonly factors: MatchScoreFactors;
}

export function calculateMatchScore(input: {
  readonly shipmentWeight: number;
  readonly shipmentCargoType: CargoType;
  readonly tripId: string;
  readonly tripDepartureDate: Date;
  readonly tripAvailableWeight: number;
  readonly tripAcceptedCargoTypes: readonly CargoType[];
  readonly carrierRating: number;
  readonly now?: Date | undefined;
}): MatchScore {
  const now = input.now ?? new Date();
  const priceCompetitiveness = 50;

  const daysUntilDeparture = Math.ceil(
    (input.tripDepartureDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const dateMatch = Math.max(0, 100 - daysUntilDeparture * 5);
  const capacityRatio = input.shipmentWeight / input.tripAvailableWeight;
  const capacityMatch = capacityRatio * 100;
  const cargoTypeMatch = tripAcceptsCargoType(
    input.tripAcceptedCargoTypes,
    input.shipmentCargoType,
  )
    ? 100
    : 0;
  const carrierRating = input.carrierRating * 20;

  const weights = {
    dateMatch: 0.2,
    capacityMatch: 0.15,
    cargoTypeMatch: 0.25,
    carrierRating: 0.25,
    priceCompetitiveness: 0.15,
  };

  const score = Math.round(
    dateMatch * weights.dateMatch +
      capacityMatch * weights.capacityMatch +
      cargoTypeMatch * weights.cargoTypeMatch +
      carrierRating * weights.carrierRating +
      priceCompetitiveness * weights.priceCompetitiveness,
  );

  return {
    tripId: input.tripId,
    score,
    factors: { dateMatch, capacityMatch, cargoTypeMatch, carrierRating, priceCompetitiveness },
  };
}
