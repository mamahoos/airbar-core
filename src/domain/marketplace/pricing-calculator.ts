import { CargoType } from '@prisma/client';

export { CargoType };

export interface PricingRuleInput {
  readonly basePrice: number;
  readonly pricePerKg: number;
  readonly riskMultiplier?: number | undefined;
  readonly platformFeePercent?: number | undefined;
  readonly minPlatformFee?: number | undefined;
}

export interface PriceQuoteInput {
  readonly originCountry: string;
  readonly destinationCountry: string;
  readonly cargoType: CargoType;
  readonly weight: number;
  readonly rule?: PricingRuleInput | undefined;
}

const DEFAULT_BASE_PRICE = 100_000;
const DEFAULT_PRICE_PER_KG = 50_000;
const DEFAULT_PLATFORM_FEE_PERCENT = 10;
const DEFAULT_MIN_PLATFORM_FEE = 10_000;

export const MIN_BASE_PRICE = 10_000;
export const MIN_PRICE_PER_KG = 10_000;
export const MIN_PLATFORM_FEE = 10_000;

const RISK_MULTIPLIERS: Record<CargoType, number> = {
  [CargoType.DOCUMENTS]: 1.0,
  [CargoType.CLOTHING]: 1.0,
  [CargoType.ELECTRONICS]: 1.3,
  [CargoType.FOOD]: 1.2,
  [CargoType.MEDICINE]: 1.4,
  [CargoType.COSMETICS]: 1.1,
  [CargoType.JEWELRY]: 1.5,
  [CargoType.OTHER]: 1.0,
};

export function calculateBasePrice(input: PriceQuoteInput): number {
  const rule = input.rule;
  const basePrice = rule?.basePrice ?? DEFAULT_BASE_PRICE;
  const pricePerKg = rule?.pricePerKg ?? DEFAULT_PRICE_PER_KG;
  const riskMultiplier = rule?.riskMultiplier ?? RISK_MULTIPLIERS[input.cargoType];

  let total = basePrice + pricePerKg * input.weight;
  total *= riskMultiplier;

  if (input.originCountry !== input.destinationCountry) {
    total *= 1.5;
  }

  return Math.ceil(total / 1000) * 1000;
}

export function calculatePlatformFee(basePrice: number, rule?: PricingRuleInput): number {
  const percent = rule?.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT;
  const minFee = rule?.minPlatformFee ?? DEFAULT_MIN_PLATFORM_FEE;
  const fee = basePrice * (percent / 100);
  return Math.max(Math.round(fee), minFee);
}

export function getQuote(input: PriceQuoteInput) {
  const basePrice = calculateBasePrice(input);
  const platformFee = calculatePlatformFee(basePrice, input.rule);
  const isInternational = input.originCountry !== input.destinationCountry;
  const riskMultiplier = input.rule?.riskMultiplier ?? RISK_MULTIPLIERS[input.cargoType];

  return {
    basePrice,
    platformFee,
    totalPrice: basePrice + platformFee,
    breakdown: {
      weight: input.weight,
      cargoTypeMultiplier: riskMultiplier,
      routeMultiplier: isInternational ? 1.5 : 1,
    },
  };
}

export function calculatePriceFloor(input: PriceQuoteInput): number {
  return calculateBasePrice(input);
}

export function assertPricingRuleFloor(input: Partial<PricingRuleInput>): void {
  if (input.basePrice !== undefined && input.basePrice < MIN_BASE_PRICE) {
    throw new Error(`basePrice must be at least ${MIN_BASE_PRICE}`);
  }
  if (input.pricePerKg !== undefined && input.pricePerKg < MIN_PRICE_PER_KG) {
    throw new Error(`pricePerKg must be at least ${MIN_PRICE_PER_KG}`);
  }
  if (input.minPlatformFee !== undefined && input.minPlatformFee < MIN_PLATFORM_FEE) {
    throw new Error(`minPlatformFee must be at least ${MIN_PLATFORM_FEE}`);
  }
}
