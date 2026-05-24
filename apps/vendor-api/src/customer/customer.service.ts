import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CreateCustomerDto, UpdateCustomerDto } from "./customer.dto";

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? { OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { companyName: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ] }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, skip, take: limit, orderBy: { name: "asc" } }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        quotes: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, referenceNumber: true, title: true, status: true, createdAt: true },
        },
      },
    });
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return c;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customer.delete({ where: { id } });
  }

  async bulkImportCsv(csvText: string): Promise<{ created: number; skipped: number; errors: string[] }> {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return { created: 0, skipped: 0, errors: [] };

    // Detect header: name is always required
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes("name") || firstLine.includes("phone") || firstLine.includes("email");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const cols = dataLines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      const [name, companyName, phone, email, address, gstNumber] = cols;
      if (!name) { errors.push(`Row ${i + 2}: name is required`); skipped++; continue; }

      try {
        const existing = phone
          ? await this.prisma.customer.findFirst({ where: { phone: { contains: phone.slice(-10) } } })
          : null;
        if (existing) { skipped++; continue; }

        await this.prisma.customer.create({
          data: {
            name,
            companyName: companyName || undefined,
            phone: phone || undefined,
            email: email || undefined,
            address: address || undefined,
            gstNumber: gstNumber || undefined,
          },
        });
        created++;
      } catch (err) {
        errors.push(`Row ${i + 2}: ${String(err)}`);
        skipped++;
      }
    }

    return { created, skipped, errors };
  }
}
