import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RouteConfig } from "@nestjs/platform-fastify";
import "@fastify/cookie";
import { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import { ChangePasswordDto, LoginDto, TwoFaConfirmDto, TwoFaVerifyDto } from "./dto/auth.dto";
import { JwtPayload, Public } from "./guards/jwt.guard";

// 10 attempts per minute per IP on credential endpoints
const AUTH_RATE_LIMIT = { rateLimit: { max: 10, timeWindow: 60_000 } };

const REFRESH_COOKIE = "rfsh";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env["NODE_ENV"] === "production",
  sameSite: "strict" as const,
  path: "/auth",
  maxAge: 7 * 24 * 60 * 60, // seconds
};

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @RouteConfig(AUTH_RATE_LIMIT)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.authService.login(dto.username, dto.password);
    if ("requiresTwoFa" in result) return result;

    reply.setCookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    return { accessToken: result.accessToken };
  }

  @Public()
  @Post("2fa/confirm")
  @HttpCode(HttpStatus.OK)
  @RouteConfig(AUTH_RATE_LIMIT)
  async confirmTwoFa(@Body() dto: TwoFaConfirmDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.authService.confirmTwoFa(dto.tempToken, dto.code);
    reply.setCookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    return { accessToken: result.accessToken };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    if (!token) return reply.code(401).send({ message: "No refresh token" });

    const result = await this.authService.refresh(token);
    reply.setCookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    return { accessToken: result.accessToken };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    if (token) await this.authService.logout(token);
    reply.clearCookie(REFRESH_COOKIE, { path: "/auth" });
  }

  @Get("me")
  me(@Req() req: FastifyRequest) {
    const user = (req as FastifyRequest & { user: JwtPayload }).user;
    return this.authService.me(user.sub);
  }

  @Post("2fa/setup")
  @HttpCode(HttpStatus.OK)
  setup2Fa(@Req() req: FastifyRequest) {
    const user = (req as FastifyRequest & { user: JwtPayload }).user;
    return this.authService.setup2Fa(user.sub);
  }

  @Post("2fa/enable")
  @HttpCode(HttpStatus.OK)
  enable2Fa(@Req() req: FastifyRequest, @Body() dto: TwoFaVerifyDto) {
    const user = (req as FastifyRequest & { user: JwtPayload }).user;
    return this.authService.enable2Fa(user.sub, dto.code);
  }

  @Post("2fa/disable")
  @HttpCode(HttpStatus.OK)
  disable2Fa(@Req() req: FastifyRequest, @Body() dto: TwoFaVerifyDto) {
    const user = (req as FastifyRequest & { user: JwtPayload }).user;
    return this.authService.disable2Fa(user.sub, dto.code);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  changePassword(@Req() req: FastifyRequest, @Body() dto: ChangePasswordDto) {
    const user = (req as FastifyRequest & { user: JwtPayload }).user;
    return this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }
}
