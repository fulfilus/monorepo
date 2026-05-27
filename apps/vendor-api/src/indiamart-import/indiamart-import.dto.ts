import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class IndiamartImportDto {
  @ApiProperty({ description: "Search query, e.g. 'grocery', 'food supplier', 'vegetable wholesale'" })
  @IsString()
  query: string;

  @ApiPropertyOptional({ default: "Hyderabad", description: "City to filter suppliers by" })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ default: 5, description: "Max pages to fetch (20 results per page). Max 50." })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  maxPages?: number;

  @ApiPropertyOptional({
    default: false,
    description: "If true, fetches each supplier's IndiaMart profile via Claude to extract products, categories, and pricing. Slow — one Claude API call per vendor.",
  })
  @IsOptional()
  @IsBoolean()
  enrich?: boolean;
}

export interface IndiaMartCompany {
  name: string;
  address: string;
  phone?: string;
  glid?: string;
  categories: string[];
  supplierUrl?: string;
  gstNumber?: string;
}

export interface IndiamartImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: { name: string; reason: string }[];
  total: number;
}
