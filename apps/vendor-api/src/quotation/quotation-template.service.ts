import { Injectable, NotFoundException } from "@nestjs/common";
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { QuotationType } from "@fulfilus/shared";
import { PrismaService } from "../common/prisma.service";

export class TemplateLineItemDto {
  @IsString() itemName!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() unitPrice?: number;
  @IsOptional() @IsNumber() sortOrder?: number;
}

export class CreateTemplateDto {
  @IsString() title!: string;
  @IsEnum(QuotationType) type!: QuotationType;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => TemplateLineItemDto) lineItems!: TemplateLineItemDto[];
}

@Injectable()
export class QuotationTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTemplateDto) {
    return this.prisma.quotationTemplate.create({
      data: {
        title: dto.title,
        type: dto.type,
        notes: dto.notes,
        lineItems: dto.lineItems as object[],
      },
    });
  }

  async findAll() {
    return this.prisma.quotationTemplate.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, type: true, notes: true, lineItems: true, createdAt: true },
    });
  }

  async findOne(id: string) {
    const t = await this.prisma.quotationTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException(`Template ${id} not found`);
    return t;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.quotationTemplate.delete({ where: { id } });
  }
}
