import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { MatchingService } from '../../../application/marketplace/matching.service.js';
import { AssignShipmentToTripUseCase } from '../../../application/marketplace/shipment.use-cases.js';
import { UserRole } from '../../../domain/auth/user-role.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

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
