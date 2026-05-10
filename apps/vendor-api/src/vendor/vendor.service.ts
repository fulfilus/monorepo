import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";

@Injectable()
export class VendorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVendorDto, createdBy: string) {
    const vendor = await this.prisma.vendor.create({
      data: {
        shopName: dto.shopName,
        shopDetails: dto.shopDetails,
        location: dto.location,
        whatsappNumber: dto.whatsappNumber,
        gstNumber: dto.gstNumber,
        contactStatus: dto.contactStatus,
        notes: dto.notes,
        categories: dto.categories,
        ...(dto.payment && { payment: { create: dto.payment } }),
        ...(dto.bankAccount && { bankAccount: { create: dto.bankAccount } }),
        auditLogs: {
          create: { action: "CREATE", changedBy: createdBy },
        },
      },
      include: { payment: true, bankAccount: true },
    });
    return vendor;
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        skip,
        take: limit,
        include: { payment: true, bankAccount: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.vendor.count(),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: { payment: true, bankAccount: true, documents: true },
    });
    if (!vendor) throw new NotFoundException(`Vendor ${id} not found`);
    return vendor;
  }

  async update(id: string, dto: UpdateVendorDto, updatedBy: string) {
    await this.findOne(id);
    const { payment, bankAccount, categories, ...scalar } = dto;
    return this.prisma.vendor.update({
      where: { id },
      data: {
        ...scalar,
        ...(categories && { categories }),
        ...(payment && {
          payment: { upsert: { create: payment, update: payment } },
        }),
        ...(bankAccount && {
          bankAccount: {
            upsert: { create: bankAccount, update: bankAccount },
          },
        }),
        auditLogs: {
          create: { action: "UPDATE", changedBy: updatedBy, diff: dto as object },
        },
      },
      include: { payment: true, bankAccount: true },
    });
  }

  async updateShopPhoto(id: string, url: string, updatedBy: string) {
    await this.findOne(id);
    return this.prisma.vendor.update({
      where: { id },
      data: {
        shopPhotoUrl: url,
        auditLogs: {
          create: { action: "PHOTO_UPLOAD", changedBy: updatedBy },
        },
      },
    });
  }
}
