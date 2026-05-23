import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export enum ContractStatus { ACTIVE = "ACTIVE", EXPIRED = "EXPIRED", CANCELLED = "CANCELLED" }

export class CreateContractDto {
  @IsString() vendorId!: string;
  @IsString() itemName!: string;
  @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) minQty?: number;
  @IsOptional() @IsNumber() @Min(0) tolerancePct?: number;
  @IsOptional() @IsString() hsnCode?: string;
  @IsOptional() @IsNumber() @Min(0) gstRate?: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateContractDto {
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) minQty?: number;
  @IsOptional() @IsNumber() @Min(0) tolerancePct?: number;
  @IsOptional() @IsString() hsnCode?: string;
  @IsOptional() @IsNumber() @Min(0) gstRate?: number;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(ContractStatus) status?: ContractStatus;
}
