import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class VerifyIdentityDto {
  @IsString()
  @Length(10, 10)
  nationalId!: string;

  @IsString()
  birthDate!: string;
}

export class VerifyBankCardDto {
  @IsString()
  cardNumber!: string;
}

export class LookupPostalCodeDto {
  @IsString()
  postalCode!: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class ReviewKycDocumentDto {
  @IsIn(['APPROVED', 'REJECTED', 'PENDING'])
  status!: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
