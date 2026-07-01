import { Inject, Injectable, Logger } from '@nestjs/common';

import { APP_CONFIG } from '../../../bootstrap/config/index.js';
import { ValidationError } from '../../../shared/errors/index.js';

import type { AppConfig } from '../../../bootstrap/config/index.js';
import type {
  ApiIrPort,
  CardMatchResult,
  CardToIbanResult,
  PersonInfoResult,
  PostalCodeInfoResult,
  PostalCodeLocationResult,
  ShahkarResult,
} from '../../../domain/kyc/api-ir.port.js';

type ApiEndpoint =
  | 'ShahkarLite'
  | 'PersonInfo'
  | 'CardMatch'
  | 'CardToIban'
  | 'PostalCodeInfo'
  | 'PostalCodeLocation';

@Injectable()
export class ApiIrClient implements ApiIrPort {
  private readonly logger = new Logger(ApiIrClient.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async shahkar(phone: string, nationalId: string): Promise<ShahkarResult> {
    const result = await this.post('ShahkarLite', {
      mobile: formatIranMobileLocal(phone),
      nationalCode: nationalId,
    });
    if (this.config.apiIrDevMock && !result.ok) {
      return { isMatch: true };
    }
    if (!result.ok) {
      return { isMatch: false, errorMessage: result.error };
    }
    const parsed = parseBooleanResult(result.data);
    return { isMatch: parsed.isMatch, errorMessage: parsed.message };
  }

  async personInfo(nationalId: string, birthDate: string): Promise<PersonInfoResult> {
    const formatted = formatJalaliBirthDate(birthDate);
    const result = await this.post('PersonInfo', {
      nationalCode: nationalId,
      birthDate: formatted,
    });
    if (this.config.apiIrDevMock && !result.ok) {
      return {
        firstName: 'تست',
        lastName: 'کاربر',
        fatherName: 'علی',
        birthDate: formatted,
        raw: { mocked: true },
      };
    }
    if (!result.ok) {
      throw new ValidationError(result.error ?? 'استعلام اطلاعات هویتی ناموفق بود');
    }
    const data = unwrapData(result.data);
    const firstName = toStr(data.firstName ?? data.name).trim();
    const lastName = toStr(data.lastName ?? data.family).trim();
    if (!firstName && !lastName) {
      throw new ValidationError('تاریخ تولد با کد ملی مطابقت ندارد یا اطلاعات هویتی یافت نشد');
    }
    return {
      firstName,
      lastName,
      fatherName: data.fatherName != null ? toStr(data.fatherName) : undefined,
      birthDate: formatted,
      gender: data.gender != null ? toStr(data.gender) : undefined,
      isAlive: (data.isAlive ?? data.alive) as boolean | undefined,
      raw: data,
    };
  }

  async cardMatch(
    cardNumber: string,
    nationalId: string,
    birthDate: string,
  ): Promise<CardMatchResult> {
    const result = await this.post('CardMatch', {
      cardNumber: cardNumber.replace(/\D/g, ''),
      nationalCode: nationalId,
      birthDate: formatJalaliBirthDate(birthDate),
    });
    if (this.config.apiIrDevMock && !result.ok) {
      return { isMatch: true, raw: { mocked: true } };
    }
    if (!result.ok) {
      return { isMatch: false, raw: result.data };
    }
    const parsed = parseBooleanResult(result.data);
    return { isMatch: parsed.isMatch, raw: result.data };
  }

  async cardToIban(cardNumber: string): Promise<CardToIbanResult> {
    const result = await this.post('CardToIban', {
      cardNumber: cardNumber.replace(/\D/g, ''),
    });
    if (this.config.apiIrDevMock && !result.ok) {
      return {
        iban: 'IR000000000000000000000000',
        bankName: 'Mock Bank',
        accountHolderName: 'Test User',
        raw: { mocked: true },
      };
    }
    if (!result.ok) {
      return { raw: result.data };
    }
    const data = unwrapData(result.data);
    return {
      iban: data.iban != null ? toStr(data.iban) : undefined,
      bankName: data.bankName != null ? toStr(data.bankName) : undefined,
      accountHolderName:
        data.accountHolderName != null ? toStr(data.accountHolderName) : undefined,
      raw: data,
    };
  }

  async postalCodeInfo(postalCode: string): Promise<PostalCodeInfoResult> {
    const result = await this.post('PostalCodeInfo', { postalCode });
    if (this.config.apiIrDevMock && !result.ok) {
      return { fullAddress: 'آدرس تست', province: 'تهران', city: 'تهران' };
    }
    const data = unwrapData(result.data ?? {});
    return {
      fullAddress: data.fullAddress != null ? toStr(data.fullAddress) : undefined,
      province: data.province != null ? toStr(data.province) : undefined,
      city: data.city != null ? toStr(data.city) : undefined,
      district: data.district != null ? toStr(data.district) : undefined,
      raw: data,
    };
  }

  async postalCodeLocation(postalCode: string): Promise<PostalCodeLocationResult> {
    const result = await this.post('PostalCodeLocation', { postalCode });
    if (this.config.apiIrDevMock && !result.ok) {
      return { latitude: 35.7, longitude: 51.4 };
    }
    const data = unwrapData(result.data ?? {});
    return {
      latitude: data.latitude != null ? Number(data.latitude) : undefined,
      longitude: data.longitude != null ? Number(data.longitude) : undefined,
      raw: data,
    };
  }

  private async post(
    endpoint: ApiEndpoint,
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    if (!this.config.apiIrBearerToken && !this.config.apiIrDevMock) {
      return { ok: false, error: 'API_IR_BEARER_TOKEN not configured' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.apiIrTimeoutMs);

    try {
      const response = await fetch(`${this.config.apiIrBaseUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiIrBearerToken
            ? { Authorization: `Bearer ${this.config.apiIrBearerToken}` }
            : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const text = await response.text();
      let data: unknown = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        return { ok: false, error: `Invalid JSON from api.ir ${endpoint}` };
      }
      if (!response.ok) {
        return { ok: false, data, error: `api.ir ${endpoint} HTTP ${response.status}` };
      }
      return { ok: true, data };
    } catch (error) {
      clearTimeout(timeout);
      this.logger.warn(`api.ir ${endpoint} failed`, error);
      return { ok: false, error: 'api.ir request failed' };
    }
  }
}

function formatIranMobileLocal(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length >= 12) return `0${digits.slice(2, 12)}`;
  if (digits.startsWith('0') && digits.length === 11) return digits;
  if (digits.startsWith('9') && digits.length === 10) return `0${digits}`;
  return phone;
}

function formatJalaliBirthDate(value: string): string {
  const trimmed = value.trim().replace(/\//g, '');
  if (trimmed.length === 8) {
    return `${trimmed.slice(0, 4)}/${trimmed.slice(4, 6)}/${trimmed.slice(6, 8)}`;
  }
  return value.trim();
}

function unwrapData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const root = data as Record<string, unknown>;
  if (root.data && typeof root.data === 'object') {
    return root.data as Record<string, unknown>;
  }
  return root;
}

function parseBooleanResult(data: unknown): { isMatch: boolean; message?: string } {
  const root = unwrapData(data);
  const isMatch = Boolean(root.isMatch ?? root.matched ?? root.success ?? root.result);
  const message = root.message != null ? toStr(root.message) : undefined;
  return message !== undefined ? { isMatch, message } : { isMatch };
}

function toStr(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}
