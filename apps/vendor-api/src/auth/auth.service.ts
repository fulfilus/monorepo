import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "node:crypto";
import { OTP } from "otplib";
import * as QRCode from "qrcode";
import { PrismaService } from "../common/prisma.service";
import type { JwtPayload } from "./guards/jwt.guard";

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TEMP_2FA_TOKEN_TTL_MS = 5 * 60 * 1000;
const APP_NAME = "Fulfilus";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const otp = new OTP({ strategy: "totp" });

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Account locked. Try again in ${remaining} minute${remaining === 1 ? "" : "s"}.`);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lockout = attempts >= MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: lockout ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });

      if (lockout) {
        this.logger.warn(`[auth:lockout] username="${username}"`);
        throw new UnauthorizedException("Too many failed attempts. Account locked for 15 minutes.");
      }

      const remaining = MAX_FAILED_ATTEMPTS - attempts;
      this.logger.warn(`[auth:login:fail] username="${username}" remainingAttempts=${remaining}`);
      throw new UnauthorizedException(`Invalid credentials. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
    }

    // Successful login — reset lockout state
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    this.logger.log(`[auth:login] username="${username}" ip=unknown`);

    if (user.twoFaEnabled) {
      const tempToken = crypto.randomBytes(32).toString("hex");
      await this.prisma.refreshToken.create({
        data: {
          token: `2fa:${tempToken}`,
          userId: user.id,
          expiresAt: new Date(Date.now() + TEMP_2FA_TOKEN_TTL_MS),
        },
      });
      return { requiresTwoFa: true as const, tempToken };
    }

    return this.issueTokens(user.id, user.username, user.role);
  }

  async confirmTwoFa(tempToken: string, code: string) {
    const stored = await this.prisma.refreshToken.findFirst({
      where: { token: `2fa:${tempToken}`, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException("Invalid or expired 2FA session");

    if (!stored.user.twoFaSecret) throw new UnauthorizedException("2FA not configured");

    const result = await otp.verify({ token: code, secret: stored.user.twoFaSecret });
    if (!result.valid) throw new UnauthorizedException("Invalid 2FA code");

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.issueTokens(stored.user.id, stored.user.username, stored.user.role);
  }

  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        expiresAt: { gt: new Date() },
        NOT: { token: { startsWith: "2fa:" } },
      },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException("Invalid or expired refresh token");

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.issueTokens(stored.user.id, stored.user.username, stored.user.role);
  }

  async logout(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findFirst({
      where: { token: refreshToken },
      select: { userId: true, user: { select: { username: true } } },
    });
    await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    this.logger.log(`[auth:logout] username="${stored?.user?.username ?? "unknown"}" ip=unknown`);
  }

  async setup2Fa(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = otp.generateSecret();
    const otpAuthUrl = otp.generateURI({ issuer: APP_NAME, label: user.email, secret });
    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaSecret: secret },
    });

    return { secret, qrCode };
  }

  async enable2Fa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFaSecret) throw new BadRequestException("Call /auth/2fa/setup first");

    const result = await otp.verify({ token: code, secret: user.twoFaSecret });
    if (!result.valid) throw new UnauthorizedException("Invalid code — try again");

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaEnabled: true },
    });
    return { enabled: true };
  }

  async disable2Fa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFaEnabled) throw new BadRequestException("2FA is not enabled");

    const result = await otp.verify({ token: code, secret: user.twoFaSecret! });
    if (!result.valid) throw new UnauthorizedException("Invalid code");

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaEnabled: false, twoFaSecret: null },
    });
    return { disabled: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Current password is incorrect");

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { changed: true };
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true, email: true, role: true, twoFaEnabled: true, createdAt: true },
    });
  }

  private async issueTokens(userId: string, username: string, role: string) {
    const payload: JwtPayload = { sub: userId, username, role };
    const accessToken = this.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });

    const rawRefreshToken = crypto.randomBytes(40).toString("hex");
    await this.prisma.refreshToken.create({
      data: {
        token: rawRefreshToken,
        userId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
