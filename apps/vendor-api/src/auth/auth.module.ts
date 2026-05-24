import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../common/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtGuard } from "./guards/jwt.guard";
import { TokenCleanupTask } from "./token-cleanup.task";

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env["JWT_SECRET"] ?? "changeme-dev-secret",
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenCleanupTask,
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
