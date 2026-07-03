import { describe, expect, it, jest } from '@jest/globals';

import { UpdateProfileUseCase } from './update-profile.use-case.js';

import type {
  UserProfile,
  UserProfileRepositoryPort,
} from '../../domain/users/user-profile.repository.port.js';

const baseProfile: UserProfile = {
  id: 'user-1',
  phone: '+989121234567',
  email: null,
  firstName: 'علی',
  lastName: 'احمدی',
  avatarUrl: null,
  bio: null,
  role: 'USER',
  kycLevel: 'IDENTITY_VERIFIED',
  rating: 0,
  totalTrips: 0,
  totalShipments: 0,
  isActive: true,
  createdAt: new Date('2026-07-03T00:00:00.000Z'),
  nationalIdLocked: true,
  nationalIdMasked: '001****12',
};

function repo(profile: UserProfile | null = baseProfile) {
  const getProfile = jest.fn<() => Promise<UserProfile | null>>().mockResolvedValue(profile);
  const updateProfile = jest.fn<() => Promise<UserProfile>>().mockResolvedValue(baseProfile);
  return {
    profiles: {
      getProfile,
      updateProfile,
    } as unknown as UserProfileRepositoryPort,
    getProfile,
    updateProfile,
  };
}

describe('UpdateProfileUseCase', () => {
  it('rejects first or last name changes after official identity is locked', async () => {
    const { profiles, updateProfile } = repo();
    const useCase = new UpdateProfileUseCase(profiles);

    await expect(useCase.execute('user-1', { firstName: 'نام جدید' })).rejects.toThrow(
      'نام رسمی پس از تأیید هویت قابل تغییر نیست',
    );
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('allows non-name profile changes after official identity is locked', async () => {
    const { profiles, updateProfile } = repo();
    const useCase = new UpdateProfileUseCase(profiles);

    await expect(useCase.execute('user-1', { bio: 'carrier' })).resolves.toEqual(baseProfile);
    expect(updateProfile).toHaveBeenCalledWith('user-1', { bio: 'carrier' });
  });

  it('allows name changes before official identity is locked', async () => {
    const unlocked = { ...baseProfile, nationalIdLocked: false };
    const { profiles, updateProfile } = repo(unlocked);
    const useCase = new UpdateProfileUseCase(profiles);

    await expect(useCase.execute('user-1', { firstName: 'نام جدید' })).resolves.toEqual(
      baseProfile,
    );
    expect(updateProfile).toHaveBeenCalledWith('user-1', { firstName: 'نام جدید' });
  });
});
