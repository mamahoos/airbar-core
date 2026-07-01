import type { CargoType } from './pricing-calculator.js';
import type { PricingRuleInput } from './pricing-calculator.js';

export const PRICING_RULE_REPOSITORY = Symbol('PRICING_RULE_REPOSITORY');

export interface PricingRuleRepositoryPort {
  findBestMatch(input: {
    readonly originCountry: string;
    readonly destinationCountry: string;
    readonly cargoType: CargoType;
  }): Promise<PricingRuleInput | null>;
}
