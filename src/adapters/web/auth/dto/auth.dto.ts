import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

import { normalizePhone } from '../../../../shared/phone/index.js';

function normalizePhoneField({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  return normalizePhone(value);
}

const IRAN_OR_E164 = /^(09\d{9}|\+[1-9]\d{6,14})$/;

export class SendOtpDto {
  @ApiProperty({ example: '09123456789' })
  @Transform(normalizePhoneField)
  @IsString()
  @IsNotEmpty()
  @Matches(IRAN_OR_E164, { message: 'Invalid phone number' })
  phone!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '09123456789' })
  @Transform(normalizePhoneField)
  @IsString()
  @IsNotEmpty()
  @Matches(IRAN_OR_E164)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  code!: string;
}

export class RegisterDto {
  @ApiProperty({ example: '09123456789' })
  @Transform(normalizePhoneField)
  @IsString()
  @IsNotEmpty()
  @Matches(IRAN_OR_E164)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  otpCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class LoginDto {
  @ApiProperty({ example: '09123456789' })
  @Transform(normalizePhoneField)
  @IsString()
  @IsNotEmpty()
  @Matches(IRAN_OR_E164)
  phone!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
