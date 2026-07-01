import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from '../../adapters/cache/redis.service.js';
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
        await this.storeMatchSuggestion(shipment.id, trip.id);
        matchedCount++;
      }
    }

    return { matched: matchedCount };
  }

  private async storeMatchSuggestion(shipmentId: string, tripId: string): Promise<void> {
    const key = `match:${shipmentId}:${tripId}`;
    await this.redis.set(
      key,
      JSON.stringify({ shipmentId, tripId, suggestedAt: new Date().toISOString() }),
      86_400,
    );
  }
}
