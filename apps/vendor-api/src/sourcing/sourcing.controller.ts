import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put, Query, Res, UsePipes, ValidationPipe } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { CreateSourcingQuoteDto, UpdateSourcingQuoteDto, UpdateSourcingStatusDto } from "./sourcing.dto";
import { SourcingService } from "./sourcing.service";

@Controller("sourcing")
@UsePipes(new ValidationPipe({ whitelist: true }))
export class SourcingController {
  constructor(private readonly sourcingService: SourcingService) {}

  @Post()
  create(@Body() dto: CreateSourcingQuoteDto) {
    return this.sourcingService.create(dto);
  }

  @Get()
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.sourcingService.findAll(page, limit);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.sourcingService.findOne(id);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSourcingQuoteDto) {
    return this.sourcingService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.sourcingService.remove(id);
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateSourcingStatusDto) {
    return this.sourcingService.updateStatus(id, dto);
  }

  @Post(":id/duplicate")
  @HttpCode(HttpStatus.CREATED)
  duplicate(@Param("id") id: string) {
    return this.sourcingService.duplicate(id);
  }

  @Get(":id/revisions")
  getRevisions(@Param("id") id: string) {
    return this.sourcingService.getRevisions(id);
  }

  @Post("lookup")
  @HttpCode(HttpStatus.OK)
  lookup(@Body() body: { itemNames: string[] }) {
    return this.sourcingService.lookup(body.itemNames);
  }

  @Get(":id/pdf/:type")
  async downloadPdf(
    @Param("id") id: string,
    @Param("type") type: "customer" | "internal",
    @Res() res: FastifyReply,
  ) {
    const buf = await this.sourcingService.generatePdf(id, type);
    const filename = type === "customer" ? `quote-${id}.pdf` : `cost-sheet-${id}.pdf`;
    res.header("Content-Type", "application/pdf");
    res.header("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buf);
  }

  @Post(":id/invoice")
  @HttpCode(HttpStatus.CREATED)
  createInvoice(
    @Param("id") id: string,
    @Body() body: { dueAt?: string },
  ) {
    return this.sourcingService.createInvoice(id, body.dueAt);
  }

  @Get(":id/invoice")
  getInvoice(@Param("id") id: string) {
    return this.sourcingService.getInvoice(id);
  }

  @Get(":id/invoice/pdf")
  async downloadInvoicePdf(@Param("id") id: string, @Res() res: FastifyReply) {
    const inv = await this.sourcingService.getInvoice(id);
    const buf = await this.sourcingService.generateInvoicePdf(id);
    res.header("Content-Type", "application/pdf");
    res.header("Content-Disposition", `attachment; filename="INV-${inv.invoiceNumber}.pdf"`);
    res.send(buf);
  }
}
