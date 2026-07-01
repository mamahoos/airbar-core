import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CargoType, Currency, TripStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTripDto {
  @ApiProperty({ example: 'تهران' })
  @IsString()
  @IsNotEmpty()
  originCity!: string;

  @ApiProperty({ example: 'ایران' })
  @IsString()
  @IsNotEmpty()
  originCountry!: string;

  @ApiPropertyOptional({ example: 'IKA' })
  @IsOptional()
  @IsString()
  originAirport?: string;

  @ApiProperty({ example: 'استانبول' })
  @IsString()
  @IsNotEmpty()
  destinationCity!: string;

  @ApiProperty({ example: 'ترکیه' })
  @IsString()
  @IsNotEmpty()
  destinationCountry!: string;

  @ApiPropertyOptional({ example: 'IST' })
  @IsOptional()
  @IsString()
  destinationAirport?: string;

  @ApiProperty({ example: '2026-12-15T10:00:00Z' })
  @IsDateString()
  departureDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  flightNumber?: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.1)
  availableWeight!: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.1)
  maxWeight!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  availableVolume?: number;

  @ApiPropertyOptional({ enum: CargoType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(CargoType, { each: true })
  acceptedCargoTypes?: CargoType[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restrictions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(0)
  basePricePerKg!: number;

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

export class UpdateTripDto {
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
  originAirport?: string;

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
  destinationAirport?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  flightNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  availableWeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  maxWeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  availableVolume?: number;

  @ApiPropertyOptional({ enum: CargoType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(CargoType, { each: true })
  acceptedCargoTypes?: CargoType[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restrictions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePricePerKg?: number;

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

export class SearchTripsDto {
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
  destinationCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  departureDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  departureDateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minWeight?: number;

  @ApiPropertyOptional({ enum: CargoType })
  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType;

  @ApiPropertyOptional({ enum: CargoType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(CargoType, { each: true })
  cargoTypes?: CargoType[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

export class MyTripsQueryDto {
  @ApiPropertyOptional({ enum: TripStatus })
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

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
