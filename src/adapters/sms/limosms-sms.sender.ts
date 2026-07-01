import { Inject, Injectable, Logger } from '@nestjs/common';

import { APP_CONFIG } from '../../bootstrap/config/index.js';
import { isIranianPhone } from '../../shared/phone/index.js';

import type { AppConfig } from '../../bootstrap/config/index.js';
import type { SmsSenderPort } from '../../domain/auth/ports/sms.sender.port.js';

@Injectable()
export class LimosmsSmsSender implements SmsSenderPort {
  private readonly logger = new Logger(LimosmsSmsSender.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async sendOtp(phone: string, code: string): Promise<boolean> {
    if (!isIranianPhone(phone)) {
      return false;
    }

    const apiKey = this.config.limosmsApiKey;
    if (!apiKey) {
      if (this.config.nodeEnv === 'development') {
        this.logger.log(`[DEV] OTP for ${phone}: ${code}`);
        return true;
      }
      this.logger.error('[Limosms] API key not configured');
      return false;
    }

    const patternId = this.config.limosmsOtpPattern;
    if (patternId) {
      return this.sendPattern(phone, patternId, [code], apiKey);
    }

    const senderNumber = this.config.limosmsSenderNumber;
    if (!senderNumber) {
      this.logger.error('[Limosms] LIMOSMS_SENDER_NUMBER required for plain SMS');
      return false;
    }

    const footer = this.config.limosmsFooter ?? '';
    const message = footer
      ? `کد تایید AirBar: ${code}\nاین کد تا ۵ دقیقه معتبر است.\n${footer}`
      : `کد تایید AirBar: ${code}\nاین کد تا ۵ دقیقه معتبر است.`;

    return this.post('/api/sendsms', {
      Message: message,
      SenderNumber: senderNumber,
      MobileNumber: [this.normalizePhone(phone)],
    }, apiKey, phone);
  }

  private async sendPattern(
    phone: string,
    otpId: string,
    replaceToken: string[],
    apiKey: string,
  ): Promise<boolean> {
    return this.post(
      '/api/sendpatternmessage',
      {
        OtpId: Number(otpId),
        ReplaceToken: replaceToken,
        MobileNumber: this.normalizePhone(phone),
      },
      apiKey,
      phone,
    );
  }

  private async post(
    path: string,
    payload: Record<string, unknown>,
    apiKey: string,
    phone: string,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(`https://api.limosms.com${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ApiKey: apiKey },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const text = await response.text();
      if (!text.trim()) return false;

      const data = JSON.parse(text) as Record<string, unknown>;
      if (data.Success || data.success) {
        this.logger.log(`[Limosms] OTP sent to ${phone}`);
        return true;
      }

      this.logger.error(`[Limosms] ${path} failed: ${JSON.stringify(data)}`);
      return false;
    } catch (error) {
      clearTimeout(timeoutId);
      this.logger.error('[Limosms] request failed', error);
      return false;
    }
  }

  private normalizePhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = `98${cleaned.slice(1)}`;
    if (!cleaned.startsWith('98')) cleaned = `98${cleaned}`;
    return cleaned;
  }
}
