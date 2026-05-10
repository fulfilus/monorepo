import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ContactStatus, PaymentType, VendorCategory } from "@fulfilus/shared";

export class PaymentDto {
  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiProperty()
  @IsString()
  value: string;
}

export class BankAccountDto {
  @ApiProperty()
  @IsString()
  accountNumber: string;

  @ApiProperty()
  @IsString()
  ifscCode: string;

  @ApiProperty()
  @IsString()
  accountHolder: string;

  @ApiProperty()
  @IsString()
  bankName: string;
}

export class CreateVendorDto {
  @ApiProperty()
  @IsString()
  shopName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shopDetails?: string;

  @ApiProperty()
  @IsString()
  location: string;

  @ApiProperty({ description: "WhatsApp number with country code" })
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, { message: "Invalid WhatsApp number" })
  whatsappNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiProperty({ enum: ContactStatus })
  @IsEnum(ContactStatus)
  contactStatus: ContactStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ enum: VendorCategory, isArray: true })
  @IsArray()
  @IsEnum(VendorCategory, { each: true })
  categories: VendorCategory[];

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDto)
  payment?: PaymentDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => BankAccountDto)
  bankAccount?: BankAccountDto;
}
