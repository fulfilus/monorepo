import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateTemplateDto, QuotationTemplateService } from "./quotation-template.service";

@ApiTags("quotation-templates")
@Controller("quotation-templates")
@UsePipes(new ValidationPipe({ whitelist: true }))
export class QuotationTemplateController {
  constructor(private readonly templateService: QuotationTemplateService) {}

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Get()
  findAll() {
    return this.templateService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.templateService.findOne(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.templateService.remove(id);
  }
}
