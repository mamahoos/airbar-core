import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ListSessionsUseCase } from '../../../application/auth/list-sessions.use-case.js';
import {
  GetWalletUseCase,
  ListWalletTransactionsUseCase,
} from '../../../application/finance/payment.use-cases.js';
import { ChangePasswordUseCase } from '../../../application/users/change-password.use-case.js';
import { GetProfileUseCase } from '../../../application/users/get-profile.use-case.js';
import { UpdateAvatarUseCase } from '../../../application/users/update-avatar.use-case.js';
import { UpdateProfileUseCase } from '../../../application/users/update-profile.use-case.js';
import {
  GetPublicProfileUseCase,
  ListActivityLogsUseCase,
  RevokeSessionUseCase,
} from '../../../application/users/users-misc.use-case.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

import { ChangePasswordDto, UpdateProfileDto } from './dto/users.dto.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

@ApiTags('users')
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly getProfile: GetProfileUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
    private readonly updateAvatar: UpdateAvatarUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly listSessions: ListSessionsUseCase,
    private readonly revokeSession: RevokeSessionUseCase,
    private readonly listActivity: ListActivityLogsUseCase,
    private readonly getPublicProfile: GetPublicProfileUseCase,
    private readonly getWallet: GetWalletUseCase,
    private readonly listWalletTransactions: ListWalletTransactionsUseCase,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.getProfile.execute(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.updateProfile.execute(user.id, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload avatar' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: { buffer: Buffer; originalname: string },
  ) {
    return this.updateAvatar.execute(user.id, file.buffer, file.originalname);
  }

  @Put('me/password')
  @ApiOperation({ summary: 'Change or set password' })
  changePasswordHandler(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.changePassword.execute(user.id, dto.newPassword, dto.currentPassword, dto.otpCode);
  }

  @Get('me/sessions')
  @ApiOperation({ summary: 'Get active sessions' })
  sessions(@CurrentUser() user: AuthUser) {
    return this.listSessions.execute(user.id);
  }

  @Delete('me/sessions/:id')
  @ApiOperation({ summary: 'Revoke a session' })
  revoke(@CurrentUser() user: AuthUser, @Param('id') sessionId: string) {
    return this.revokeSession.execute(user.id, sessionId);
  }

  @Get('me/activity')
  @ApiOperation({ summary: 'Get activity logs (paginated)' })
  activity(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.listActivity.execute(user.id, page, limit);
  }

  @Get('me/wallet')
  @ApiOperation({ summary: 'Wallet balance from airbar-finance' })
  wallet(@CurrentUser() user: AuthUser) {
    return this.getWallet.execute(user.id);
  }

  @Get('me/wallet/transactions')
  @ApiOperation({ summary: 'Wallet transaction history from airbar-finance' })
  walletTransactions(@CurrentUser() user: AuthUser) {
    return this.listWalletTransactions.execute(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public profile of a user' })
  publicProfile(@Param('id') userId: string) {
    return this.getPublicProfile.execute(userId);
  }
}
