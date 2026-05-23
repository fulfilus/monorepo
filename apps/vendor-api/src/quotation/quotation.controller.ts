import "@fastify/multipart";
import {
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
  Res,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { CreateQuotationDto } from "./dto/create-quotation.dto";
import { UpdateQuotationDto } from "./dto/update-quotation.dto";
import { SuggestItemsDto } from "./dto/suggest-items.dto";
import { QuotationService } from "./quotation.service";

@ApiTags("quotations")
@Controller("quotations")
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Post()
  create(@Body() dto: CreateQuotationDto) {
    return this.quotationService.create(dto);
  }

  @Get("accounting-export")
  async accountingExport(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Res() reply?: FastifyReply,
  ) {
    const csv = await this.quotationService.generateAccountingExport(from, to);
    void reply!
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", `attachment; filename="accounting-export-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  }

  @Get("vendor/:vendorId")
  findAll(
    @Param("vendorId") vendorId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("status") status?: string,
  ) {
    return this.quotationService.findAll(vendorId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.quotationService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateQuotationDto) {
    return this.quotationService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.quotationService.remove(id);
  }

  @Post("suggest-items")
  suggestItems(@Body() dto: SuggestItemsDto) {
    return this.quotationService.suggestItems(dto.vendorId, dto.quotationType);
  }

  @Get(":id/pdf")
  async downloadPdf(@Param("id") id: string, @Res() reply: FastifyReply) {
    const { buffer, filename } = await this.quotationService.generatePdf(id);
    const stream = Readable.from(buffer);

    reply.raw.setHeader("Content-Type", "application/pdf");
    reply.raw.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    reply.raw.setHeader("Content-Length", buffer.length);

    await pipeline(stream, reply.raw);
  }
}
