import "reflect-metadata";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { AwardType } from "../src/procurement/procurement.dto";
import { ProcurementController } from "../src/procurement/procurement.controller";
import { ProcurementService } from "../src/procurement/procurement.service";
import { PoPdfService } from "../src/procurement/po-pdf.service";
import { createTestApp, TEST_UUID } from "./helpers/test-app.helper";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

const mockRound = {
  id: TEST_UUID,
  title: "Q1 Fasteners Round",
  status: "OPEN",
  notes: null,
  items: [],
  vendors: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockTemplate = {
  id: "template-id",
  title: "Standard Fasteners Template",
  items: [{ itemName: "M8 Bolts", quantity: 500 }],
  createdAt: new Date().toISOString(),
};

const mockProcurementService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
  addVendor: vi.fn(),
  updateBid: vi.fn(),
  removeVendor: vi.fn(),
  blastRfq: vi.fn(),
  getComparison: vi.fn(),
  award: vi.fn(),
  getVendorScorecard: vi.fn(),
  getPriceHistory: vi.fn(),
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  saveRoundAsTemplate: vi.fn(),
  useTemplate: vi.fn(),
  barcodeLookup: vi.fn(),
  getPoQuotation: vi.fn(),
};

const mockPoPdfService = {
  generate: vi.fn(),
};

