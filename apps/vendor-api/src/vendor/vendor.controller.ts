import "@fastify/multipart";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { FastifyReply, FastifyRequest } from "fastify";
import { createWriteStream } from "node:fs";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { JwtPayload } from "../auth/guards/jwt.guard";
import { EnrichmentService } from "../enrichment/enrichment.service";
import { BulkStatusDto } from "./dto/bulk-status.dto";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { VendorListQueryDto } from "./dto/vendor-query.dto";
import { VendorService } from "./vendor.service";

function actor(req: FastifyRequest): string {
  return ((req as FastifyRequest & { user?: JwtPayload }).user?.username) ?? "system";
}

@ApiTags("vendors")
@Controller("vendors")
export class VendorController {
  constructor(
    private readonly vendorService: VendorService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  @Post("bulk-status")
  bulkStatus(@Body() dto: BulkStatusDto) {
    return this.vendorService.bulkUpdateStatus(dto.ids, dto.contactStatus);
  }

  @Post("merge")
  merge(@Body() body: { sourceId: string; targetId: string }, @Req() req: FastifyRequest) {
    if (!body.sourceId || !body.targetId) throw new BadRequestException("sourceId and targetId are required");
    return this.vendorService.merge(body.sourceId, body.targetId, actor(req));
  }

  @Post()
  create(@Body() dto: CreateVendorDto, @Req() req: FastifyRequest) {
    return this.vendorService.create(dto, actor(req));
  }

  @Get("export")
  async exportCsv(@Query() query: VendorListQueryDto, @Res() reply: FastifyReply) {
    const csv = await this.vendorService.exportCsv(query);
    const filename = `vendors-${new Date().toISOString().slice(0, 10)}.csv`;
    reply.raw.setHeader("Content-Type", "text/csv");
    reply.raw.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    reply.raw.end(csv);
  }

  @Get()
  findAll(@Query() query: VendorListQueryDto) {
    return this.vendorService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.vendorService.findOne(id);
  }

  @Post(":id/re-enrich")
  async reEnrich(@Param("id") id: string, @Req() req: FastifyRequest) {
    const vendor = await this.vendorService.findOne(id);
    const mapsUrl = vendor.placeId
      ? `https://maps.google.com/?place_id=${vendor.placeId}`
      : `https://www.google.com/maps/search/${encodeURIComponent(`${vendor.shopName} ${vendor.location}`)}`;
    const user = actor(req);
    const jobId = await this.enrichmentService.startEnrichmentJob(mapsUrl, async (result) => {
      await this.vendorService.update(id, {
        shopName: result.shopName,
        location: result.location,
        shopDetails: result.shopDetails,
        notes: result.notes,
        categories: result.categories,
      }, user);
      await this.vendorService.linkEnrichmentJob(result.jobId, id);
    });
    await this.vendorService.linkEnrichmentJob(jobId, id);
    return { jobId };
  }

  @Get(":id/audit-logs")
  findAuditLogs(@Param("id") id: string) {
    return this.vendorService.findAuditLogs(id);
  }

  @Get(":id/enrichment-jobs")
  findEnrichmentJobs(@Param("id") id: string) {
    return this.vendorService.findEnrichmentJobs(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateVendorDto, @Req() req: FastifyRequest) {
    return this.vendorService.update(id, dto, actor(req));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.vendorService.remove(id);
  }

  @Post("bulk-import")
  @ApiConsumes("multipart/form-data")
  async bulkImport(@Req() req: FastifyRequest) {
    const part = await req.file();
    if (!part) throw new BadRequestException("No file uploaded");
    const chunks: Buffer[] = [];
    for await (const chunk of part.file) { chunks.push(chunk as Buffer); }
    const csv = Buffer.concat(chunks);
    if (csv.length === 0) throw new BadRequestException("Empty file");
    return this.vendorService.bulkImportCsv(csv, actor(req));
  }

  @Post(":id/photo")
  @ApiConsumes("multipart/form-data")
  async uploadPhoto(@Param("id") id: string, @Req() req: FastifyRequest) {
    const part = await req.file();
    if (!part) throw new BadRequestException("No file uploaded");

    const ext = extname(part.filename) || ".jpg";
    const filename = `${randomUUID()}${ext}`;
    const dest = join(process.cwd(), "uploads", filename);

    await pipeline(part.file, createWriteStream(dest));

    return this.vendorService.updateShopPhoto(id, `/uploads/${filename}`, actor(req));
  }

  // --- Vendor invoices ---

  @Get(":id/invoices")
  listVendorInvoices(@Param("id") id: string) {
    return this.vendorService.listVendorInvoices(id);
  }

  @Post(":id/invoices")
  @HttpCode(HttpStatus.CREATED)
  createVendorInvoice(
    @Param("id") id: string,
    @Body() dto: { invoiceNumber: string; amount: number; dueAt?: string; quotationId?: string; notes?: string },
  ) {
    return this.vendorService.createVendorInvoice(id, dto);
  }

  @Patch(":id/invoices/:invoiceId")
  updateVendorInvoice(
    @Param("id") id: string,
    @Param("invoiceId") invoiceId: string,
    @Body() dto: { paidAt?: string; dueAt?: string; notes?: string },
  ) {
    return this.vendorService.updateVendorInvoice(id, invoiceId, dto);
  }

  @Delete(":id/invoices/:invoiceId")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteVendorInvoice(@Param("id") id: string, @Param("invoiceId") invoiceId: string) {
    return this.vendorService.deleteVendorInvoice(id, invoiceId);
  }
}
