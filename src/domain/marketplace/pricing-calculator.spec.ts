import { describe, it, expect } from '@jest/globals';

import { CargoType, calculateBasePrice, getQuote } from './pricing-calculator.js';

describe('pricing calculator', () => {
  it('applies default pricing for domestic route', () => {
    const price = calculateBasePrice({
      originCountry: 'IR',
      destinationCountry: 'IR',
      cargoType: CargoType.DOCUMENTS,
      weight: 2,
    });
    expect(price).toBe(200_000);
  });

  it('applies international multiplier', () => {
    const domestic = calculateBasePrice({
      originCountry: 'IR',
      destinationCountry: 'IR',
      cargoType: CargoType.DOCUMENTS,
      weight: 2,
    });
    const international = calculateBasePrice({
      originCountry: 'IR',
      destinationCountry: 'TR',
      cargoType: CargoType.DOCUMENTS,
      weight: 2,
    });
    expect(international).toBeGreaterThan(domestic);
  });

  it('returns quote with platform fee', () => {
    const quote = getQuote({
      originCountry: 'IR',
      destinationCountry: 'IR',
      cargoType: CargoType.ELECTRONICS,
      weight: 1,
      rule: {
        basePrice: 100_000,
        pricePerKg: 50_000,
        platformFeePercent: 10,
        minPlatformFee: 10_000,
      },
    });
    expect(quote.totalPrice).toBe(quote.basePrice + quote.platformFee);
    expect(quote.platformFee).toBeGreaterThanOrEqual(10_000);
  });
});
