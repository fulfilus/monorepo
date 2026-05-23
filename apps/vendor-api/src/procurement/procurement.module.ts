import { Module } from "@nestjs/common";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { PoPdfService } from "./po-pdf.service";
import { ProcurementController } from "./procurement.controller";
import { ProcurementService } from "./procurement.service";

@Module({
  imports: [WhatsappModule],
  controllers: [ProcurementController],
  providers: [ProcurementService, PoPdfService],
})
export class ProcurementModule {}
