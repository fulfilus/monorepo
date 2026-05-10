import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { PrismaModule } from "./common/prisma.module";
import { AuditMiddleware } from "./common/middleware/audit.middleware";
import { VendorModule } from "./vendor/vendor.module";

@Module({
  imports: [PrismaModule, VendorModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditMiddleware).forRoutes("*");
  }
}
