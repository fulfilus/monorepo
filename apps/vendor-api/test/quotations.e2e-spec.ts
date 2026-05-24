import "reflect-metadata";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { QuotationType, QuotationStatus } from "@fulfilus/shared";
import { QuotationController } from "../src/quotation/quotation.controller";
import { QuotationService } from "../src/quotation/quotation.service";
import { createTestApp, TEST_UUID } from "./helpers/test-app.helper";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

const mockQuotation = {
  id: TEST_UUID,
  vendorId: "vendor-id",
  type: QuotationType.RFQ,
  title: "Q1 Steel RFQ",
  status: QuotationStatus.DRAFT,
  notes: null,
  validUntil: null,
  referenceNumber: "QT-001",
  lineItems: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockQuotationService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  suggestItems: vi.fn(),
  generateAccountingExport: vi.fn(),
  generatePdf: vi.fn(),
};

describe("QuotationController (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QuotationController],
      providers: [{ provide: QuotationService, useValue: mockQuotationService }],
    }).compile();

    app = await createTestApp(moduleRef);
  });

  afterAll(async () => await app.close());

  beforeEach(() => vi.clearAllMocks());

  const fastify = () => app.getHttpAdapter().getInstance();
  const json = (payload: string) => JSON.parse(payload);

  // --- POST /quotations ---

  describe("POST /quotations", () => {
    it("creates a quotation and returns 201", async () => {
      mockQuotationService.create.mockResolvedValue(mockQuotation);

      const res = await fastify().inject({
        method: "POST",
        url: "/quotations",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          vendorId: "vendor-id",
          type: QuotationType.RFQ,
          title: "Q1 Steel RFQ",
        }),
      });

      expect(res.statusCode).toBe(201);
      expect(json(res.payload)).toMatchObject({ id: TEST_UUID, type: QuotationType.RFQ });
    });

    it("returns 400 when vendorId is missing", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/quotations",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ type: QuotationType.RFQ, title: "Test" }),
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when type is invalid enum value", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/quotations",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ vendorId: "v1", type: "INVALID", title: "Test" }),
      });

      expect(res.statusCode).toBe(400);
    });

    it("creates a quotation with line items", async () => {
      mockQuotationService.create.mockResolvedValue({
        ...mockQuotation,
        lineItems: [{ itemName: "M8 Bolts", quantity: 500, hsnCode: "7318", gstRate: 18 }],
      });

      const res = await fastify().inject({
        method: "POST",
        url: "/quotations",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          vendorId: "vendor-id",
          type: QuotationType.RFQ,
          title: "Bolts RFQ",
          lineItems: [{ itemName: "M8 Bolts", quantity: 500, hsnCode: "7318", gstRate: 18 }],
        }),
      });

      expect(res.statusCode).toBe(201);
    });
  });

  // --- GET /quotations/hsn-lookup ---

  describe("GET /quotations/hsn-lookup", () => {
    it("returns GST rate for a known HSN code", async () => {
      const res = await fastify().inject({
        method: "GET",
        url: "/quotations/hsn-lookup?code=7318",
      });

      expect(res.statusCode).toBe(200);
      const body = json(res.payload);
      expect(body).toMatchObject({ code: "7318", gstRate: 18 });
      expect(body.slabs).toEqual(expect.any(Array));
    });

    it("returns null gstRate for unknown HSN code", async () => {
      const res = await fastify().inject({
        method: "GET",
        url: "/quotations/hsn-lookup?code=9999",
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ code: "9999", gstRate: null });
    });

    it("returns 400 when code query param is missing", async () => {
      const res = await fastify().inject({
        method: "GET",
        url: "/quotations/hsn-lookup",
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- GET /quotations/accounting-export ---

  describe("GET /quotations/accounting-export", () => {
    it("streams CSV with correct headers", async () => {
      mockQuotationService.generateAccountingExport.mockResolvedValue(
        "referenceNumber,vendorName,total\nQT-001,Test Vendor,5000",
      );

      const res = await fastify().inject({
        method: "GET",
        url: "/quotations/accounting-export?from=2024-01-01&to=2024-12-31",
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("accounting-export");
    });

    it("works without date range params", async () => {
      mockQuotationService.generateAccountingExport.mockResolvedValue("referenceNumber\n");

      const res = await fastify().inject({
        method: "GET",
        url: "/quotations/accounting-export",
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // --- GET /quotations/vendor/:vendorId ---

  describe("GET /quotations/vendor/:vendorId", () => {
    it("returns quotations for a vendor", async () => {
      mockQuotationService.findAll.mockResolvedValue({
        data: [mockQuotation],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await fastify().inject({
        method: "GET",
        url: "/quotations/vendor/vendor-id",
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ data: expect.any(Array), total: 1 });
    });

    it("passes pagination params to service", async () => {
      mockQuotationService.findAll.mockResolvedValue({ data: [], total: 0, page: 2, limit: 5 });

      await fastify().inject({
        method: "GET",
        url: "/quotations/vendor/vendor-id?page=2&limit=5&status=DRAFT",
      });

      expect(mockQuotationService.findAll).toHaveBeenCalledWith(
        "vendor-id",
        expect.objectContaining({ page: 2, limit: 5, status: "DRAFT" }),
      );
    });
  });

  // --- GET /quotations/:id ---

  describe("GET /quotations/:id", () => {
    it("returns a quotation by ID", async () => {
      mockQuotationService.findOne.mockResolvedValue(mockQuotation);

      const res = await fastify().inject({ method: "GET", url: `/quotations/${TEST_UUID}` });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ id: TEST_UUID });
    });

    it("returns 404 when not found", async () => {
      mockQuotationService.findOne.mockRejectedValue(new NotFoundException());

      const res = await fastify().inject({ method: "GET", url: "/quotations/nonexistent" });

      expect(res.statusCode).toBe(404);
    });
  });

  // --- PATCH /quotations/:id ---

  describe("PATCH /quotations/:id", () => {
    it("updates and returns the quotation", async () => {
      mockQuotationService.update.mockResolvedValue({ ...mockQuotation, title: "Updated Title" });

      const res = await fastify().inject({
        method: "PATCH",
        url: `/quotations/${TEST_UUID}`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ title: "Updated Title" }),
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ title: "Updated Title" });
    });
  });

  // --- DELETE /quotations/:id ---

  describe("DELETE /quotations/:id", () => {
    it("deletes and returns 204", async () => {
      mockQuotationService.remove.mockResolvedValue(undefined);

      const res = await fastify().inject({ method: "DELETE", url: `/quotations/${TEST_UUID}` });

      expect(res.statusCode).toBe(204);
    });
  });

  // --- POST /quotations/suggest-items ---

  describe("POST /quotations/suggest-items", () => {
    it("returns AI-suggested items", async () => {
      mockQuotationService.suggestItems.mockResolvedValue([
        { itemName: "M8 Bolts", estimatedQuantity: 500, unit: "pcs" },
      ]);

      const res = await fastify().inject({
        method: "POST",
        url: "/quotations/suggest-items",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ vendorId: "vendor-id", quotationType: QuotationType.RFQ }),
      });

      expect(res.statusCode).toBe(201);
      expect(json(res.payload)).toBeInstanceOf(Array);
    });
  });

  // --- GET /quotations/:id/pdf ---

  describe("GET /quotations/:id/pdf", () => {
    it("returns PDF with correct content-type", async () => {
      const fakeBuffer = Buffer.from("%PDF-1.4 fake content");
      mockQuotationService.generatePdf.mockResolvedValue({
        buffer: fakeBuffer,
        filename: `quotation-${TEST_UUID}.pdf`,
      });

      const res = await fastify().inject({ method: "GET", url: `/quotations/${TEST_UUID}/pdf` });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toContain(".pdf");
    });
  });
});
