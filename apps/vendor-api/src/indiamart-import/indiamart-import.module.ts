import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma.module";
import { IndiamartImportController } from "./indiamart-import.controller";
import { IndiamartImportService } from "./indiamart-import.service";

@Module({
  imports: [PrismaModule],
  controllers: [IndiamartImportController],
  providers: [IndiamartImportService],
})
export class IndiamartImportModule {}
