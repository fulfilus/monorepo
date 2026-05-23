import { Module } from "@nestjs/common";
import { EnrichmentModule } from "../enrichment/enrichment.module";
import { VendorController } from "./vendor.controller";
import { VendorService } from "./vendor.service";

@Module({
  imports: [EnrichmentModule],
  controllers: [VendorController],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}
