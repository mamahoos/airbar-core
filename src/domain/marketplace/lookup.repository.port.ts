export const LOOKUP_REPOSITORY = Symbol('LOOKUP_REPOSITORY');

export interface CityRecord {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly country: string;
  readonly countryCode: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly timezone: string | null;
}

export interface AirportRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly nameEn: string;
  readonly city: string;
  readonly country: string;
  readonly countryCode: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface LookupRepositoryPort {
  listCities(country?: string): Promise<readonly CityRecord[]>;
  listAirports(city?: string, country?: string): Promise<readonly AirportRecord[]>;
}
