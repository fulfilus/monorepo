import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CreateContractDto, UpdateContractDto } from "./contracts.dto";

const VENDOR_SELECT = { id: true, shopName: true };

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(vendorId?: string, itemName?: string, status?: string) {
    return this.prisma.agreedRateContract.findMany({
      where: {
        ...(vendorId ? { vendorId } : {}),
        ...(itemName ? { itemName: { contains: itemName, mode: "insensitive" as const } } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: { vendor: { select: VENDOR_SELECT } },
      orderBy: [{ status: "asc" }, { validFrom: "desc" }],
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.agreedRateContract.findUnique({
      where: { id },
      include: { vendor: { select: VENDOR_SELECT } },
    });
    if (!c) throw new NotFoundException(`Contract ${id} not found`);
    return c;
  }

  async create(dto: CreateContractDto) {
    return this.prisma.agreedRateContract.create({
      data: {
        vendorId: dto.vendorId,
        itemName: dto.itemName,
        unitPrice: dto.unitPrice,
        unit: dto.unit,
        minQty: dto.minQty,
        tolerancePct: dto.tolerancePct ?? 0,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        notes: dto.notes,
      },
      include: { vendor: { select: VENDOR_SELECT } },
    });
  }

  async update(id: string, dto: UpdateContractDto) {
    await this.findOne(id);
    return this.prisma.agreedRateContract.update({
      where: { id },
      data: {
        ...(dto.unitPrice !== undefined ? { unitPrice: dto.unitPrice } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.minQty !== undefined ? { minQty: dto.minQty } : {}),
        ...(dto.tolerancePct !== undefined ? { tolerancePct: dto.tolerancePct } : {}),
        ...(dto.validUntil !== undefined ? { validUntil: new Date(dto.validUntil) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status ? { status: dto.status as never } : {}),
      },
      include: { vendor: { select: VENDOR_SELECT } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.agreedRateContract.delete({ where: { id } });
  }

  // Returns active contracts for an item name, for use in procurement bid entry
  async lookupByItem(itemName: string) {
    const now = new Date();
    return this.prisma.agreedRateContract.findMany({
      where: {
        itemName: { contains: itemName, mode: "insensitive" },
        status: "ACTIVE",
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      include: { vendor: { select: VENDOR_SELECT } },
      orderBy: { unitPrice: "asc" },
    });
  }
}
