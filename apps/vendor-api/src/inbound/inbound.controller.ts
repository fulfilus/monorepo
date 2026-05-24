import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Query, Req, UsePipes, ValidationPipe } from "@nestjs/common";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { FastifyRequest } from "fastify";
import { JwtPayload } from "../auth/guards/jwt.guard";
import { InboundService } from "./inbound.service";

class ReviewDto {
  @IsEnum(["APPROVED", "REJECTED"]) action!: "APPROVED" | "REJECTED";
  @IsOptional() @IsString() reviewNotes?: string;
}

function actor(req: FastifyRequest): string {
  return ((req as FastifyRequest & { user?: JwtPayload }).user?.username) ?? "system";
}

@Controller("inbound")
@UsePipes(new ValidationPipe({ whitelist: true }))
export class InboundController {
  constructor(private readonly inboundService: InboundService) {}

  @Get()
  inbox(
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.inboundService.getPendingInbox(page, limit);
  }

  @Patch(":quoteId/review")
  @HttpCode(HttpStatus.OK)
  review(@Param("quoteId") quoteId: string, @Body() dto: ReviewDto, @Req() req: FastifyRequest) {
    return this.inboundService.reviewQuote(quoteId, dto.action, actor(req), dto.reviewNotes);
  }
}
