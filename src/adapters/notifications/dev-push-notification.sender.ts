import { Injectable, Logger } from '@nestjs/common';

import type { PushNotificationSenderPort } from '../../domain/notifications/push-notification.sender.port.js';

@Injectable()
export class DevPushNotificationSender implements PushNotificationSenderPort {
  private readonly logger = new Logger(DevPushNotificationSender.name);

  send(userId: string, title: string, body: string, data?: unknown): Promise<void> {
    this.logger.log(
      `[dev push] user=${userId} title=${title} body=${body} data=${JSON.stringify(data ?? null)}`,
    );
    return Promise.resolve();
  }
}
