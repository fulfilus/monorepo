import { forwardRef, Module } from "@nestjs/common";
import { InboundModule } from "../inbound/inbound.module";
import { VendorModule } from "../vendor/vendor.module";
import { WhatsappController } from "./whatsapp.controller";
import { WhatsappService } from "./whatsapp.service";

@Module({
  imports: [VendorModule, forwardRef(() => InboundModule)],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
