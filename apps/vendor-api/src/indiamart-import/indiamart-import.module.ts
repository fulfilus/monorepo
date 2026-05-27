import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma.module";
import { EnrichmentModule } from "../enrichment/enrichment.module";
import { IndiamartImportController } from "./indiamart-import.controller";
import { IndiamartImportService } from "./indiamart-import.service";

@Module({
  imports: [PrismaModule, EnrichmentModule],
  controllers: [IndiamartImportController],
  providers: [IndiamartImportService],
})
export class IndiamartImportModule {}
