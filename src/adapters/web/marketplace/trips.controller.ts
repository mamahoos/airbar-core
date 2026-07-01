import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

import { CreateTripDto, MyTripsQueryDto, SearchTripsDto, UpdateTripDto } from './dto/trips.dto.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(
    private readonly searchTrips: SearchTripsUseCase,
    private readonly listMyTrips: ListMyTripsUseCase,
    private readonly getTrip: GetTripUseCase,
    private readonly listRequests: ListTripRequestsUseCase,
    private readonly createTrip: CreateTripUseCase,
    private readonly updateTrip: UpdateTripUseCase,
    private readonly deleteTrip: DeleteTripUseCase,
    private readonly publishTrip: PublishTripUseCase,
    private readonly cancelTrip: CancelTripUseCase,
  ) {}

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Search available trips' })
  async search(@Query() dto: SearchTripsDto) {
    return this.searchTrips.execute({
      ...dto,
      departureDateFrom: dto.departureDateFrom ? new Date(dto.departureDateFrom) : undefined,
      departureDateTo: dto.departureDateTo ? new Date(dto.departureDateTo) : undefined,
    });
  }

  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my trips' })
  async myTrips(@CurrentUser() user: AuthUser, @Query() query: MyTripsQueryDto) {
    return this.listMyTrips.execute(user.id, query.status, query.page, query.limit);
  }

  @Get(':id/requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get shipment requests for a trip' })
  async requests(@CurrentUser() user: AuthUser, @Param('id') tripId: string) {
    return this.listRequests.execute(user.id, tripId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get trip by ID' })
  async byId(@Param('id') id: string) {
    return this.getTrip.execute(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new trip' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTripDto) {
    return this.createTrip.execute(user.id, {
      ...dto,
      departureDate: new Date(dto.departureDate),
      arrivalDate: dto.arrivalDate ? new Date(dto.arrivalDate) : undefined,
    });
  }

  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a trip' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') tripId: string,
    @Body() dto: UpdateTripDto,
  ) {
    return this.updateTrip.execute(user.id, tripId, {
      ...dto,
      departureDate: dto.departureDate ? new Date(dto.departureDate) : undefined,
      arrivalDate: dto.arrivalDate ? new Date(dto.arrivalDate) : undefined,
    });
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a trip' })
  async delete(@CurrentUser() user: AuthUser, @Param('id') tripId: string) {
    return this.deleteTrip.execute(user.id, tripId);
  }

  @Post(':id/publish')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a draft trip' })
  async publish(@CurrentUser() user: AuthUser, @Param('id') tripId: string) {
    return this.publishTrip.execute(user.id, tripId);
  }

  @Post(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a trip' })
  async cancel(@CurrentUser() user: AuthUser, @Param('id') tripId: string) {
    return this.cancelTrip.execute(user.id, tripId);
  }
}
