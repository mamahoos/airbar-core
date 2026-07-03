import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';

import { MatchingService } from '../../../application/marketplace/matching.service.js';
import { AssignShipmentToTripUseCase } from '../../../application/marketplace/shipment.use-cases.js';
import { UserRole } from '../../../domain/auth/user-role.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

class MatchSuggestionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number;
}

@ApiTags('matching')
@Controller('matching')
@ApiBearerAuth()
export class MatchingController {
  constructor(
    private readonly matching: MatchingService,
    private readonly assignShipment: AssignShipmentToTripUseCase,
  ) {}

  @Get('trips/:shipmentId')
  @ApiOperation({ summary: 'Find matching trips for a shipment' })
  async matchingTrips(@Param('shipmentId') shipmentId: string) {
    return this.matching.findMatchingTrips(shipmentId);
  }

  @Get('shipments/:tripId')
  @ApiOperation({ summary: 'Find matching shipments for a trip' })
  async matchingShipments(@Param('tripId') tripId: string) {
    return this.matching.findMatchingShipments(tripId);
  }

  @Get('suggestions/shipments/:shipmentId')
  @ApiOperation({ summary: 'List persisted match suggestions for a shipment' })
  async shipmentSuggestions(
    @Param('shipmentId') shipmentId: string,
    @Query() query: MatchSuggestionsQueryDto,
  ) {
    return this.matching.listPersistedSuggestionsForShipment(shipmentId, query.limit);
  }

  @Get('suggestions/trips/:tripId')
  @ApiOperation({ summary: 'List persisted match suggestions for a trip' })
  async tripSuggestions(@Param('tripId') tripId: string, @Query() query: MatchSuggestionsQueryDto) {
    return this.matching.listPersistedSuggestionsForTrip(tripId, query.limit);
  }

  @Post('assign/:shipmentId/:tripId')
  @ApiOperation({ summary: 'Assign a shipment to a trip' })
  async assign(
    @CurrentUser() user: AuthUser,
    @Param('shipmentId') shipmentId: string,
    @Param('tripId') tripId: string,
  ) {
    return this.assignShipment.execute(shipmentId, tripId, user.id);
  }

  @Post('auto')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Run auto-matching (admin)' })
  async autoMatch() {
    return this.matching.autoMatch();
  }
}
