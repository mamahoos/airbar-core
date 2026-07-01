import { Inject, Injectable } from '@nestjs/common';

import {
  LOOKUP_REPOSITORY,
  type LookupRepositoryPort,
} from '../../domain/marketplace/lookup.repository.port.js';

@Injectable()
export class ListCitiesUseCase {
  constructor(@Inject(LOOKUP_REPOSITORY) private readonly lookup: LookupRepositoryPort) {}

  async execute(country?: string) {
    return this.lookup.listCities(country);
  }
}

@Injectable()
export class ListAirportsUseCase {
  constructor(@Inject(LOOKUP_REPOSITORY) private readonly lookup: LookupRepositoryPort) {}

  async execute(city?: string, country?: string) {
    return this.lookup.listAirports(city, country);
  }
}
