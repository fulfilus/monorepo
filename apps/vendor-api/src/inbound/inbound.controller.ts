import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Query, UsePipes, ValidationPipe } from "@nestjs/common";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { InboundService } from "./inbound.service";

class ReviewDto {
  @IsEnum(["APPROVED", "REJECTED"]) action!: "APPROVED" | "REJECTED";
  @IsString() reviewedBy!: string;
  @IsOptional() @IsString() reviewNotes?: string;
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
  review(@Param("quoteId") quoteId: string, @Body() dto: ReviewDto) {
    return this.inboundService.reviewQuote(quoteId, dto.action, dto.reviewedBy, dto.reviewNotes);
  }
}
