export const PUSH_NOTIFICATION_SENDER = Symbol('PUSH_NOTIFICATION_SENDER');

export interface PushNotificationSenderPort {
  send(userId: string, title: string, body: string, data?: unknown): Promise<void>;
}
