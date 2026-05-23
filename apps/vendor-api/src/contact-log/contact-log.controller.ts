import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateContactLogDto } from "./contact-log.dto";
import { ContactLogService } from "./contact-log.service";

@ApiTags("contact-logs")
@Controller("vendors/:vendorId/contact-logs")
@UsePipes(new ValidationPipe({ whitelist: true }))
export class ContactLogController {
  constructor(private readonly contactLogService: ContactLogService) {}

  @Post()
  create(@Param("vendorId") vendorId: string, @Body() dto: CreateContactLogDto) {
    return this.contactLogService.create(vendorId, dto);
  }

  @Get()
  findAll(@Param("vendorId") vendorId: string) {
    return this.contactLogService.findAll(vendorId);
  }

  @Delete(":logId")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("vendorId") vendorId: string, @Param("logId") logId: string) {
    return this.contactLogService.remove(vendorId, logId);
  }
}
