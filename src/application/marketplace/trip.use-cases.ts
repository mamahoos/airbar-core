import { Inject, Injectable } from '@nestjs/common';

import {
  TRIP_REPOSITORY,
  type CreateTripInput,
  type SearchTripsFilter,
  type TripRepositoryPort,
  type TripStatus,
  type UpdateTripInput,
} from '../../domain/marketplace/trip.repository.port.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { buildPaginationMeta, normalizePagination } from '../../shared/pagination/pagination.js';

@Injectable()
export class CreateTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort) {}

  async execute(userId: string, input: CreateTripInput) {
    if (input.departureDate < new Date()) {
      throw new ValidationError('Departure date must be in the future');
    }
    if (input.arrivalDate && input.arrivalDate < input.departureDate) {
      throw new ValidationError('Arrival date must be after departure date');
    }

    const trip = await this.trips.create(userId, input);
    await this.trips.incrementUserTripCount(userId, 1);
    return trip;
  }
}

@Injectable()
export class GetTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort) {}

  async execute(tripId: string) {
    const trip = await this.trips.findById(tripId);
    if (!trip) throw new NotFoundError('Trip', tripId);
    return trip;
  }
}

@Injectable()
export class UpdateTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort) {}

  async execute(userId: string, tripId: string, input: UpdateTripInput) {
    const trip = await this.trips.findById(tripId);
    if (!trip) throw new NotFoundError('Trip', tripId);
    if (trip.userId !== userId) throw new ForbiddenError('You can only update your own trips');
    if (trip.status === 'IN_PROGRESS' || trip.status === 'COMPLETED') {
      throw new ValidationError('Cannot update a trip that is in progress or completed');
    }
    return this.trips.update(tripId, input);
  }
}

@Injectable()
export class DeleteTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort) {}

  async execute(userId: string, tripId: string) {
    const trip = await this.trips.findById(tripId);
    if (!trip) throw new NotFoundError('Trip', tripId);
    if (trip.userId !== userId) throw new ForbiddenError('You can only delete your own trips');
    if (await this.trips.hasActiveShipments(tripId)) {
      throw new ValidationError('Cannot delete a trip with active shipments');
    }

    await this.trips.delete(tripId);
    await this.trips.incrementUserTripCount(userId, -1);
    return { message: 'Trip deleted successfully' };
  }
}

@Injectable()
export class PublishTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort) {}

  async execute(userId: string, tripId: string) {
    const trip = await this.trips.findById(tripId);
    if (!trip) throw new NotFoundError('Trip', tripId);
    if (trip.userId !== userId) throw new ForbiddenError('You can only publish your own trips');
    if (trip.status !== 'DRAFT') {
      throw new ValidationError('Only draft trips can be published');
    }
    return this.trips.publish(tripId);
  }
}

@Injectable()
export class CancelTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort) {}

  async execute(userId: string, tripId: string) {
    const trip = await this.trips.findById(tripId);
    if (!trip) throw new NotFoundError('Trip', tripId);
    if (trip.userId !== userId) throw new ForbiddenError('You can only cancel your own trips');
    if (await this.trips.hasActiveShipments(tripId)) {
      throw new ValidationError('Cannot cancel a trip with active shipments');
    }
    return this.trips.cancel(tripId);
  }
}

@Injectable()
export class SearchTripsUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort) {}

  async execute(filter: SearchTripsFilter) {
    const { page, limit } = normalizePagination(filter);
    const { data, total } = await this.trips.search(filter);
    return { data, pagination: buildPaginationMeta(total, page, limit) };
  }
}

@Injectable()
export class ListMyTripsUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort) {}

  async execute(userId: string, status?: TripStatus, page?: number, limit?: number) {
    const { page: p, limit: l } = normalizePagination({ page, limit });
    const { data, total } = await this.trips.listByUser(userId, status, p, l);
    return { data, pagination: buildPaginationMeta(total, p, l) };
  }
}

@Injectable()
export class ListTripRequestsUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort) {}

  async execute(userId: string, tripId: string) {
    const trip = await this.trips.findById(tripId);
    if (!trip) throw new NotFoundError('Trip', tripId);
    if (trip.userId !== userId) {
      throw new ForbiddenError('You can only view requests for your own trips');
    }
    return this.trips.listRequests(tripId);
  }
}
