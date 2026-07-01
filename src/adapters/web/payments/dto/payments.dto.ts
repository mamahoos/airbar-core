import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsUUID, Min } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty()
  @IsUUID()
  shipmentId!: string;

  @ApiProperty({ enum: ['ZIBAL', 'WALLET'] })
  @IsIn(['ZIBAL', 'WALLET'])
  method!: 'ZIBAL' | 'WALLET';
}

export class RequestWithdrawalDto {
  @ApiProperty({ description: 'Amount in rials' })
  @IsInt()
  @Min(10_000)
  amount!: number;
}
