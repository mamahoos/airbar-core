import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import { GetKycStatusUseCase } from '../../../application/kyc/get-kyc-status.use-case.js';
import {
  DeleteBankAccountUseCase,
  LookupPostalCodeUseCase,
  ReviewKycDocumentUseCase,
  UploadKycDocumentUseCase,
  VerifyBankCardUseCase,
} from '../../../application/kyc/kyc-misc.use-case.js';
import { VerifyIdentityUseCase } from '../../../application/kyc/verify-identity.use-case.js';
import { KycLevel } from '../../../domain/auth/kyc-level.js';
import { UserRole } from '../../../domain/auth/user-role.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import { RequireKyc } from './decorators/require-kyc.decorator.js';
import {
  LookupPostalCodeDto,
  ReviewKycDocumentDto,
  VerifyBankCardDto,
  VerifyIdentityDto,
} from './dto/kyc.dto.js';
import { KycLevelGuard } from './guards/kyc-level.guard.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

@ApiTags('kyc')
@Controller('kyc')
@ApiBearerAuth()
export class KycController {
  constructor(
    private readonly getStatus: GetKycStatusUseCase,
    private readonly verifyIdentity: VerifyIdentityUseCase,
    private readonly verifyBankCard: VerifyBankCardUseCase,
    private readonly deleteBankAccount: DeleteBankAccountUseCase,
    private readonly lookupPostalCode: LookupPostalCodeUseCase,
    private readonly uploadDocument: UploadKycDocumentUseCase,
    private readonly reviewDocument: ReviewKycDocumentUseCase,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get KYC status' })
  getKycStatus(@CurrentUser() user: AuthUser) {
    return this.getStatus.execute(user.id);
  }

  @Post('verify-identity')
  @UseGuards(KycLevelGuard)
  @RequireKyc({ minLevel: KycLevel.MOBILE_VERIFIED })
  @ApiOperation({ summary: 'Verify phone with national ID (Shahkar + PersonInfo)' })
  verifyIdentityRoute(@CurrentUser() user: AuthUser, @Body() dto: VerifyIdentityDto) {
    return this.verifyIdentity.execute(user.id, user.phone, dto.nationalId, dto.birthDate);
  }

  @Post('verify-bank-card')
  @UseGuards(KycLevelGuard)
  @RequireKyc({
    minLevel: KycLevel.IDENTITY_VERIFIED,
    requireNationalId: true,
    code: 'IDENTITY_VERIFICATION_REQUIRED',
    redirect: '/dashboard/kyc?step=identity',
    message: 'ابتدا تأیید هویت را تکمیل کنید',
  })
  @ApiOperation({ summary: 'Verify bank card (CardMatch + CardToIban)' })
  verifyBankCardRoute(@CurrentUser() user: AuthUser, @Body() dto: VerifyBankCardDto) {
    return this.verifyBankCard.execute(user.id, dto.cardNumber);
  }

  @Delete('bank-accounts/:id')
  @UseGuards(KycLevelGuard)
  @RequireKyc({
    minLevel: KycLevel.IDENTITY_VERIFIED,
    requireNationalId: true,
    code: 'IDENTITY_VERIFICATION_REQUIRED',
    redirect: '/dashboard/kyc?step=identity',
    message: 'ابتدا تأیید هویت را تکمیل کنید',
  })
  @ApiOperation({ summary: 'Remove a verified bank card' })
  deleteBankAccountRoute(@CurrentUser() user: AuthUser, @Param('id') accountId: string) {
    return this.deleteBankAccount.execute(user.id, accountId);
  }

  @Post('postal-code')
  @ApiOperation({ summary: 'Lookup Iranian postal code via api.ir' })
  lookupPostalCodeRoute(@CurrentUser() user: AuthUser, @Body() dto: LookupPostalCodeDto) {
    return this.lookupPostalCode.execute(user.id, dto.postalCode, dto.label);
  }

  @Post('documents/:type')
  @UseGuards(KycLevelGuard)
  @RequireKyc({
    minLevel: KycLevel.IDENTITY_VERIFIED,
    requireNationalId: true,
    code: 'IDENTITY_VERIFICATION_REQUIRED',
    redirect: '/dashboard/kyc?step=identity',
    message: 'ابتدا تأیید هویت را تکمیل کنید',
  })
  @ApiOperation({ summary: 'Upload KYC document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocumentRoute(
    @CurrentUser() user: AuthUser,
    @Param('type') type: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)|application\/pdf$/ }),
        ],
      }),
    )
    file: { buffer: Buffer; originalname: string },
  ) {
    return this.uploadDocument.execute(user.id, type, file.buffer, file.originalname);
  }

  @Post('admin/review/:documentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Review KYC document (Admin)' })
  reviewDocumentRoute(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
    @Body() dto: ReviewKycDocumentDto,
  ) {
    return this.reviewDocument.execute(user.id, documentId, dto.status, dto.rejectionReason);
  }
}
