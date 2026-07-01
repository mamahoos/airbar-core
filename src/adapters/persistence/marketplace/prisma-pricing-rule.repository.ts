import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type { CargoType } from '../../../domain/marketplace/pricing-calculator.js';
import type { PricingRuleInput } from '../../../domain/marketplace/pricing-calculator.js';
import type { PricingRuleRepositoryPort } from '../../../domain/marketplace/pricing-rule.repository.port.js';

@Injectable()
export class PrismaPricingRuleRepository implements PricingRuleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findBestMatch(input: {
    originCountry: string;
    destinationCountry: string;
    cargoType: CargoType;
  }): Promise<PricingRuleInput | null> {
    const rule = await this.prisma.pricingRule.findFirst({
      where: {
        isActive: true,
        OR: [
          {
            originCountry: input.originCountry,
            destinationCountry: input.destinationCountry,
            cargoType: input.cargoType,
          },
          {
            originCountry: input.originCountry,
            destinationCountry: input.destinationCountry,
            cargoType: null,
          },
          {
            originCountry: null,
            destinationCountry: null,
            cargoType: input.cargoType,
          },
          {
            originCountry: null,
            destinationCountry: null,
            cargoType: null,
          },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    if (!rule) return null;

    return {
      basePrice: rule.basePrice,
      pricePerKg: rule.pricePerKg,
      riskMultiplier: rule.riskMultiplier,
      platformFeePercent: rule.platformFeePercent,
      minPlatformFee: rule.minPlatformFee,
    };
  }
}
