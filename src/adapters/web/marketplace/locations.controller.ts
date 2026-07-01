import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ListAirportsUseCase,
  ListCitiesUseCase,
} from '../../../application/marketplace/lookup.use-cases.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(
    private readonly listCities: ListCitiesUseCase,
    private readonly listAirports: ListAirportsUseCase,
  ) {}

  @Get('cities')
  @Public()
  @ApiOperation({ summary: 'List cities' })
  async cities(@Query('country') country?: string) {
    return this.listCities.execute(country);
  }

  @Get('airports')
  @Public()
  @ApiOperation({ summary: 'List airports' })
  async airports(@Query('city') city?: string, @Query('country') country?: string) {
    return this.listAirports.execute(city, country);
  }
}
