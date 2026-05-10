import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { VendorService } from "./vendor.service";

class PhotoUrlDto {
  url: string;
}

@ApiTags("vendors")
@Controller("vendors")
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  create(@Body() dto: CreateVendorDto) {
    return this.vendorService.create(dto, "system");
  }

  @Get()
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findAll(@Query("page") page = 1, @Query("limit") limit = 20) {
    return this.vendorService.findAll(Number(page), Number(limit));
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.vendorService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorService.update(id, dto, "system");
  }

  @Post(":id/photo")
  @ApiBody({ type: PhotoUrlDto })
  uploadPhoto(@Param("id") id: string, @Body() body: PhotoUrlDto) {
    return this.vendorService.updateShopPhoto(id, body.url, "system");
  }
}
