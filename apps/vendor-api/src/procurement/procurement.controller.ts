import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseIntPipe, Post, Put, Query, Res, UsePipes, ValidationPipe } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { AddVendorBidDto, AwardDto, CreateProcurementDto, CreateTemplateDto, UpdateBidDto, UseTemplateDto } from "./procurement.dto";
import { PoPdfService } from "./po-pdf.service";
import { ProcurementService } from "./procurement.service";

@ApiTags("procurement")
@Controller("procurement")
@UsePipes(new ValidationPipe({ whitelist: true }))
export class ProcurementController {
  constructor(
    private readonly procurementService: ProcurementService,
    private readonly poPdfService: PoPdfService,
  ) {}

  // --- Vendor scorecard (declared before :id routes to prevent route shadowing) ---

  @Get("vendor-scorecard")
  getVendorScorecard() {
    return this.procurementService.getVendorScorecard();
  }

  // --- Price history (declared before :id routes to prevent route shadowing) ---

  @Get("price-history")
  getPriceHistory(@Query("itemName") itemName: string) {
    if (!itemName?.trim()) throw new BadRequestException("itemName query param is required");
    return this.procurementService.getPriceHistory(itemName.trim());
  }

  // --- Templates (declared before :id routes to prevent route shadowing) ---

  @Get("templates")
  listTemplates() {
    return this.procurementService.listTemplates();
  }

  @Post("templates")
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.procurementService.createTemplate(dto);
  }

  @Delete("templates/:templateId")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTemplate(@Param("templateId") templateId: string) {
    return this.procurementService.deleteTemplate(templateId);
  }

  @Post("templates/:templateId/use")
  useTemplate(@Param("templateId") templateId: string, @Body() dto: UseTemplateDto) {
    return this.procurementService.useTemplate(templateId, dto);
  }

  // --- Rounds ---

  @Post()
  create(@Body() dto: CreateProcurementDto) {
    return this.procurementService.create(dto);
  }

  @Get()
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.procurementService.findAll(page, limit);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.procurementService.findOne(id);
  }

  @Post(":id/save-as-template")
  saveAsTemplate(@Param("id") id: string) {
    return this.procurementService.saveRoundAsTemplate(id);
  }

  @Post(":id/vendors")
  addVendor(@Param("id") id: string, @Body() dto: AddVendorBidDto) {
    return this.procurementService.addVendor(id, dto);
  }

  @Put(":id/vendors/:bidId")
  updateBid(@Param("id") id: string, @Param("bidId") bidId: string, @Body() dto: UpdateBidDto) {
    return this.procurementService.updateBid(id, bidId, dto);
  }

  @Delete(":id/vendors/:bidId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVendor(@Param("id") id: string, @Param("bidId") bidId: string) {
    return this.procurementService.removeVendor(id, bidId);
  }

  @Get(":id/comparison")
  getComparison(@Param("id") id: string) {
    return this.procurementService.getComparison(id);
  }

  @Post(":id/blast")
  @HttpCode(HttpStatus.OK)
  blastRfq(@Param("id") id: string) {
    return this.procurementService.blastRfq(id);
  }

  @Post(":id/award")
  award(@Param("id") id: string, @Body() dto: AwardDto) {
    return this.procurementService.award(id, dto);
  }

  @Get(":id/po-pdf/:quotationId")
  async downloadPo(
    @Param("id") id: string,
    @Param("quotationId") quotationId: string,
    @Res() reply: FastifyReply,
  ) {
    const quotation = await this.procurementService.getPoQuotation(id, quotationId);
    if (!quotation) throw new NotFoundException("PO quotation not found");
    const buffer = await this.poPdfService.generate(quotation);
    void reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="PO-${quotation.referenceNumber}.pdf"`)
      .send(buffer);
  }
}
