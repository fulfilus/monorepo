import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ContactStatus } from "@fulfilus/shared";
import { PrismaService } from "../common/prisma.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import type { VendorListQueryDto } from "./dto/vendor-query.dto";
import { parse } from "csv-parse/sync";

@Injectable()
export class VendorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVendorDto, createdBy: string) {
    const duplicate = await this.prisma.vendor.findFirst({
      where: {
        OR: [
          { whatsappNumber: dto.whatsappNumber },
          { shopName: { equals: dto.shopName, mode: "insensitive" } },
        ],
      },
      select: { id: true, shopName: true, whatsappNumber: true },
    });
    if (duplicate) {
      throw new ConflictException({
        message: "A vendor with this name or WhatsApp number already exists.",
        existingId: duplicate.id,
        existingName: duplicate.shopName,
      });
    }

    const { enrichmentJobId, ...vendorData } = dto;
    const vendor = await this.prisma.vendor.create({
      data: {
        shopName: vendorData.shopName,
        shopDetails: vendorData.shopDetails,
        location: vendorData.location,
        whatsappNumber: vendorData.whatsappNumber,
        gstNumber: vendorData.gstNumber,
        contactStatus: vendorData.contactStatus,
        notes: vendorData.notes,
        categories: vendorData.categories,
        ...(vendorData.payment && { payment: { create: vendorData.payment } }),
        ...(vendorData.bankAccount && { bankAccount: { create: vendorData.bankAccount } }),
        ...(vendorData.delivery && { delivery: { create: vendorData.delivery } }),
        auditLogs: {
          create: { action: "CREATE", changedBy: createdBy },
        },
      },
      include: { payment: true, bankAccount: true, delivery: true },
    });

    if (enrichmentJobId) {
      await this.prisma.enrichmentJob.update({
        where: { id: enrichmentJobId },
        data: { vendorId: vendor.id },
      }).catch(() => {});
    }

