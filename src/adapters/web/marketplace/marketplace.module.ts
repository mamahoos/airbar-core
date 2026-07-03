import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import {
  ListAirportsUseCase,
  ListCitiesUseCase,
} from '../../../application/marketplace/lookup.use-cases.js';
import { MatchingEventsService } from '../../../application/marketplace/matching-events.service.js';
import { MatchingService } from '../../../application/marketplace/matching.service.js';
import { PricingQuoteService } from '../../../application/marketplace/pricing-quote.service.js';
import {
  ListShipmentReviewsUseCase,
  ListUserReviewsUseCase,
  SubmitReviewUseCase,
} from '../../../application/marketplace/review.use-cases.js';
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
import { FinanceOutboxModule } from '../../queue/finance-outbox/finance-outbox.module.js';
import { MARKETPLACE_MATCHING_QUEUE } from '../../queue/marketplace-matching/marketplace-matching.constants.js';
import { MarketplaceMatchingProcessor } from '../../queue/marketplace-matching/marketplace-matching.processor.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { KycModule } from '../kyc/kyc.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { StatsModule } from '../stats/stats.module.js';

import { LocationsController } from './locations.controller.js';
import { MatchingController } from './matching.controller.js';
import { ReviewsController } from './reviews.controller.js';
import { ShipmentsController } from './shipments.controller.js';
import { TripsController } from './trips.controller.js';

@Module({
  imports: [
    MarketplacePersistenceModule,
    BullModule.registerQueue({ name: MARKETPLACE_MATCHING_QUEUE }),
    KycModule,
    AuthModule,
    ChatModule,
    NotificationsModule,
    FinanceOutboxModule,
    StatsModule,
  ],
  controllers: [
    TripsController,
    ShipmentsController,
    MatchingController,
    LocationsController,
    ReviewsController,
  ],
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
    MatchingEventsService,
    MarketplaceMatchingProcessor,
    ListCitiesUseCase,
    ListAirportsUseCase,
    SubmitReviewUseCase,
    ListUserReviewsUseCase,
    ListShipmentReviewsUseCase,
  ],
  exports: [CreateTripUseCase, CreateShipmentUseCase],
})
export class MarketplaceModule {}
