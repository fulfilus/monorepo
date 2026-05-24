import "reflect-metadata";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { JwtGuard } from "../src/auth/guards/jwt.guard";
import { createTestApp, TEST_UUID } from "./helpers/test-app.helper";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

const TEST_SECRET = "test-secret";

const mockAuthService = {
  login: vi.fn(),
  confirmTwoFa: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  setup2Fa: vi.fn(),
  enable2Fa: vi.fn(),
  disable2Fa: vi.fn(),
  changePassword: vi.fn(),
  me: vi.fn(),
};

describe("AuthController (e2e)", () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: TEST_SECRET, signOptions: { expiresIn: "15m" } }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    app = await createTestApp(moduleRef);

    jwtService = moduleRef.get(JwtService);
    const reflector = moduleRef.get(Reflector);
    app.useGlobalGuards(new JwtGuard(jwtService, reflector));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fastify = () => app.getHttpAdapter().getInstance();
  const json = (payload: string) => JSON.parse(payload);

  const validPassword = "SuperSecret!Pass1";

  // --- POST /auth/login ---

  describe("POST /auth/login", () => {
    it("returns 200 with accessToken when login succeeds (no 2FA)", async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: "access-token-abc",
        refreshToken: "refresh-token-xyz",
      });

      const res = await fastify().inject({
        method: "POST",
        url: "/auth/login",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ username: "admin", password: validPassword }),
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ accessToken: "access-token-abc" });
    });

    it("returns 200 with requiresTwoFa when 2FA is required", async () => {
      mockAuthService.login.mockResolvedValue({
        requiresTwoFa: true,
        tempToken: "temp-token-123",
      });

      const res = await fastify().inject({
        method: "POST",
        url: "/auth/login",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ username: "admin", password: validPassword }),
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ requiresTwoFa: true, tempToken: "temp-token-123" });
    });

    it("returns 401 when password is wrong with attempts remaining", async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException("Invalid credentials. 4 attempts remaining."),
      );

      const res = await fastify().inject({
        method: "POST",
        url: "/auth/login",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ username: "admin", password: validPassword }),
      });

      expect(res.statusCode).toBe(401);
      expect(json(res.payload)).toMatchObject({
        message: "Invalid credentials. 4 attempts remaining.",
      });
    });

    it("returns 401 when account is locked", async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException("Account locked. Try again in 15 minutes."),
      );

      const res = await fastify().inject({
        method: "POST",
        url: "/auth/login",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ username: "admin", password: validPassword }),
      });

      expect(res.statusCode).toBe(401);
      expect(json(res.payload)).toMatchObject({
        message: "Account locked. Try again in 15 minutes.",
      });
    });

    it("returns 400 when password is too short (< 15 chars)", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/auth/login",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ username: "admin", password: "short" }),
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when username is missing", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/auth/login",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ password: validPassword }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- POST /auth/2fa/confirm ---

  describe("POST /auth/2fa/confirm", () => {
    it("returns 200 with accessToken on valid 2FA code", async () => {
      mockAuthService.confirmTwoFa.mockResolvedValue({
        accessToken: "access-2fa-token",
        refreshToken: "refresh-2fa-token",
      });

      const res = await fastify().inject({
        method: "POST",
        url: "/auth/2fa/confirm",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ tempToken: "temp-token-123", code: "123456" }),
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ accessToken: "access-2fa-token" });
    });

    it("returns 401 on invalid 2FA code", async () => {
      mockAuthService.confirmTwoFa.mockRejectedValue(
        new UnauthorizedException("Invalid 2FA code"),
      );

      const res = await fastify().inject({
        method: "POST",
        url: "/auth/2fa/confirm",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ tempToken: "temp-token-bad", code: "000000" }),
      });

      expect(res.statusCode).toBe(401);
      expect(json(res.payload)).toMatchObject({ message: "Invalid 2FA code" });
    });
  });

  // --- POST /auth/refresh ---

  describe("POST /auth/refresh", () => {
    it("returns 401 when no refresh cookie is sent", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/auth/refresh",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // --- POST /auth/logout ---

  describe("POST /auth/logout", () => {
    it("returns 204 on logout", async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const validToken = jwtService.sign({ sub: TEST_UUID, username: "admin", role: "ADMIN" });

      const res = await fastify().inject({
        method: "POST",
        url: "/auth/logout",
        headers: { authorization: `Bearer ${validToken}` },
      });

      expect(res.statusCode).toBe(204);
    });
  });

  // --- GET /auth/me ---

  describe("GET /auth/me", () => {
    it("returns 200 with user data when JWT is valid", async () => {
      const mockUser = {
        id: TEST_UUID,
        username: "admin",
        email: "admin@fulfilus.com",
        role: "ADMIN",
        twoFaEnabled: false,
        createdAt: new Date().toISOString(),
      };
      mockAuthService.me.mockResolvedValue(mockUser);

      const validToken = jwtService.sign({ sub: TEST_UUID, username: "admin", role: "ADMIN" });

      const res = await fastify().inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${validToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ id: TEST_UUID, username: "admin" });
    });

    it("returns 401 when no Authorization header is sent", async () => {
      const res = await fastify().inject({
        method: "GET",
        url: "/auth/me",
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
