import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from '../../adapters/cache/redis.service.js';
import {
  MATCH_SUGGESTION_REPOSITORY,
  type MatchSuggestionRepositoryPort,
} from '../../domain/marketplace/match-suggestion.repository.port.js';
import {
  calculateMatchScore,
  shipmentCargoTypesForTrip,
} from '../../domain/marketplace/matching-filters.js';
import {
  SHIPMENT_REPOSITORY,
  type ShipmentRepositoryPort,
} from '../../domain/marketplace/shipment.repository.port.js';
import {
  TRIP_REPOSITORY,
  type TripRepositoryPort,
} from '../../domain/marketplace/trip.repository.port.js';

@Injectable()
export class MatchingService {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    @Inject(MATCH_SUGGESTION_REPOSITORY)
    private readonly suggestions: MatchSuggestionRepositoryPort,
    private readonly redis: RedisService,
  ) {}

  async findMatchingTrips(shipmentId: string) {
    const shipment = await this.shipments.findById(shipmentId);
    if (!shipment) return [];

    const trips = await this.trips.findActiveMatches({
      excludeUserId: shipment.senderId,
      originCity: shipment.originCity,
      originCountry: shipment.originCountry,
      destinationCity: shipment.destinationCity,
      destinationCountry: shipment.destinationCountry,
      minWeight: shipment.weight,
      cargoType: shipment.cargoType,
    });

    return trips
      .map((trip) => ({
        ...trip,
        matchScore: calculateMatchScore({
          shipmentWeight: shipment.weight,
          shipmentCargoType: shipment.cargoType,
          tripId: trip.id,
          tripDepartureDate: trip.departureDate,
          tripAvailableWeight: trip.availableWeight,
          tripAcceptedCargoTypes: trip.acceptedCargoTypes,
          carrierRating: trip.user?.rating ?? 0,
        }),
      }))
      .sort((a, b) => b.matchScore.score - a.matchScore.score);
  }

  async findMatchingShipments(tripId: string) {
    const trip = await this.trips.findById(tripId);
    if (!trip) return [];

    return this.shipments.findPendingMatches({
      excludeUserId: trip.userId,
      originCity: trip.originCity,
      originCountry: trip.originCountry,
      destinationCity: trip.destinationCity,
      destinationCountry: trip.destinationCountry,
      maxWeight: trip.availableWeight,
      cargoTypes: shipmentCargoTypesForTrip(trip.acceptedCargoTypes),
    });
  }

  async autoMatch(): Promise<{ matched: number }> {
    const pending = await this.shipments.listPending(100);
    let matchedCount = 0;

    for (const shipment of pending) {
      const matches = await this.findMatchingTrips(shipment.id);
      if (matches.length === 0) continue;

      const best = matches[0];
      if (!best) continue;

      const trip = await this.trips.findById(best.id);
      if (trip && trip.status === 'ACTIVE' && trip.availableWeight >= shipment.weight) {
        await this.storeMatchSuggestion({
          shipmentId: shipment.id,
          tripId: trip.id,
          score: best.matchScore.score,
          factors: best.matchScore.factors,
          source: 'auto_match',
        });
        matchedCount++;
      }
    }

    return { matched: matchedCount };
  }

  async processShipmentCreated(shipmentId: string): Promise<{ suggested: number }> {
    const matches = await this.findMatchingTrips(shipmentId);
    let suggested = 0;

    for (const trip of matches) {
      await this.storeMatchSuggestion({
        shipmentId,
        tripId: trip.id,
        source: 'shipment_created',
        score: trip.matchScore.score,
        factors: trip.matchScore.factors,
      });
      suggested++;
    }

    return { suggested };
  }

  async processTripPublished(tripId: string): Promise<{ suggested: number }> {
    const trip = await this.trips.findById(tripId);
    if (!trip) return { suggested: 0 };

    const matches = await this.findMatchingShipments(tripId);
    let suggested = 0;

    for (const shipment of matches) {
      const matchScore = calculateMatchScore({
        shipmentWeight: shipment.weight,
        shipmentCargoType: shipment.cargoType,
        tripId,
        tripDepartureDate: trip.departureDate,
        tripAvailableWeight: trip.availableWeight,
        tripAcceptedCargoTypes: trip.acceptedCargoTypes,
        carrierRating: trip.user?.rating ?? 0,
      });
      await this.storeMatchSuggestion({
        shipmentId: shipment.id,
        tripId,
        source: 'trip_published',
        score: matchScore.score,
        factors: matchScore.factors,
      });
      suggested++;
    }

    return { suggested };
  }

  async listPersistedSuggestionsForShipment(shipmentId: string, limit = 20) {
    return this.suggestions.listForShipment(shipmentId, limit);
  }

  async listPersistedSuggestionsForTrip(tripId: string, limit = 20) {
    return this.suggestions.listForTrip(tripId, limit);
  }

  private async storeMatchSuggestion(input: {
    readonly shipmentId: string;
    readonly tripId: string;
    readonly score: number;
    readonly factors: unknown;
    readonly source: string;
  }): Promise<void> {
    await this.suggestions.upsert(input);

    const key = `match:${input.shipmentId}:${input.tripId}`;
    await this.redis.set(
      key,
      JSON.stringify({
        shipmentId: input.shipmentId,
        tripId: input.tripId,
        suggestedAt: new Date().toISOString(),
        source: input.source,
        score: input.score,
        factors: input.factors,
      }),
      86_400,
    );
  }
}
