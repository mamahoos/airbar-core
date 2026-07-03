import { describe, expect, it, jest } from '@jest/globals';

import { UploadKycDocumentUseCase } from './kyc-misc.use-case.js';

import type { KycRepositoryPort } from '../../domain/kyc/kyc.repository.port.js';
import type { ObjectStoragePort } from '../../domain/storage/object-storage.port.js';

function setup(phone: string | null) {
  const getUserPhone = jest.fn<() => Promise<string | null>>().mockResolvedValue(phone);
  const upsertKycDocument = jest.fn<() => Promise<unknown>>().mockResolvedValue({ id: 'doc-1' });
  const upload = jest.fn<() => Promise<string>>().mockResolvedValue('kyc/user-1/doc.png');
  const getSignedUrl = jest
    .fn<() => Promise<string>>()
    .mockResolvedValue('https://storage.example/kyc/user-1/doc.png');
  const kyc = {
    getUserPhone,
    upsertKycDocument,
  } as unknown as KycRepositoryPort;
  const storage = {
    upload,
    getSignedUrl,
  } as unknown as ObjectStoragePort;
  return { useCase: new UploadKycDocumentUseCase(kyc, storage), upload, upsertKycDocument };
}

describe('UploadKycDocumentUseCase', () => {
  it('rejects passport as identity document for Iranian users', async () => {
    const { useCase, upload } = setup('+989121234567');

    await expect(
      useCase.execute('user-1', 'passport', Buffer.from('file'), 'passport.png'),
    ).rejects.toThrow('برای کاربران ایرانی فقط تصویر کارت ملی');
    expect(upload).not.toHaveBeenCalled();
  });

  it('allows national id document for Iranian users', async () => {
    const { useCase, upload, upsertKycDocument } = setup('09121234567');

    await expect(
      useCase.execute('user-1', 'national_id', Buffer.from('file'), 'national-id.png'),
    ).resolves.toEqual({ id: 'doc-1' });
    expect(upload).toHaveBeenCalledWith(
      Buffer.from('file'),
      'national-id.png',
      'kyc/user-1',
      false,
    );
    expect(upsertKycDocument).toHaveBeenCalledWith(
      'user-1',
      'national_id',
      'https://storage.example/kyc/user-1/doc.png',
    );
  });

  it('allows passport for non-Iranian users', async () => {
    const { useCase } = setup('+4915112345678');

    await expect(
      useCase.execute('user-1', 'passport', Buffer.from('file'), 'passport.png'),
    ).resolves.toEqual({ id: 'doc-1' });
  });

  it('allows selfie for Iranian users after identity document stage', async () => {
    const { useCase } = setup('+989121234567');

    await expect(
      useCase.execute('user-1', 'selfie', Buffer.from('file'), 'selfie.png'),
    ).resolves.toEqual({ id: 'doc-1' });
  });
});
