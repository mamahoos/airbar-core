import { Module } from '@nestjs/common';

import { NOTIFICATION_REPOSITORY } from '../../../domain/notifications/notification.repository.port.js';

import { PrismaNotificationRepository } from './prisma-notification.repository.js';

@Module({
  providers: [{ provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository }],
  exports: [NOTIFICATION_REPOSITORY],
})
export class NotificationPersistenceModule {}
