import { IsArray, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { SendMethod, SourcingStatus } from "@prisma/client";

export class CreateSourcingItemDto {
  @IsString() itemName!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsString() sourceName?: string;
  @IsOptional() @IsNumber() @Min(0) markupPct?: number;
  @IsOptional() @IsNumber() @Min(0) sellingPrice?: number;
  @IsOptional() @IsNumber() sortOrder?: number;
}

export class CreateSourcingQuoteDto {
  @IsString() title!: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerAddress?: string;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsEmail() customerEmail?: string;
  @IsOptional() @IsString() customerGst?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() @Min(0) globalMarkupPct?: number;
  @IsOptional() @IsEnum(SourcingStatus) status?: SourcingStatus;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateSourcingItemDto)
  items!: CreateSourcingItemDto[];
}

export class UpdateSourcingQuoteDto extends CreateSourcingQuoteDto {}

export class UpdateSourcingStatusDto {
  @IsEnum(SourcingStatus) status!: SourcingStatus;
  @IsOptional() @IsEnum(SendMethod) method?: SendMethod;
  @IsOptional() @IsString() sentBy?: string;
  @IsOptional() @IsString() sendNotes?: string;
}
