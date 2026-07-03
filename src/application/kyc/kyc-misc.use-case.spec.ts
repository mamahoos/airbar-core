import { describe, expect, it, jest } from '@jest/globals';

import {
  AssignKycDocumentUseCase,
  ReviewKycDocumentUseCase,
  UploadKycDocumentUseCase,
} from './kyc-misc.use-case.js';

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

describe('ReviewKycDocumentUseCase', () => {
  function setupReview() {
    const reviewDocument = jest
      .fn<() => Promise<{ userId: string } | null>>()
      .mockResolvedValue({ userId: 'user-1' });
    const upgradeKycLevelIfNeeded = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const kyc = {
      reviewDocument,
      upgradeKycLevelIfNeeded,
    } as unknown as KycRepositoryPort;
    return {
      useCase: new ReviewKycDocumentUseCase(kyc),
      reviewDocument,
      upgradeKycLevelIfNeeded,
    };
  }

  it('requires a reason code and human reason for rejected documents', async () => {
    const { useCase, reviewDocument } = setupReview();

    await expect(useCase.execute('admin-1', 'doc-1', 'REJECTED')).rejects.toThrow(
      'KYC rejection reason code is required',
    );
    await expect(
      useCase.execute('admin-1', 'doc-1', 'REJECTED', 'BLURRY_IMAGE', ' '),
    ).rejects.toThrow('KYC rejection reason is required');
    expect(reviewDocument).not.toHaveBeenCalled();
  });

  it('stores normalized reason code, reason and review note', async () => {
    const { useCase, reviewDocument } = setupReview();

    await expect(
      useCase.execute(
        'admin-1',
        'doc-1',
        'REJECTED',
        ' blurry_image ',
        ' تصویر واضح نیست ',
        ' دوباره ارسال شود ',
      ),
    ).resolves.toEqual({ success: true });

    expect(reviewDocument).toHaveBeenCalledWith(
      'admin-1',
      'doc-1',
      'REJECTED',
      'BLURRY_IMAGE',
      'تصویر واضح نیست',
      'دوباره ارسال شود',
    );
  });

  it('uses CLEAR reason code for approved documents and upgrades KYC level', async () => {
    const { useCase, reviewDocument, upgradeKycLevelIfNeeded } = setupReview();

    await expect(useCase.execute('admin-1', 'doc-1', 'APPROVED')).resolves.toEqual({
      success: true,
    });
    expect(reviewDocument).toHaveBeenCalledWith(
      'admin-1',
      'doc-1',
      'APPROVED',
      'CLEAR',
      undefined,
      undefined,
    );
    expect(upgradeKycLevelIfNeeded).toHaveBeenCalledWith('user-1');
  });
});

describe('AssignKycDocumentUseCase', () => {
  it('assigns a KYC document review to an admin', async () => {
    const assignDocument = jest.fn<() => Promise<{ id: string } | null>>().mockResolvedValue({
      id: 'doc-1',
    });
    const useCase = new AssignKycDocumentUseCase({
      assignDocument,
    } as unknown as KycRepositoryPort);

    await expect(useCase.execute('doc-1', 'admin-1')).resolves.toEqual({
      id: 'doc-1',
      assignedTo: 'admin-1',
    });
    expect(assignDocument).toHaveBeenCalledWith('doc-1', 'admin-1');
  });
});
