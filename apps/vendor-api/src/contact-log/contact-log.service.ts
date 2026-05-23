import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CreateContactLogDto } from "./contact-log.dto";

@Injectable()
export class ContactLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(vendorId: string, dto: CreateContactLogDto) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) throw new NotFoundException(`Vendor ${vendorId} not found`);

    return this.prisma.contactLog.create({
      data: {
        vendorId,
        type: dto.type,
        notes: dto.notes,
        contactedBy: dto.contactedBy,
      },
    });
  }

  async findAll(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) throw new NotFoundException(`Vendor ${vendorId} not found`);

    return this.prisma.contactLog.findMany({
      where: { vendorId },
      orderBy: { contactedAt: "desc" },
      select: {
        id: true,
        type: true,
        notes: true,
        contactedBy: true,
        contactedAt: true,
      },
    });
  }

  async remove(vendorId: string, logId: string) {
    const log = await this.prisma.contactLog.findFirst({ where: { id: logId, vendorId } });
    if (!log) throw new NotFoundException(`Contact log ${logId} not found`);
    await this.prisma.contactLog.delete({ where: { id: logId } });
  }
}
