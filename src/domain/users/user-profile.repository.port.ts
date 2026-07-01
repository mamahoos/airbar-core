export interface UserProfile {
  readonly id: string;
  readonly phone: string;
  readonly email: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly avatarUrl: string | null;
  readonly bio: string | null;
  readonly role: string;
  readonly kycLevel: string;
  readonly rating: number;
  readonly totalTrips: number;
  readonly totalShipments: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly nationalIdLocked: boolean;
  readonly nationalIdMasked: string | null;
}

export interface PublicUserProfile {
  readonly id: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly avatarUrl: string | null;
  readonly rating: number;
  readonly totalTrips: number;
  readonly totalShipments: number;
  readonly kycLevel: string;
  readonly createdAt: Date;
}

export interface UpdateProfileInput {
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  readonly email?: string | undefined;
  readonly bio?: string | undefined;
}

export interface UserProfileRepositoryPort {
  getProfile(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile>;
  updateAvatarUrl(userId: string, avatarUrl: string): Promise<{ id: string; avatarUrl: string }>;
  getPublicProfile(userId: string): Promise<PublicUserProfile | null>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  findAuthUserPhone(userId: string): Promise<{ phone: string; passwordHash: string | null } | null>;
}

export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY');
