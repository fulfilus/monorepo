import "@fastify/multipart";
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query, Req, UsePipes, ValidationPipe } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { CreateCustomerDto, UpdateCustomerDto } from "./customer.dto";
import { CustomerService } from "./customer.service";

@Controller("customers")
@UsePipes(new ValidationPipe({ whitelist: true }))
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customerService.create(dto);
  }

  @Post("bulk-import")
  async bulkImport(@Req() req: FastifyRequest) {
    const part = await req.file();
    if (!part) throw new BadRequestException("No file uploaded");
    const chunks: Buffer[] = [];
    for await (const chunk of part.file) {
      chunks.push(chunk as Buffer);
    }
    const csvText = Buffer.concat(chunks).toString("utf8");
    if (!csvText.trim()) throw new BadRequestException("Empty CSV file");
    return this.customerService.bulkImportCsv(csvText);
  }

  @Get()
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 50,
    @Query("search") search?: string,
  ) {
    return this.customerService.findAll(page, limit, search);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.customerService.findOne(id);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.customerService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.customerService.remove(id);
  }
}
