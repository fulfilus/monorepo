import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from "./users.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("users")
@UseGuards(RolesGuard)
@Roles("ADMIN")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(":id/role")
  updateRole(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateRole(id, dto.role ?? UserRole.STAFF);
  }

  @Post(":id/unlock")
  unlock(@Param("id") id: string) {
    return this.usersService.unlock(id);
  }

  @Post(":id/reset-password")
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param("id") id: string, @Body() dto: ResetPasswordDto) {
    return this.usersService.resetPassword(id, dto.newPassword);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }
}
