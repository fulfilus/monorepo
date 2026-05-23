import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export enum ContactLogType {
  CALL = "CALL",
  WHATSAPP = "WHATSAPP",
  VISIT = "VISIT",
  EMAIL = "EMAIL",
}

export class CreateContactLogDto {
  @IsEnum(ContactLogType)
  type!: ContactLogType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsString()
  contactedBy!: string;
}
