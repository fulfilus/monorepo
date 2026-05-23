import { IsArray, IsEnum, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { ContactStatus } from "@fulfilus/shared";

export class BulkStatusDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ enum: ContactStatus })
  @IsEnum(ContactStatus)
  contactStatus: ContactStatus;
}
