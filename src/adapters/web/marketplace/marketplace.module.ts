import { Module } from '@nestjs/common';

import { ListAirportsUseCase, ListCitiesUseCase } from '../../../application/marketplace/lookup.use-cases.js';
import { MatchingService } from '../../../application/marketplace/matching.service.js';
import { PricingQuoteService } from '../../../application/marketplace/pricing-quote.service.js';
import {
  AcceptShipmentOfferUseCase,
  AssignShipmentToTripUseCase,
  CancelShipmentUseCase,
  CreateShipmentUseCase,
  DisputeShipmentUseCase,
  GetShipmentUseCase,
  ListMyShipmentsUseCase,
  RejectShipmentOfferUseCase,
  TrackShipmentUseCase,
  UpdateShipmentStatusUseCase,
  UpdateShipmentUseCase,
} from '../../../application/marketplace/shipment.use-cases.js';
import {
  CancelTripUseCase,
  CreateTripUseCase,
  DeleteTripUseCase,
  GetTripUseCase,
  ListMyTripsUseCase,
  ListTripRequestsUseCase,
  PublishTripUseCase,
  SearchTripsUseCase,
  UpdateTripUseCase,
} from '../../../application/marketplace/trip.use-cases.js';
import { MarketplacePersistenceModule } from '../../persistence/marketplace/marketplace-persistence.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { KycModule } from '../kyc/kyc.module.js';

import { LocationsController } from './locations.controller.js';
import { MatchingController } from './matching.controller.js';
import { ShipmentsController } from './shipments.controller.js';
import { TripsController } from './trips.controller.js';

@Module({
  imports: [MarketplacePersistenceModule, KycModule, AuthModule],
  controllers: [TripsController, ShipmentsController, MatchingController, LocationsController],
  providers: [
    PricingQuoteService,
    CreateTripUseCase,
    GetTripUseCase,
    UpdateTripUseCase,
    DeleteTripUseCase,
    PublishTripUseCase,
    CancelTripUseCase,
    SearchTripsUseCase,
    ListMyTripsUseCase,
    ListTripRequestsUseCase,
    CreateShipmentUseCase,
    GetShipmentUseCase,
    TrackShipmentUseCase,
    UpdateShipmentUseCase,
    CancelShipmentUseCase,
    AcceptShipmentOfferUseCase,
    RejectShipmentOfferUseCase,
    UpdateShipmentStatusUseCase,
    DisputeShipmentUseCase,
    ListMyShipmentsUseCase,
    AssignShipmentToTripUseCase,
    MatchingService,
    ListCitiesUseCase,
    ListAirportsUseCase,
  ],
})
export class MarketplaceModule {}
