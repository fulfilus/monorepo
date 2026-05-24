import { forwardRef, Module } from "@nestjs/common";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { SourcingController } from "./sourcing.controller";
import { SourcingQuoteExpiryTask } from "./sourcing-quote-expiry.task";
import { SourcingService } from "./sourcing.service";

@Module({
  imports: [forwardRef(() => WhatsappModule)],
  controllers: [SourcingController],
  providers: [SourcingService, SourcingQuoteExpiryTask],
  exports: [SourcingService],
})
export class SourcingModule {}
