import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma.module";
import { EnrichmentController } from "./enrichment.controller";
import { EnrichmentService } from "./enrichment.service";
import { IndiamartService } from "./indiamart.service";
import { JustdialService } from "./justdial.service";
import { OcrService } from "./ocr.service";

@Module({
  imports: [PrismaModule],
  controllers: [EnrichmentController],
  providers: [EnrichmentService, IndiamartService, JustdialService, OcrService],
  exports: [EnrichmentService, IndiamartService, JustdialService, OcrService],
})
export class EnrichmentModule {}
