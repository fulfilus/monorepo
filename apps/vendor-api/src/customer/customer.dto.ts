import { IsEmail, IsOptional, IsString } from "class-validator";

export class CreateCustomerDto {
  @IsString() name!: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() gstNumber?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateCustomerDto extends CreateCustomerDto {}
