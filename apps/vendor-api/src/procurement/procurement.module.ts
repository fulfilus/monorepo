import { Module } from "@nestjs/common";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { PoPdfService } from "./po-pdf.service";
import { ProcurementController } from "./procurement.controller";
import { ProcurementDeadlineTask } from "./procurement-deadline.task";
import { ProcurementService } from "./procurement.service";

@Module({
  imports: [WhatsappModule],
  controllers: [ProcurementController],
  providers: [ProcurementService, PoPdfService, ProcurementDeadlineTask],
})
export class ProcurementModule {}
