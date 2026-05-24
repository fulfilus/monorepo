import "reflect-metadata";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { DashboardController } from "../src/dashboard/dashboard.controller";
import { DashboardService } from "../src/dashboard/dashboard.service";
import { createTestApp } from "./helpers/test-app.helper";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

const mockDashboardService = {
  getSummary: vi.fn(),
  getSpendAnalytics: vi.fn(),
};

describe("DashboardController (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: mockDashboardService }],
    }).compile();

    app = await createTestApp(moduleRef);
  });

  afterAll(async () => await app.close());
  beforeEach(() => vi.clearAllMocks());

  const fastify = () => app.getHttpAdapter().getInstance();
  const json = (payload: string) => JSON.parse(payload);

  // --- GET /dashboard ---

  describe("GET /dashboard", () => {
    it("returns dashboard summary", async () => {
      mockDashboardService.getSummary.mockResolvedValue({
        totalVendors: 42,
        contactedVendors: 30,
        activeQuotations: 15,
        pendingEnrichments: 3,
        recentActivity: [],
      });

      const res = await fastify().inject({ method: "GET", url: "/dashboard" });

      expect(res.statusCode).toBe(200);
      const body = json(res.payload);
      expect(body).toMatchObject({ totalVendors: 42 });
      expect(mockDashboardService.getSummary).toHaveBeenCalledOnce();
    });

    it("returns an empty summary gracefully", async () => {
      mockDashboardService.getSummary.mockResolvedValue({});

      const res = await fastify().inject({ method: "GET", url: "/dashboard" });

      expect(res.statusCode).toBe(200);
    });
  });

  // --- GET /dashboard/spend ---

  describe("GET /dashboard/spend", () => {
    it("returns spend analytics", async () => {
      mockDashboardService.getSpendAnalytics.mockResolvedValue({
        totalSpend: 500000,
        spendByCategory: [
          { category: "FASTENERS_HARDWARE", amount: 120000 },
          { category: "RAW_MATERIALS", amount: 380000 },
        ],
        spendByVendor: [
          { vendorName: "Test Supplies Co.", amount: 200000 },
        ],
        monthlyTrend: [],
      });

      const res = await fastify().inject({ method: "GET", url: "/dashboard/spend" });

      expect(res.statusCode).toBe(200);
      const body = json(res.payload);
      expect(body).toMatchObject({ totalSpend: 500000 });
      expect(body.spendByCategory).toBeInstanceOf(Array);
      expect(mockDashboardService.getSpendAnalytics).toHaveBeenCalledOnce();
    });

    it("returns zero spend for empty data", async () => {
      mockDashboardService.getSpendAnalytics.mockResolvedValue({
        totalSpend: 0,
        spendByCategory: [],
        spendByVendor: [],
        monthlyTrend: [],
      });

      const res = await fastify().inject({ method: "GET", url: "/dashboard/spend" });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ totalSpend: 0 });
    });
  });
});
