import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 30, unreadOnly = false) {
    const skip = (page - 1) * limit;
    const where = unreadOnly ? { readAt: null } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.notification.count({ where }),
    ]);
    const unreadCount = await this.prisma.notification.count({ where: { readAt: null } });
    return { data, total, page, limit, unreadCount };
  }

  async markRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead() {
    await this.prisma.notification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async create(type: string, title: string, body?: string, entityId?: string, entityType?: string) {
    return this.prisma.notification.create({ data: { type, title, body, entityId, entityType } });
  }

  async unreadCount() {
    const count = await this.prisma.notification.count({ where: { readAt: null } });
    return { count };
  }
}
