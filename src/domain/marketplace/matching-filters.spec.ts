import {
  calculateMatchScore,
  shipmentCargoTypesForTrip,
  tripAcceptsCargoType,
} from './matching-filters.js';
import { CargoType } from './pricing-calculator.js';

describe('tripAcceptsCargoType', () => {
  it('accepts any cargo when trip has no restrictions', () => {
    expect(tripAcceptsCargoType([], CargoType.FOOD)).toBe(true);
  });

  it('accepts listed cargo types only', () => {
    expect(tripAcceptsCargoType([CargoType.DOCUMENTS], CargoType.DOCUMENTS)).toBe(true);
    expect(tripAcceptsCargoType([CargoType.DOCUMENTS], CargoType.FOOD)).toBe(false);
  });
});

describe('shipmentCargoTypesForTrip', () => {
  it('returns null when trip accepts all cargo', () => {
    expect(shipmentCargoTypesForTrip([])).toBeNull();
  });

  it('returns accepted list when trip restricts cargo', () => {
    expect(shipmentCargoTypesForTrip([CargoType.ELECTRONICS, CargoType.DOCUMENTS])).toEqual([
      CargoType.ELECTRONICS,
      CargoType.DOCUMENTS,
    ]);
  });
});

describe('calculateMatchScore', () => {
  const base = {
    shipmentWeight: 5,
    shipmentCargoType: CargoType.DOCUMENTS,
    tripId: 'trip-1',
    tripDepartureDate: new Date('2026-07-15T10:00:00Z'),
    tripAvailableWeight: 10,
    tripAcceptedCargoTypes: [CargoType.DOCUMENTS],
    carrierRating: 4,
    now: new Date('2026-07-01T00:00:00Z'),
  };

  it('scores higher when cargo type matches', () => {
    const matched = calculateMatchScore(base);
    const unmatched = calculateMatchScore({
      ...base,
      shipmentCargoType: CargoType.JEWELRY,
      tripAcceptedCargoTypes: [CargoType.DOCUMENTS],
    });
    expect(matched.score).toBeGreaterThan(unmatched.score);
    expect(matched.factors.cargoTypeMatch).toBe(100);
    expect(unmatched.factors.cargoTypeMatch).toBe(0);
  });

  it('scores higher for nearer departure dates', () => {
    const soon = calculateMatchScore(base);
    const later = calculateMatchScore({
      ...base,
      tripDepartureDate: new Date('2026-08-15T10:00:00Z'),
    });
    expect(soon.score).toBeGreaterThan(later.score);
  });
});