describe("ProcurementController (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [
        { provide: ProcurementService, useValue: mockProcurementService },
        { provide: PoPdfService, useValue: mockPoPdfService },
      ],
    }).compile();

    app = await createTestApp(moduleRef);
  });

  afterAll(async () => await app.close());
  beforeEach(() => vi.clearAllMocks());

  const fastify = () => app.getHttpAdapter().getInstance();
  const json = (payload: string) => JSON.parse(payload);

  // --- GET /procurement/vendor-scorecard ---

  describe("GET /procurement/vendor-scorecard", () => {
    it("returns vendor scorecard", async () => {
      mockProcurementService.getVendorScorecard.mockResolvedValue([
        { vendorId: "v1", vendorName: "Test Co.", totalRounds: 5, wonRounds: 3, winRate: 0.6 },
      ]);

      const res = await fastify().inject({ method: "GET", url: "/procurement/vendor-scorecard" });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toBeInstanceOf(Array);
    });
  });

  // --- GET /procurement/price-history ---

  describe("GET /procurement/price-history", () => {
    it("returns price history for an item", async () => {
      mockProcurementService.getPriceHistory.mockResolvedValue([
        { date: "2024-01-01", price: 12.5, vendorName: "Test Co." },
      ]);

      const res = await fastify().inject({
        method: "GET",
        url: "/procurement/price-history?itemName=M8+Bolts",
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toBeInstanceOf(Array);
      expect(mockProcurementService.getPriceHistory).toHaveBeenCalledWith("M8 Bolts");
    });

    it("returns 400 when itemName is missing", async () => {
      const res = await fastify().inject({
        method: "GET",
        url: "/procurement/price-history",
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- GET /procurement/templates ---

  describe("GET /procurement/templates", () => {
    it("returns all templates", async () => {
      mockProcurementService.listTemplates.mockResolvedValue([mockTemplate]);

      const res = await fastify().inject({ method: "GET", url: "/procurement/templates" });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toBeInstanceOf(Array);
    });
  });

  // --- POST /procurement/templates ---

  describe("POST /procurement/templates", () => {
    it("creates a template and returns 201", async () => {
      mockProcurementService.createTemplate.mockResolvedValue(mockTemplate);

      const res = await fastify().inject({
        method: "POST",
        url: "/procurement/templates",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          title: "Standard Fasteners Template",
          items: [{ itemName: "M8 Bolts", quantity: 500 }],
        }),
      });

      expect(res.statusCode).toBe(201);
      expect(json(res.payload)).toMatchObject({ title: "Standard Fasteners Template" });
    });

    it("returns 400 when items array is missing", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/procurement/templates",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ title: "Template Without Items" }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- DELETE /procurement/templates/:templateId ---

  describe("DELETE /procurement/templates/:templateId", () => {
    it("deletes a template and returns 204", async () => {
      mockProcurementService.deleteTemplate.mockResolvedValue(undefined);

      const res = await fastify().inject({
        method: "DELETE",
        url: "/procurement/templates/template-id",
      });

      expect(res.statusCode).toBe(204);
    });
  });

  // --- POST /procurement/templates/:templateId/use ---

  describe("POST /procurement/templates/:templateId/use", () => {
    it("creates a round from a template", async () => {
      mockProcurementService.useTemplate.mockResolvedValue(mockRound);

      const res = await fastify().inject({
        method: "POST",
        url: "/procurement/templates/template-id/use",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ title: "Round from Template" }),
      });

      expect(res.statusCode).toBe(201);
      expect(mockProcurementService.useTemplate).toHaveBeenCalledWith(
        "template-id",
        expect.objectContaining({ title: "Round from Template" }),
      );
    });
  });

  // --- GET /procurement/barcode-lookup ---

  describe("GET /procurement/barcode-lookup", () => {
    it("returns item info for a barcode", async () => {
      mockProcurementService.barcodeLookup.mockResolvedValue({
        barcode: "12345678",
        itemName: "M8 Bolt DIN 933",
        unit: "pcs",
      });

      const res = await fastify().inject({
        method: "GET",
        url: "/procurement/barcode-lookup?barcode=12345678",
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ barcode: "12345678" });
      expect(mockProcurementService.barcodeLookup).toHaveBeenCalledWith("12345678");
    });

    it("returns 400 when barcode param is missing", async () => {
      const res = await fastify().inject({
        method: "GET",
        url: "/procurement/barcode-lookup",
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- POST /procurement ---

  describe("POST /procurement", () => {
    it("creates a procurement round and returns 201", async () => {
      mockProcurementService.create.mockResolvedValue(mockRound);

      const res = await fastify().inject({
        method: "POST",
        url: "/procurement",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          title: "Q1 Fasteners Round",
          items: [{ itemName: "M8 Bolts", quantity: 500, unit: "pcs" }],
        }),
      });

      expect(res.statusCode).toBe(201);
      expect(json(res.payload)).toMatchObject({ id: TEST_UUID });
    });

    it("returns 400 when title is missing", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/procurement",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ items: [{ itemName: "M8 Bolts" }] }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- GET /procurement ---

  describe("GET /procurement", () => {
    it("returns paginated procurement rounds", async () => {
      mockProcurementService.findAll.mockResolvedValue({ data: [mockRound], total: 1 });

      const res = await fastify().inject({ method: "GET", url: "/procurement" });

      expect(res.statusCode).toBe(200);
    });

    it("passes pagination params", async () => {
      mockProcurementService.findAll.mockResolvedValue({ data: [], total: 0 });

      await fastify().inject({ method: "GET", url: "/procurement?page=2&limit=10" });

      expect(mockProcurementService.findAll).toHaveBeenCalledWith(2, 10);
    });
  });

  // --- GET /procurement/:id ---

  describe("GET /procurement/:id", () => {
    it("returns a procurement round", async () => {
      mockProcurementService.findOne.mockResolvedValue(mockRound);

      const res = await fastify().inject({ method: "GET", url: `/procurement/${TEST_UUID}` });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ id: TEST_UUID });
    });

    it("returns 404 when not found", async () => {
      mockProcurementService.findOne.mockRejectedValue(new NotFoundException());

      const res = await fastify().inject({ method: "GET", url: "/procurement/nonexistent" });

      expect(res.statusCode).toBe(404);
    });
  });

  // --- POST /procurement/:id/vendors ---

  describe("POST /procurement/:id/vendors", () => {
    it("adds a vendor bid to a round", async () => {
      mockProcurementService.addVendor.mockResolvedValue({ bidId: "bid-id", vendorId: "vendor-id" });

      const res = await fastify().inject({
        method: "POST",
        url: `/procurement/${TEST_UUID}/vendors`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ vendorId: "vendor-id" }),
      });

      expect(res.statusCode).toBe(201);
      expect(mockProcurementService.addVendor).toHaveBeenCalledWith(
        TEST_UUID,
        expect.objectContaining({ vendorId: "vendor-id" }),
      );
    });
  });

  // --- PUT /procurement/:id/vendors/:bidId ---

  describe("PUT /procurement/:id/vendors/:bidId", () => {
    it("updates a vendor bid", async () => {
      mockProcurementService.updateBid.mockResolvedValue({ bidId: "bid-id", status: "SUBMITTED" });

      const res = await fastify().inject({
        method: "PUT",
        url: `/procurement/${TEST_UUID}/vendors/bid-id`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ lineItemPrices: { "item-1": 12.5 }, status: "SUBMITTED" }),
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // --- DELETE /procurement/:id/vendors/:bidId ---

  describe("DELETE /procurement/:id/vendors/:bidId", () => {
    it("removes a vendor from a round and returns 204", async () => {
      mockProcurementService.removeVendor.mockResolvedValue(undefined);

      const res = await fastify().inject({
        method: "DELETE",
        url: `/procurement/${TEST_UUID}/vendors/bid-id`,
      });

      expect(res.statusCode).toBe(204);
    });
  });

  // --- GET /procurement/:id/comparison ---

  describe("GET /procurement/:id/comparison", () => {
    it("returns bid comparison for a round", async () => {
      mockProcurementService.getComparison.mockResolvedValue({
        items: [],
        vendors: [],
        matrix: {},
      });

      const res = await fastify().inject({
        method: "GET",
        url: `/procurement/${TEST_UUID}/comparison`,
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // --- POST /procurement/:id/blast ---

  describe("POST /procurement/:id/blast", () => {
    it("blasts RFQ and returns 200", async () => {
      mockProcurementService.blastRfq.mockResolvedValue({
        sent: ["vendor-id"],
        skipped: [],
        failed: [],
      });

      const res = await fastify().inject({
        method: "POST",
        url: `/procurement/${TEST_UUID}/blast`,
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ sent: expect.any(Array) });
    });
  });

  // --- POST /procurement/:id/award ---

  describe("POST /procurement/:id/award", () => {
    it("awards to a single vendor", async () => {
      mockProcurementService.award.mockResolvedValue({ awardedTo: ["vendor-id"] });

      const res = await fastify().inject({
        method: "POST",
        url: `/procurement/${TEST_UUID}/award`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ type: AwardType.SINGLE, singleVendorId: "vendor-id" }),
      });

      expect(res.statusCode).toBe(201);
    });

    it("returns 400 for invalid award type", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: `/procurement/${TEST_UUID}/award`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ type: "INVALID" }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- POST /procurement/:id/save-as-template ---

  describe("POST /procurement/:id/save-as-template", () => {
    it("saves round as template", async () => {
      mockProcurementService.saveRoundAsTemplate.mockResolvedValue(mockTemplate);

      const res = await fastify().inject({
        method: "POST",
        url: `/procurement/${TEST_UUID}/save-as-template`,
      });

      expect(res.statusCode).toBe(201);
    });
  });
});
