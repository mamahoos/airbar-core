import { Module } from '@nestjs/common';

import {
  DeleteNotificationUseCase,
  ListNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
  NotificationService,
} from '../../../application/notifications/notification.use-cases.js';
import { PUSH_NOTIFICATION_SENDER } from '../../../domain/notifications/push-notification.sender.port.js';
import { DevPushNotificationSender } from '../../notifications/dev-push-notification.sender.js';
import { NotificationPersistenceModule } from '../../persistence/notifications/notification-persistence.module.js';

import { NotificationsController } from './notifications.controller.js';

@Module({
  imports: [NotificationPersistenceModule],
  controllers: [NotificationsController],
  providers: [
    { provide: PUSH_NOTIFICATION_SENDER, useClass: DevPushNotificationSender },
    NotificationService,
    ListNotificationsUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
    DeleteNotificationUseCase,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
