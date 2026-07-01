import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';

import { PrismaService } from '../../adapters/persistence/prisma.service.js';
import { NotFoundError } from '../../shared/errors/index.js';

@Injectable()
export class InternalService {
  constructor(private readonly prisma: PrismaService) {}

  private toLegacyUser(user: { id: string; phone: string; email: string | null }) {
    const mobile = user.phone.replace(/\D/g, '').replace(/^98/, '');
    return {
      ID: user.id,
      JID: null,
      TelephonePrimary: user.phone,
      PushIds: [] as string[],
      mobile,
      email: user.email,
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User', id);
    return this.toLegacyUser(user);
  }

  async getBulkUsers(ids: string[]) {
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } } });
    return { data: users.map((u) => this.toLegacyUser(u)) };
  }

  async createInAppNotification(body: {
    userId: string;
    title: string;
    body: string;
    type?: NotificationType;
    data?: Record<string, unknown>;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: body.userId,
        type: body.type ?? NotificationType.PUSH,
        title: body.title,
        body: body.body,
        ...(body.data !== undefined ? { data: body.data as Prisma.InputJsonValue } : {}),
      },
    });
  }
}
