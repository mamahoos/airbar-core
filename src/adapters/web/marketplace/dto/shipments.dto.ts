import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CargoType, Currency, ShipmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class GetQuoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  originCountry!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destinationCountry!: string;

  @ApiProperty({ enum: CargoType })
  @IsEnum(CargoType)
  cargoType!: CargoType;

  @ApiProperty({ example: 2.5 })
  @IsNumber()
  @Min(0.1)
  weight!: number;
}

export class CreateShipmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  originCity!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  originCountry!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  originLocation?: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destinationCity!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destinationCountry!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  destinationLocation?: Record<string, unknown>;

  @ApiProperty({ enum: CargoType })
  @IsEnum(CargoType)
  cargoType!: CargoType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.1)
  weight!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  dimensions?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  declaredValue?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  senderContact?: Record<string, unknown>;

  @ApiProperty()
  @IsObject()
  receiverContact!: Record<string, unknown>;

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

export class UpdateShipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  originLocation?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  destinationLocation?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: CargoType })
  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  dimensions?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  declaredValue?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  senderContact?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  receiverContact?: Record<string, unknown>;
}

export class UpdateStatusDto {
  @ApiProperty({ enum: ShipmentStatus })
  @IsEnum(ShipmentStatus)
  status!: ShipmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  location?: Record<string, unknown>;
}

export class DisputeShipmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class AcceptOfferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  agreedPrice?: number;
}

export class ShipmentListQueryDto {
  @ApiPropertyOptional({ enum: ShipmentStatus })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
