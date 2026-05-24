import "reflect-metadata";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { ContractsController } from "../src/contracts/contracts.controller";
import { ContractsService } from "../src/contracts/contracts.service";
import { ContractStatus } from "../src/contracts/contracts.dto";
import { createTestApp, TEST_UUID } from "./helpers/test-app.helper";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

const mockContract = {
  id: TEST_UUID,
  vendorId: "vendor-id",
  itemName: "M8 Bolts",
  unitPrice: 12.5,
  unit: "pcs",
  minQty: 100,
  tolerancePct: 5,
  hsnCode: "7318",
  gstRate: 18,
  status: ContractStatus.ACTIVE,
  validFrom: "2024-01-01",
  validUntil: "2024-12-31",
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockContractsService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  lookupByItem: vi.fn(),
};

describe("ContractsController (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [{ provide: ContractsService, useValue: mockContractsService }],
    }).compile();

    app = await createTestApp(moduleRef);
  });

  afterAll(async () => await app.close());
  beforeEach(() => vi.clearAllMocks());

  const fastify = () => app.getHttpAdapter().getInstance();
  const json = (payload: string) => JSON.parse(payload);

  // --- POST /contracts ---

  describe("POST /contracts", () => {
    it("creates a contract and returns 201", async () => {
      mockContractsService.create.mockResolvedValue(mockContract);

      const res = await fastify().inject({
        method: "POST",
        url: "/contracts",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          vendorId: "vendor-id",
          itemName: "M8 Bolts",
          unitPrice: 12.5,
        }),
      });

      expect(res.statusCode).toBe(201);
      expect(json(res.payload)).toMatchObject({ id: TEST_UUID, itemName: "M8 Bolts" });
    });

    it("returns 400 when vendorId is missing", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/contracts",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ itemName: "M8 Bolts", unitPrice: 12.5 }),
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when unitPrice is missing", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/contracts",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ vendorId: "vendor-id", itemName: "M8 Bolts" }),
      });

      expect(res.statusCode).toBe(400);
    });

    it("creates with optional GST fields", async () => {
      mockContractsService.create.mockResolvedValue(mockContract);

      const res = await fastify().inject({
        method: "POST",
        url: "/contracts",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          vendorId: "vendor-id",
          itemName: "M8 Bolts",
          unitPrice: 12.5,
          hsnCode: "7318",
          gstRate: 18,
          validFrom: "2024-01-01",
          validUntil: "2024-12-31",
        }),
      });

      expect(res.statusCode).toBe(201);
      expect(mockContractsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ hsnCode: "7318", gstRate: 18 }),
      );
    });
  });

  // --- GET /contracts ---

  describe("GET /contracts", () => {
    it("returns all contracts", async () => {
      mockContractsService.findAll.mockResolvedValue([mockContract]);

      const res = await fastify().inject({ method: "GET", url: "/contracts" });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toBeInstanceOf(Array);
    });

    it("passes vendorId and itemName filters to service", async () => {
      mockContractsService.findAll.mockResolvedValue([]);

      await fastify().inject({
        method: "GET",
        url: "/contracts?vendorId=vendor-id&itemName=bolt&status=ACTIVE",
      });

      expect(mockContractsService.findAll).toHaveBeenCalledWith("vendor-id", "bolt", "ACTIVE");
    });
  });

  // --- GET /contracts/lookup ---

  describe("GET /contracts/lookup", () => {
    it("returns contracts for an item name", async () => {
      mockContractsService.lookupByItem.mockResolvedValue([mockContract]);

      const res = await fastify().inject({
        method: "GET",
        url: "/contracts/lookup?itemName=M8+Bolts",
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toBeInstanceOf(Array);
      expect(mockContractsService.lookupByItem).toHaveBeenCalledWith("M8 Bolts");
    });

    it("returns empty when no item name provided", async () => {
      mockContractsService.lookupByItem.mockResolvedValue([]);

      const res = await fastify().inject({ method: "GET", url: "/contracts/lookup" });

      expect(res.statusCode).toBe(200);
    });
  });

  // --- GET /contracts/:id ---

  describe("GET /contracts/:id", () => {
    it("returns a contract by ID", async () => {
      mockContractsService.findOne.mockResolvedValue(mockContract);

      const res = await fastify().inject({ method: "GET", url: `/contracts/${TEST_UUID}` });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ id: TEST_UUID, itemName: "M8 Bolts" });
    });

    it("returns 404 when not found", async () => {
      mockContractsService.findOne.mockRejectedValue(new NotFoundException());

      const res = await fastify().inject({ method: "GET", url: "/contracts/nonexistent" });

      expect(res.statusCode).toBe(404);
    });
  });

  // --- PUT /contracts/:id ---

  describe("PUT /contracts/:id", () => {
    it("updates a contract", async () => {
      mockContractsService.update.mockResolvedValue({ ...mockContract, unitPrice: 15.0 });

      const res = await fastify().inject({
        method: "PUT",
        url: `/contracts/${TEST_UUID}`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ unitPrice: 15.0 }),
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ unitPrice: 15.0 });
    });

    it("can update status to EXPIRED", async () => {
      mockContractsService.update.mockResolvedValue({ ...mockContract, status: ContractStatus.EXPIRED });

      const res = await fastify().inject({
        method: "PUT",
        url: `/contracts/${TEST_UUID}`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ status: ContractStatus.EXPIRED }),
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // --- DELETE /contracts/:id ---

  describe("DELETE /contracts/:id", () => {
    it("deletes and returns 204", async () => {
      mockContractsService.remove.mockResolvedValue(undefined);

      const res = await fastify().inject({ method: "DELETE", url: `/contracts/${TEST_UUID}` });

      expect(res.statusCode).toBe(204);
    });

    it("returns 404 when not found", async () => {
      mockContractsService.remove.mockRejectedValue(new NotFoundException());

      const res = await fastify().inject({ method: "DELETE", url: "/contracts/nonexistent" });

      expect(res.statusCode).toBe(404);
    });
  });
});
