import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class VerifyIdentityDto {
  @IsString()
  @Length(10, 10)
  nationalId!: string;

  @IsString()
  @Matches(/^(13|14)\d{2}[/-]?(0[1-9]|1[0-2])[/-]?(0[1-9]|[12]\d|3[01])$/, {
    message: 'تاریخ تولد باید شمسی و در قالب 1370/01/01 یا 13700101 باشد',
  })
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
  reasonCode?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}

export class AssignKycDocumentDto {
  @IsOptional()
  @IsString()
  assignedTo?: string;
}
