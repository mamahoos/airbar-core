import { Module } from '@nestjs/common';

import { LOOKUP_REPOSITORY } from '../../../domain/marketplace/lookup.repository.port.js';
import { PRICING_RULE_REPOSITORY } from '../../../domain/marketplace/pricing-rule.repository.port.js';
import { SHIPMENT_REPOSITORY } from '../../../domain/marketplace/shipment.repository.port.js';
import { TRIP_REPOSITORY } from '../../../domain/marketplace/trip.repository.port.js';

import { PrismaLookupRepository } from './prisma-lookup.repository.js';
import { PrismaPricingRuleRepository } from './prisma-pricing-rule.repository.js';
import { PrismaShipmentRepository } from './prisma-shipment.repository.js';
import { PrismaTripRepository } from './prisma-trip.repository.js';

@Module({
  providers: [
    { provide: TRIP_REPOSITORY, useClass: PrismaTripRepository },
    { provide: SHIPMENT_REPOSITORY, useClass: PrismaShipmentRepository },
    { provide: PRICING_RULE_REPOSITORY, useClass: PrismaPricingRuleRepository },
    { provide: LOOKUP_REPOSITORY, useClass: PrismaLookupRepository },
  ],
  exports: [TRIP_REPOSITORY, SHIPMENT_REPOSITORY, PRICING_RULE_REPOSITORY, LOOKUP_REPOSITORY],
})
export class MarketplacePersistenceModule {}
