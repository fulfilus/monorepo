import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export enum AwardType { SPLIT = "SPLIT", SINGLE = "SINGLE" }

export class ProcurementItemDto {
  @IsString() itemName!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() targetPrice?: number;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() hsnCode?: string;
  @IsOptional() @IsNumber() gstRate?: number;
  @IsOptional() @IsNumber() sortOrder?: number;
}

export class CreateProcurementDto {
  @IsString() title!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() deadline?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ProcurementItemDto)
  items!: ProcurementItemDto[];
}

export class CreateTemplateDto {
  @IsString() title!: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ProcurementItemDto)
  items!: ProcurementItemDto[];
}

export class UseTemplateDto {
  @IsOptional() @IsString() title?: string;
}

export class AddVendorBidDto {
  @IsString() vendorId!: string;
  @IsOptional() @IsString() quotationId?: string;
}

export class UpdateBidDto {
  @IsOptional() lineItemPrices?: Record<string, number>;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() quotationId?: string;
}

export class AwardDto {
  @IsEnum(AwardType) type!: AwardType;
  @IsOptional() @IsString() singleVendorId?: string;
}

export class DeliveryUpdateDto {
  @IsOptional() @IsDateString() expectedDeliveryAt?: string;
  @IsOptional() @IsDateString() deliveredAt?: string;
  @IsOptional() @IsNumber() receivedQty?: number;
  @IsOptional() @IsString() discrepancyNotes?: string;
}
