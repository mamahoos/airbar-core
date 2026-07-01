import { Inject, Injectable, Logger } from '@nestjs/common';

import { APP_CONFIG } from '../../bootstrap/config/index.js';

import type { AppConfig } from '../../bootstrap/config/index.js';
import type { SmsSenderPort } from '../../domain/auth/ports/sms.sender.port.js';

/** Logs OTP codes in development — no external SMS provider required. */
@Injectable()
export class DevSmsSender implements SmsSenderPort {
  private readonly logger = new Logger(DevSmsSender.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  sendOtp(phone: string, code: string): Promise<boolean> {
    if (this.config.nodeEnv === 'production') {
      this.logger.error('DevSmsSender cannot be used in production');
      return Promise.resolve(false);
    }
    this.logger.log(`[DEV OTP] ${phone}: ${code}`);
    return Promise.resolve(true);
  }
}
