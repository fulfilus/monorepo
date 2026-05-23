import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString } from "class-validator";
import { QuotationType } from "@fulfilus/shared";

export class SuggestItemsDto {
  @ApiProperty()
  @IsString()
  vendorId: string;

  @ApiProperty({ enum: QuotationType })
  @IsEnum(QuotationType)
  quotationType: QuotationType;
}
