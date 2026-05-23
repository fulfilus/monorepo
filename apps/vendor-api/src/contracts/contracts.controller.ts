import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UsePipes, ValidationPipe } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateContractDto, UpdateContractDto } from "./contracts.dto";
import { ContractsService } from "./contracts.service";

@ApiTags("contracts")
@Controller("contracts")
@UsePipes(new ValidationPipe({ whitelist: true }))
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(
    @Query("vendorId") vendorId?: string,
    @Query("itemName") itemName?: string,
    @Query("status") status?: string,
  ) {
    return this.contractsService.findAll(vendorId, itemName, status);
  }

  @Get("lookup")
  lookup(@Query("itemName") itemName: string) {
    return this.contractsService.lookupByItem(itemName ?? "");
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.contractsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateContractDto) {
    return this.contractsService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.contractsService.remove(id);
  }
}
