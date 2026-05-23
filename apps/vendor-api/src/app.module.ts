import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./common/prisma.module";
import { AuditMiddleware } from "./common/middleware/audit.middleware";
import { VendorModule } from "./vendor/vendor.module";
import { EnrichmentModule } from "./enrichment/enrichment.module";
import { QuotationModule } from "./quotation/quotation.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DocumentModule } from "./document/document.module";
import { ContactLogModule } from "./contact-log/contact-log.module";
import { ProcurementModule } from "./procurement/procurement.module";
import { SourcingModule } from "./sourcing/sourcing.module";
import { CustomerModule } from "./customer/customer.module";
import { InboundModule } from "./inbound/inbound.module";
import { ContractsModule } from "./contracts/contracts.module";

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, VendorModule, EnrichmentModule, QuotationModule, WhatsappModule, DashboardModule, DocumentModule, ContactLogModule, ProcurementModule, SourcingModule, CustomerModule, InboundModule, ContractsModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditMiddleware).forRoutes("*");
  }
}
