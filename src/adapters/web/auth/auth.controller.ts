import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ListSessionsUseCase } from '../../../application/auth/list-sessions.use-case.js';
import { LoginUseCase } from '../../../application/auth/login.use-case.js';
import { LogoutUseCase } from '../../../application/auth/logout.use-case.js';
import { RefreshTokenUseCase } from '../../../application/auth/refresh-token.use-case.js';
import { RegisterUseCase } from '../../../application/auth/register.use-case.js';
import { SendOtpUseCase } from '../../../application/auth/send-otp.use-case.js';
import { VerifyOtpUseCase } from '../../../application/auth/verify-otp.use-case.js';
import { Public } from '../common/decorators/public.decorator.js';

import { CurrentUser } from './decorators/current-user.decorator.js';
import {
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto.js';

import type { AuthUser } from '../../../domain/auth/auth-user.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly sendOtp: SendOtpUseCase,
    private readonly verifyOtp: VerifyOtpUseCase,
    private readonly register: RegisterUseCase,
    private readonly login: LoginUseCase,
    private readonly refreshToken: RefreshTokenUseCase,
    private readonly logout: LogoutUseCase,
    private readonly listSessions: ListSessionsUseCase,
  ) {}

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send OTP to phone number' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  sendOtpHandler(@Body() dto: SendOtpDto) {
    return this.sendOtp.execute(dto.phone);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify OTP and login/register' })
  verifyOtpHandler(
    @Body() dto: VerifyOtpDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.verifyOtp.execute({
      phone: dto.phone,
      code: dto.code,
      ipAddress: ip,
      userAgent,
      deviceInfo: { userAgent },
    });
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user with details' })
  registerHandler(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.register.execute({
      ...dto,
      ipAddress: ip,
      userAgent,
      deviceInfo: { userAgent },
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with phone and password' })
  loginHandler(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    return this.login.execute({
      phone: dto.phone,
      password: dto.password,
      ipAddress: ip,
      userAgent,
      deviceInfo: { userAgent },
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refreshHandler(@Body() dto: RefreshTokenDto) {
    return this.refreshToken.execute(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  async logoutHandler(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto) {
    await this.logout.execute(user.id, dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions' })
  listSessionsHandler(@CurrentUser() user: AuthUser) {
    return this.listSessions.execute(user.id);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  getMe(@CurrentUser() user: AuthUser) {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      kycLevel: user.kycLevel,
      createdAt: user.createdAt,
    };
  }
}
