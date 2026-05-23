import { Module } from "@nestjs/common";
import { PdfService } from "./pdf.service";
import { QuotationController } from "./quotation.controller";
import { QuotationExpiryTask } from "./quotation-expiry.task";
import { QuotationService } from "./quotation.service";
import { QuotationTemplateController } from "./quotation-template.controller";
import { QuotationTemplateService } from "./quotation-template.service";

@Module({
  controllers: [QuotationController, QuotationTemplateController],
  providers: [QuotationService, PdfService, QuotationExpiryTask, QuotationTemplateService],
})
export class QuotationModule {}
