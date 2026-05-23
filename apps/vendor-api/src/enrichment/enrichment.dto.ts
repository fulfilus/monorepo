import { IsNotEmpty, IsString } from "class-validator";
export { EnrichmentResult } from "@fulfilus/shared";

export class EnrichFromMapsUrlDto {
  @IsString()
  @IsNotEmpty()
  mapsUrl!: string;
}

export class EnrichFromIndiamartUrlDto {
  @IsString()
  @IsNotEmpty()
  url!: string;
}

export class EnrichFromJustdialUrlDto {
  @IsString()
  @IsNotEmpty()
  url!: string;
}

export interface PlaceData {
  name: string;
  formattedAddress: string;
  types: string[];
  phoneNumber?: string;
  website?: string;
  rating?: number;
  businessStatus?: string;
  placeId: string;
}
