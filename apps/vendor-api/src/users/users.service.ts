import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { CreateUserDto } from "./users.dto";

const BCRYPT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  twoFaEnabled: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: "asc" },
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email }] },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException("A user with this username or email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        role: dto.role ?? UserRole.STAFF,
      },
      select: USER_SELECT,
    });
  }

  async updateRole(id: string, role: UserRole) {
    await this.findOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: USER_SELECT,
    });
  }

  async unlock(id: string) {
    await this.findOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
      select: USER_SELECT,
    });
  }

  async resetPassword(id: string, newPassword: string) {
    await this.findOrThrow(id);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
    ]);
    return { reset: true };
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    await this.prisma.user.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
