import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

import type { LookupRepositoryPort } from '../../../domain/marketplace/lookup.repository.port.js';

@Injectable()
export class PrismaLookupRepository implements LookupRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listCities(country?: string) {
    return this.prisma.city.findMany({
      where: {
        isActive: true,
        ...(country ? { country } : {}),
      },
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
    });
  }

  async listAirports(city?: string, country?: string) {
    return this.prisma.airport.findMany({
      where: {
        isActive: true,
        ...(city ? { city } : {}),
        ...(country ? { country } : {}),
      },
      orderBy: [{ country: 'asc' }, { city: 'asc' }, { name: 'asc' }],
    });
  }
}
