import "reflect-metadata";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { SourcingController } from "../src/sourcing/sourcing.controller";
import { SourcingService } from "../src/sourcing/sourcing.service";
import { createTestApp, TEST_UUID } from "./helpers/test-app.helper";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

const mockQuote = {
  id: TEST_UUID,
  title: "Q1 Sourcing Quote",
  status: "DRAFT",
  customerId: null,
  customerName: "Acme Corp",
  customerAddress: null,
  customerPhone: null,
  customerEmail: null,
  customerGst: null,
  validUntil: null,
  notes: null,
  globalMarkupPct: 15,
  items: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockSourcingService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  updateStatus: vi.fn(),
  duplicate: vi.fn(),
  getRevisions: vi.fn(),
  lookup: vi.fn(),
  generatePdf: vi.fn(),
};

describe("SourcingController (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SourcingController],
      providers: [{ provide: SourcingService, useValue: mockSourcingService }],
    }).compile();

    app = await createTestApp(moduleRef);
  });

  afterAll(async () => await app.close());
  beforeEach(() => vi.clearAllMocks());

  const fastify = () => app.getHttpAdapter().getInstance();
  const json = (payload: string) => JSON.parse(payload);

  // --- POST /sourcing ---

  describe("POST /sourcing", () => {
    it("creates a sourcing quote and returns 201", async () => {
      mockSourcingService.create.mockResolvedValue(mockQuote);

      const res = await fastify().inject({
        method: "POST",
        url: "/sourcing",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          title: "Q1 Sourcing Quote",
          customerName: "Acme Corp",
          items: [{ itemName: "M8 Bolts", quantity: 500, costPrice: 10.0 }],
        }),
      });

      expect(res.statusCode).toBe(201);
      expect(json(res.payload)).toMatchObject({ id: TEST_UUID, title: "Q1 Sourcing Quote" });
    });

    it("returns 400 when title is missing", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/sourcing",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          items: [{ itemName: "M8 Bolts" }],
        }),
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when items array is missing", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/sourcing",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ title: "Quote Without Items" }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- GET /sourcing ---

  describe("GET /sourcing", () => {
    it("returns paginated sourcing quotes", async () => {
      mockSourcingService.findAll.mockResolvedValue({ data: [mockQuote], total: 1, page: 1, limit: 20 });

      const res = await fastify().inject({ method: "GET", url: "/sourcing" });

      expect(res.statusCode).toBe(200);
      const body = json(res.payload);
      expect(body).toMatchObject({ total: 1 });
    });

    it("passes pagination params", async () => {
      mockSourcingService.findAll.mockResolvedValue({ data: [], total: 0, page: 3, limit: 5 });

      await fastify().inject({ method: "GET", url: "/sourcing?page=3&limit=5" });

      expect(mockSourcingService.findAll).toHaveBeenCalledWith(3, 5);
    });
  });

  // --- GET /sourcing/:id ---

  describe("GET /sourcing/:id", () => {
    it("returns a sourcing quote by ID", async () => {
      mockSourcingService.findOne.mockResolvedValue(mockQuote);

      const res = await fastify().inject({ method: "GET", url: `/sourcing/${TEST_UUID}` });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ id: TEST_UUID });
    });

    it("returns 404 when not found", async () => {
      mockSourcingService.findOne.mockRejectedValue(new NotFoundException());

      const res = await fastify().inject({ method: "GET", url: "/sourcing/nonexistent" });

      expect(res.statusCode).toBe(404);
    });
  });

  // --- PUT /sourcing/:id ---

  describe("PUT /sourcing/:id", () => {
    it("updates a sourcing quote", async () => {
      mockSourcingService.update.mockResolvedValue({ ...mockQuote, title: "Updated Quote" });

      const res = await fastify().inject({
        method: "PUT",
        url: `/sourcing/${TEST_UUID}`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          title: "Updated Quote",
          items: [{ itemName: "M8 Bolts", quantity: 500 }],
        }),
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ title: "Updated Quote" });
    });
  });

  // --- DELETE /sourcing/:id ---

  describe("DELETE /sourcing/:id", () => {
    it("deletes and returns 204", async () => {
      mockSourcingService.remove.mockResolvedValue(undefined);

      const res = await fastify().inject({ method: "DELETE", url: `/sourcing/${TEST_UUID}` });

      expect(res.statusCode).toBe(204);
    });

    it("returns 404 when not found", async () => {
      mockSourcingService.remove.mockRejectedValue(new NotFoundException());

      const res = await fastify().inject({ method: "DELETE", url: "/sourcing/nonexistent" });

      expect(res.statusCode).toBe(404);
    });
  });

  // --- PATCH /sourcing/:id/status ---

  describe("PATCH /sourcing/:id/status", () => {
    it("updates sourcing quote status", async () => {
      mockSourcingService.updateStatus.mockResolvedValue({ ...mockQuote, status: "SENT" });

      const res = await fastify().inject({
        method: "PATCH",
        url: `/sourcing/${TEST_UUID}/status`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ status: "SENT" }),
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ status: "SENT" });
    });

    it("returns 400 for invalid status value", async () => {
      const res = await fastify().inject({
        method: "PATCH",
        url: `/sourcing/${TEST_UUID}/status`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ status: "INVALID_STATUS" }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- POST /sourcing/:id/duplicate ---

  describe("POST /sourcing/:id/duplicate", () => {
    it("duplicates a sourcing quote and returns 201", async () => {
      const duplicated = { ...mockQuote, id: "new-id", title: "Copy of Q1 Sourcing Quote" };
      mockSourcingService.duplicate.mockResolvedValue(duplicated);

      const res = await fastify().inject({
        method: "POST",
        url: `/sourcing/${TEST_UUID}/duplicate`,
      });

      expect(res.statusCode).toBe(201);
      expect(json(res.payload)).toMatchObject({ id: "new-id" });
    });
  });

  // --- GET /sourcing/:id/revisions ---

  describe("GET /sourcing/:id/revisions", () => {
    it("returns revision history", async () => {
      mockSourcingService.getRevisions.mockResolvedValue([
        { version: 1, changedAt: new Date().toISOString(), changedBy: "admin" },
      ]);

      const res = await fastify().inject({
        method: "GET",
        url: `/sourcing/${TEST_UUID}/revisions`,
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toBeInstanceOf(Array);
    });
  });

  // --- POST /sourcing/lookup ---

  describe("POST /sourcing/lookup", () => {
    it("returns price suggestions for item names", async () => {
      mockSourcingService.lookup.mockResolvedValue({
        "M8 Bolts": [{ vendorName: "Test Co.", unitPrice: 12.5, source: "quotation" }],
      });

      const res = await fastify().inject({
        method: "POST",
        url: "/sourcing/lookup",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ itemNames: ["M8 Bolts"] }),
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ "M8 Bolts": expect.any(Array) });
    });
  });

  // --- GET /sourcing/:id/pdf/:type ---

  describe("GET /sourcing/:id/pdf/:type", () => {
    it("returns customer PDF", async () => {
      mockSourcingService.generatePdf.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));

      const res = await fastify().inject({
        method: "GET",
        url: `/sourcing/${TEST_UUID}/pdf/customer`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
    });

    it("returns internal cost sheet PDF", async () => {
      mockSourcingService.generatePdf.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));

      const res = await fastify().inject({
        method: "GET",
        url: `/sourcing/${TEST_UUID}/pdf/internal`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(mockSourcingService.generatePdf).toHaveBeenCalledWith(TEST_UUID, "internal");
    });
  });
});
