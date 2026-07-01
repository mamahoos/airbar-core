import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PricingQuoteService } from '../../../application/marketplace/pricing-quote.service.js';
import {
  AcceptShipmentOfferUseCase,
  CancelShipmentUseCase,
  CreateShipmentUseCase,
  DisputeShipmentUseCase,
  GetShipmentUseCase,
  ListMyShipmentsUseCase,
  RejectShipmentOfferUseCase,
  TrackShipmentUseCase,
  UpdateShipmentStatusUseCase,
  UpdateShipmentUseCase,
} from '../../../application/marketplace/shipment.use-cases.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

import {
  AcceptOfferDto,
  CreateShipmentDto,
  DisputeShipmentDto,
  GetQuoteDto,
  ShipmentListQueryDto,
  UpdateShipmentDto,
  UpdateStatusDto,
} from './dto/shipments.dto.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';
import type { ShipmentStatus } from '../../../domain/marketplace/shipment-state-machine.js';

@ApiTags('shipments')
@Controller('shipments')
export class ShipmentsController {
  constructor(
    private readonly pricing: PricingQuoteService,
    private readonly trackShipment: TrackShipmentUseCase,
    private readonly listMyShipments: ListMyShipmentsUseCase,
    private readonly getShipment: GetShipmentUseCase,
    private readonly createShipment: CreateShipmentUseCase,
    private readonly updateShipment: UpdateShipmentUseCase,
    private readonly cancelShipment: CancelShipmentUseCase,
    private readonly acceptOffer: AcceptShipmentOfferUseCase,
    private readonly rejectOffer: RejectShipmentOfferUseCase,
    private readonly updateStatus: UpdateShipmentStatusUseCase,
    private readonly disputeShipment: DisputeShipmentUseCase,
  ) {}

  @Post('quote')
  @Public()
  @ApiOperation({ summary: 'Get price quote for a shipment' })
  async quote(@Body() dto: GetQuoteDto) {
    return this.pricing.getQuote(dto);
  }

  @Get('track/:trackingCode')
  @Public()
  @ApiOperation({ summary: 'Track shipment by tracking code' })
  async track(@Param('trackingCode') trackingCode: string) {
    return this.trackShipment.execute(trackingCode);
  }

  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my shipments (sender)' })
  async my(@CurrentUser() user: AuthUser, @Query() query: ShipmentListQueryDto) {
    return this.listMyShipments.execute(
      user.id,
      'sender',
      query.status as ShipmentStatus | undefined,
      query.page,
      query.limit,
    );
  }

  @Get('carrying')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get shipments I am carrying' })
  async carrying(@CurrentUser() user: AuthUser, @Query() query: ShipmentListQueryDto) {
    return this.listMyShipments.execute(
      user.id,
      'carrier',
      query.status as ShipmentStatus | undefined,
      query.page,
      query.limit,
    );
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get shipment by ID' })
  async byId(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.getShipment.execute(id, user.id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new shipment request' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateShipmentDto) {
    return this.createShipment.execute(user.id, dto);
  }

  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update shipment' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') shipmentId: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.updateShipment.execute(user.id, shipmentId, dto);
  }

  @Post(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel shipment' })
  async cancel(@CurrentUser() user: AuthUser, @Param('id') shipmentId: string) {
    return this.cancelShipment.execute(user.id, shipmentId);
  }

  @Post(':id/accept')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept carrier offer' })
  async accept(
    @CurrentUser() user: AuthUser,
    @Param('id') shipmentId: string,
    @Body() dto: AcceptOfferDto,
  ) {
    return this.acceptOffer.execute(user.id, shipmentId, dto.agreedPrice);
  }

  @Post(':id/reject')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject carrier offer' })
  async reject(@CurrentUser() user: AuthUser, @Param('id') shipmentId: string) {
    return this.rejectOffer.execute(user.id, shipmentId);
  }

  @Post(':id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update shipment status' })
  async status(
    @CurrentUser() user: AuthUser,
    @Param('id') shipmentId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.updateStatus.execute(
      user.id,
      shipmentId,
      dto.status as ShipmentStatus,
      dto.note,
      dto.location,
    );
  }

  @Post(':id/dispute')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open a dispute' })
  async dispute(
    @CurrentUser() user: AuthUser,
    @Param('id') shipmentId: string,
    @Body() dto: DisputeShipmentDto,
  ) {
    return this.disputeShipment.execute(user.id, shipmentId, dto.reason);
  }
}
