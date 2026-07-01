export interface PersonInfoResult {
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  readonly fatherName?: string | undefined;
  readonly birthDate?: string | undefined;
  readonly gender?: string | undefined;
  readonly isAlive?: boolean | undefined;
  readonly raw?: unknown;
}

export interface ShahkarResult {
  readonly isMatch: boolean;
  readonly errorMessage?: string | undefined;
}

export interface CardMatchResult {
  readonly isMatch: boolean;
  readonly raw?: unknown;
}

export interface CardToIbanResult {
  readonly iban?: string | undefined;
  readonly bankName?: string | undefined;
  readonly accountHolderName?: string | undefined;
  readonly raw?: unknown;
}

export interface PostalCodeInfoResult {
  readonly fullAddress?: string | undefined;
  readonly province?: string | undefined;
  readonly city?: string | undefined;
  readonly district?: string | undefined;
  readonly raw?: unknown;
}

export interface PostalCodeLocationResult {
  readonly latitude?: number | undefined;
  readonly longitude?: number | undefined;
  readonly raw?: unknown;
}

export interface ApiIrPort {
  shahkar(phone: string, nationalId: string): Promise<ShahkarResult>;
  personInfo(nationalId: string, birthDate: string): Promise<PersonInfoResult>;
  cardMatch(cardNumber: string, nationalId: string, birthDate: string): Promise<CardMatchResult>;
  cardToIban(cardNumber: string): Promise<CardToIbanResult>;
  postalCodeInfo(postalCode: string): Promise<PostalCodeInfoResult>;
  postalCodeLocation(postalCode: string): Promise<PostalCodeLocationResult>;
}

export const API_IR = Symbol('API_IR');
