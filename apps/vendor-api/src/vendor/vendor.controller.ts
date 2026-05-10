import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { VendorService } from "./vendor.service";

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
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  uploadPhoto(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // In production: upload to object storage, return URL
    const url = `/uploads/${file.originalname}`;
    return this.vendorService.updateShopPhoto(id, url, "system");
  }
}
