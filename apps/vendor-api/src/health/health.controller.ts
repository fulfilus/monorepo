import { Controller, Get, HttpCode, HttpStatus, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { Public } from "../auth/guards/jwt.guard";
import { PrismaService } from "../common/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check(@Res() reply: FastifyReply) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return reply.code(200).send({
        status: "ok",
        db: "ok",
        timestamp: new Date().toISOString(),
      });
    } catch {
      return reply.code(503).send({
        status: "error",
        db: "unreachable",
        timestamp: new Date().toISOString(),
      });
    }
  }
}
