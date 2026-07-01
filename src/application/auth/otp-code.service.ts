import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../../bootstrap/config/index.js';
import { OTP_REPOSITORY, type OtpRepositoryPort } from '../../domain/auth/ports/otp.repository.port.js';
import { SMS_SENDER, type SmsSenderPort } from '../../domain/auth/ports/sms.sender.port.js';
import { ValidationError } from '../../shared/errors/index.js';
import { isIranianPhone } from '../../shared/phone/index.js';

import type { AppConfig } from '../../bootstrap/config/index.js';

@Injectable()
export class OtpCodeService {
  constructor(
    @Inject(OTP_REPOSITORY) private readonly otpRepo: OtpRepositoryPort,
    @Inject(SMS_SENDER) private readonly sms: SmsSenderPort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async generateAndSend(phone: string): Promise<{ expiresIn: number }> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.config.otpExpiresIn * 1000);

    await this.otpRepo.invalidateActive(phone);
    await this.otpRepo.create(phone, code, expiresAt);

    const sent = await this.sms.sendOtp(phone, code);
    if (!sent) {
      await this.otpRepo.invalidateByCode(phone, code);
      throw new ValidationError(
        isIranianPhone(phone)
          ? 'ارسال پیامک ممکن نشد. لطفاً کمی بعد دوباره تلاش کنید.'
          : 'ارسال پیامک برای این کشور هنوز فعال نیست. لطفاً با پشتیبانی تماس بگیرید.',
      );
    }

    return { expiresIn: this.config.otpExpiresIn };
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const otp = await this.otpRepo.findActive(phone, code);
    if (!otp) {
      await this.otpRepo.incrementAttempts(phone);
      return false;
    }

    if (otp.attempts >= 5) {
      return false;
    }

    await this.otpRepo.markVerified(otp.id);
    return true;
  }

  private generateCode(): string {
    const length = this.config.otpLength;
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }
}
