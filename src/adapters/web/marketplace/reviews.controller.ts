import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  ListShipmentReviewsUseCase,
  ListUserReviewsUseCase,
  SubmitReviewUseCase,
} from '../../../application/marketplace/review.use-cases.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

import { ReviewListQueryDto, SubmitReviewDto } from './dto/reviews.dto.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(
    private readonly submitReview: SubmitReviewUseCase,
    private readonly listUserReviews: ListUserReviewsUseCase,
    private readonly listShipmentReviews: ListShipmentReviewsUseCase,
  ) {}

  @Post('shipments/:id/reviews')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a review for the counterpart after completion' })
  async submit(
    @CurrentUser() user: AuthUser,
    @Param('id') shipmentId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.submitReview.execute(user.id, shipmentId, dto);
  }

  @Get('shipments/:id/reviews')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List reviews for a shipment (participants only)' })
  async forShipment(@CurrentUser() user: AuthUser, @Param('id') shipmentId: string) {
    return this.listShipmentReviews.execute(user.id, shipmentId);
  }

  @Get('users/:id/reviews')
  @Public()
  @ApiOperation({ summary: 'List reviews received by a user with aggregate rating' })
  async forUser(@Param('id') userId: string, @Query() query: ReviewListQueryDto) {
    return this.listUserReviews.execute(userId, query.page, query.limit);
  }
}
