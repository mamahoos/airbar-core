import { Inject, Injectable } from '@nestjs/common';

import { calculatePriceFloor, getQuote } from '../../domain/marketplace/pricing-calculator.js';
import {
  PRICING_RULE_REPOSITORY,
  type PricingRuleRepositoryPort,
} from '../../domain/marketplace/pricing-rule.repository.port.js';

import type { CargoType } from '../../domain/marketplace/pricing-calculator.js';

export interface QuoteInput {
  readonly originCountry: string;
  readonly destinationCountry: string;
  readonly cargoType: CargoType;
  readonly weight: number;
}

@Injectable()
export class PricingQuoteService {
  constructor(@Inject(PRICING_RULE_REPOSITORY) private readonly rules: PricingRuleRepositoryPort) {}

  async getQuote(input: QuoteInput) {
    const rule = await this.rules.findBestMatch(input);
    return getQuote({ ...input, rule: rule ?? undefined });
  }

  async calculatePrice(input: QuoteInput): Promise<number> {
    const quote = await this.getQuote(input);
    return quote.basePrice;
  }

  async calculateFloor(input: QuoteInput): Promise<number> {
    const rule = await this.rules.findBestMatch(input);
    return calculatePriceFloor({ ...input, rule: rule ?? undefined });
  }
}
