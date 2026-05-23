import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsISO8601, IsOptional, IsString, ValidateNested } from "class-validator";
import { QuotationStatus, QuotationType } from "@fulfilus/shared";
import { LineItemDto } from "./create-quotation.dto";

export class UpdateQuotationDto {
  @ApiPropertyOptional({ enum: QuotationType })
  @IsOptional()
  @IsEnum(QuotationType)
  type?: QuotationType;

  @ApiPropertyOptional({ enum: QuotationStatus })
  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @ApiPropertyOptional({ type: [LineItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems?: LineItemDto[];
}
