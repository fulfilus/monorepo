import { forwardRef, Module } from "@nestjs/common";
import { InboundController } from "./inbound.controller";
import { InboundService } from "./inbound.service";
import { ValidationService } from "./validation.service";
import { SourcingModule } from "../sourcing/sourcing.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";

@Module({
  imports: [forwardRef(() => SourcingModule), forwardRef(() => WhatsappModule)],
  controllers: [InboundController],
  providers: [InboundService, ValidationService],
  exports: [InboundService],
})
export class InboundModule {}
