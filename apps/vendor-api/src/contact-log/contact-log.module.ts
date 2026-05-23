import { Module } from "@nestjs/common";
import { ContactLogController } from "./contact-log.controller";
import { ContactLogService } from "./contact-log.service";

@Module({
  controllers: [ContactLogController],
  providers: [ContactLogService],
})
export class ContactLogModule {}
