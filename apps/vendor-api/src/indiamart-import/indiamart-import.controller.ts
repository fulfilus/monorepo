import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { IndiamartImportDto } from "./indiamart-import.dto";
import { IndiamartImportService } from "./indiamart-import.service";
import type { FastifyRequest } from "fastify";
import type { JwtPayload } from "../auth/guards/jwt.guard";

function actor(req: FastifyRequest): string {
  return ((req as FastifyRequest & { user?: JwtPayload }).user?.username) ?? "system";
}

@ApiTags("indiamart-import")
@Controller("indiamart-import")
export class IndiamartImportController {
  constructor(private readonly importService: IndiamartImportService) {}

  @Post()
  @Roles("ADMIN")
  run(@Body() dto: IndiamartImportDto, @Req() req: FastifyRequest) {
    const city = dto.city ?? "Hyderabad";
    const maxPages = dto.maxPages ?? 5;
    return this.importService.runImport(dto.query, city, maxPages, actor(req));
  }
}