    return vendor;
  }

  async findAll(query: VendorListQueryDto = {}) {
    const { page = 1, limit = 20, search, status, category } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.VendorWhereInput = {};
    if (search) {
      where.shopName = { contains: search, mode: "insensitive" };
    }
    if (status) {
      where.contactStatus = status;
    }
    if (category) {
      where.categories = { has: category };
    }

    const [vendors, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        include: {
          payment: true,
          bankAccount: true,
          delivery: true,
          enrichmentJobs: {
            where: { status: "COMPLETED" },
            orderBy: { completedAt: "desc" },
            take: 1,
            select: { confidenceScore: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.vendor.count({ where }),
    ]);
    const data = vendors.map(({ enrichmentJobs, ...v }) => ({
      ...v,
      confidenceScore: enrichmentJobs[0]?.confidenceScore ?? null,
    }));
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: { payment: true, bankAccount: true, delivery: true, documents: true },
    });
    if (!vendor) throw new NotFoundException(`Vendor ${id} not found`);
    return vendor;
  }

  async update(id: string, dto: UpdateVendorDto, updatedBy: string) {
    await this.findOne(id);
    const { payment, bankAccount, delivery, categories, ...scalar } = dto;
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
        ...(delivery && {
          delivery: { upsert: { create: delivery, update: delivery } },
        }),
        auditLogs: {
          create: { action: "UPDATE", changedBy: updatedBy, diff: dto as object },
        },
      },
      include: { payment: true, bankAccount: true, delivery: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.vendor.delete({ where: { id } });
  }

  async exportCsv(query: VendorListQueryDto): Promise<string> {
    const where: Prisma.VendorWhereInput = {};
    if (query.search) where.shopName = { contains: query.search, mode: "insensitive" };
    if (query.status) where.contactStatus = query.status;
    if (query.category) where.categories = { has: query.category };

    const vendors = await this.prisma.vendor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        shopName: true, location: true, whatsappNumber: true, gstNumber: true,
        contactStatus: true, categories: true, createdAt: true,
      },
    });

    const escape = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Shop Name", "Location", "WhatsApp", "GST", "Status", "Categories", "Added"].join(",");
    const rows = vendors.map(v =>
      [
        escape(v.shopName),
        escape(v.location),
        escape(v.whatsappNumber),
        escape(v.gstNumber),
        escape(v.contactStatus),
        escape(v.categories.join("; ")),
        escape(v.createdAt.toISOString()),
      ].join(","),
    );
    return [header, ...rows].join("\n");
  }

  async linkEnrichmentJob(jobId: string, vendorId: string) {
    if (!jobId) return;
    await this.prisma.enrichmentJob.update({
      where: { id: jobId },
      data: { vendorId },
    }).catch(() => {});
  }

  async bulkUpdateStatus(ids: string[], contactStatus: ContactStatus) {
    return this.prisma.vendor.updateMany({
      where: { id: { in: ids } },
      data: { contactStatus },
    });
  }

  async findAuditLogs(id: string) {
    await this.findOne(id);
    return this.prisma.auditLog.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, action: true, changedBy: true, diff: true, createdAt: true },
    });
  }

  async findEnrichmentJobs(id: string) {
    await this.findOne(id);
    return this.prisma.enrichmentJob.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        source: true,
        status: true,
        confidenceScore: true,
        modelId: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
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

  async merge(sourceId: string, targetId: string, mergedBy: string) {
    if (sourceId === targetId) throw new Error("Source and target vendor must be different");
    const [source, target] = await Promise.all([this.findOne(sourceId), this.findOne(targetId)]);

    // Re-parent all relations from source → target in a single transaction
    await this.prisma.$transaction([
      this.prisma.quotation.updateMany({ where: { vendorId: sourceId }, data: { vendorId: targetId } }),
      this.prisma.contactLog.updateMany({ where: { vendorId: sourceId }, data: { vendorId: targetId } }),
      this.prisma.document.updateMany({ where: { vendorId: sourceId }, data: { vendorId: targetId } }),
      this.prisma.enrichmentJob.updateMany({ where: { vendorId: sourceId }, data: { vendorId: targetId } }),
      this.prisma.vendorBid.updateMany({ where: { vendorId: sourceId }, data: { vendorId: targetId } }),
      this.prisma.agreedRateContract.updateMany({ where: { vendorId: sourceId }, data: { vendorId: targetId } }),
      this.prisma.auditLog.updateMany({ where: { vendorId: sourceId }, data: { vendorId: targetId } }),
      // Log the merge on the surviving vendor
      this.prisma.auditLog.create({
        data: {
          vendorId: targetId,
          action: "MERGE",
          changedBy: mergedBy,
          diff: { mergedFromId: sourceId, mergedFromName: source.shopName },
        },
      }),
      // Delete source vendor (cascades VendorPayment, BankAccount, VendorDelivery)
      this.prisma.vendor.delete({ where: { id: sourceId } }),
    ]);

    return { survivingId: targetId, survivingName: target.shopName, deletedId: sourceId, deletedName: source.shopName };
  }

  async bulkImportCsv(csv: Buffer, importedBy: string): Promise<{ imported: number; skipped: number; errors: { row: number; reason: string }[] }> {
    const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    const errors: { row: number; reason: string }[] = [];
    let imported = 0;
    let skipped = 0;

    const VALID_CATEGORIES = new Set([
      "RAW_MATERIALS", "ELECTRICAL_ELECTRONICS", "MECHANICAL_TOOLS", "FASTENERS_HARDWARE",
      "CHEMICALS_LUBRICANTS", "SAFETY_PPE", "HYDRAULICS_PNEUMATICS", "PLASTICS_RUBBER",
      "PACKAGING_MATERIALS", "CONSTRUCTION_MATERIALS", "BEARINGS_TRANSMISSION",
      "INSTRUMENTATION", "GENERAL_INDUSTRIAL",
    ]);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header
      const shopName = row["shopName"]?.trim();
      const location = row["location"]?.trim();
      const whatsappNumber = row["whatsappNumber"]?.trim();

      if (!shopName || !location || !whatsappNumber) {
        errors.push({ row: rowNum, reason: "Missing required field: shopName, location, or whatsappNumber" });
        skipped++;
        continue;
      }

      const rawCategories = (row["categories"] ?? "").split(";").map(c => c.trim().toUpperCase()).filter(Boolean);
      const categories = rawCategories.filter(c => VALID_CATEGORIES.has(c));

      try {
        const duplicate = await this.prisma.vendor.findFirst({
          where: { OR: [{ whatsappNumber }, { shopName: { equals: shopName, mode: "insensitive" } }] },
          select: { id: true },
        });
        if (duplicate) {
          errors.push({ row: rowNum, reason: `Duplicate: vendor with this name or number already exists` });
          skipped++;
          continue;
        }

        await this.prisma.vendor.create({
          data: {
            shopName,
            location,
            whatsappNumber,
            gstNumber: row["gstNumber"]?.trim() || undefined,
            shopDetails: row["shopDetails"]?.trim() || undefined,
            notes: row["notes"]?.trim() || undefined,
            categories: categories as never[],
            contactStatus: "NOT_CONTACTED",
            auditLogs: { create: { action: "BULK_IMPORT", changedBy: importedBy } },
          },
        });
        imported++;
      } catch {
        errors.push({ row: rowNum, reason: "Database error during insert" });
        skipped++;
      }
    }

    return { imported, skipped, errors };
  }
}
