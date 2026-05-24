import "reflect-metadata";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { ContactStatus, VendorCategory } from "@fulfilus/shared";
import { VendorController } from "../src/vendor/vendor.controller";
import { VendorService } from "../src/vendor/vendor.service";
import { EnrichmentService } from "../src/enrichment/enrichment.service";
import { createTestApp, TEST_UUID } from "./helpers/test-app.helper";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

const mockVendor = {
  id: TEST_UUID,
  shopName: "Test Supplies Co.",
  location: "Mumbai, MH",
  whatsappNumber: "+919876543210",
  contactStatus: ContactStatus.NOT_CONTACTED,
  categories: [VendorCategory.FASTENERS_HARDWARE],
  gstNumber: null,
  shopDetails: null,
  notes: null,
  placeId: null,
  shopPhotoUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  payment: null,
  bankAccount: null,
  delivery: null,
};

const mockVendorService = {
  create: vi.fn(),
  bulkUpdateStatus: vi.fn(),
  merge: vi.fn(),
  findAll: vi.fn(),
  exportCsv: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  findAuditLogs: vi.fn(),
  findEnrichmentJobs: vi.fn(),
  updateShopPhoto: vi.fn(),
  bulkImportCsv: vi.fn(),
  linkEnrichmentJob: vi.fn(),
};

const mockEnrichmentService = {
  enrichFromMapsUrl: vi.fn(),
  startEnrichmentJob: vi.fn(),
};

describe("VendorController (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VendorController],
      providers: [
        { provide: VendorService, useValue: mockVendorService },
        { provide: EnrichmentService, useValue: mockEnrichmentService },
      ],
    }).compile();

    app = await createTestApp(moduleRef);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fastify = () => app.getHttpAdapter().getInstance();
  const json = (payload: string) => JSON.parse(payload);

  // --- POST /vendors ---

  describe("POST /vendors", () => {
    it("creates a vendor and returns 201", async () => {
      mockVendorService.create.mockResolvedValue(mockVendor);

      const res = await fastify().inject({
        method: "POST",
        url: "/vendors",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          shopName: "Test Supplies Co.",
          location: "Mumbai, MH",
          whatsappNumber: "+919876543210",
          contactStatus: ContactStatus.NOT_CONTACTED,
          categories: [VendorCategory.FASTENERS_HARDWARE],
        }),
      });

      expect(res.statusCode).toBe(201);
      expect(json(res.payload)).toMatchObject({ id: TEST_UUID, shopName: "Test Supplies Co." });
      expect(mockVendorService.create).toHaveBeenCalledOnce();
    });

    it("returns 400 when shopName is missing", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/vendors",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          location: "Mumbai, MH",
          whatsappNumber: "+919876543210",
          contactStatus: ContactStatus.NOT_CONTACTED,
          categories: [],
        }),
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when whatsappNumber is invalid", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/vendors",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          shopName: "Test",
          location: "Mumbai",
          whatsappNumber: "not-a-phone",
          contactStatus: ContactStatus.NOT_CONTACTED,
          categories: [],
        }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- POST /vendors/bulk-status ---

  describe("POST /vendors/bulk-status", () => {
    it("returns 201 on bulk status update", async () => {
      mockVendorService.bulkUpdateStatus.mockResolvedValue({ updated: 2 });

      const res = await fastify().inject({
        method: "POST",
        url: "/vendors/bulk-status",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          ids: [TEST_UUID],
          contactStatus: ContactStatus.CONTACTED,
        }),
      });

      expect(res.statusCode).toBe(201);
    });
  });

  // --- POST /vendors/merge ---

  describe("POST /vendors/merge", () => {
    it("merges two vendors and returns 201", async () => {
      mockVendorService.merge.mockResolvedValue({ ...mockVendor, id: TEST_UUID });

      const res = await fastify().inject({
        method: "POST",
        url: "/vendors/merge",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ sourceId: TEST_UUID, targetId: "another-id" }),
      });

      expect(res.statusCode).toBe(201);
      expect(mockVendorService.merge).toHaveBeenCalledWith(TEST_UUID, "another-id", "admin");
    });

    it("returns 400 when sourceId is missing", async () => {
      const res = await fastify().inject({
        method: "POST",
        url: "/vendors/merge",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ targetId: "another-id" }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // --- GET /vendors ---

  describe("GET /vendors", () => {
    it("returns paginated vendor list", async () => {
      mockVendorService.findAll.mockResolvedValue({ data: [mockVendor], total: 1, page: 1, limit: 20 });

      const res = await fastify().inject({ method: "GET", url: "/vendors" });

      expect(res.statusCode).toBe(200);
      const body = json(res.payload);
      expect(body).toMatchObject({ data: expect.any(Array), total: 1 });
    });

    it("passes search and status query params", async () => {
      mockVendorService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      await fastify().inject({ method: "GET", url: "/vendors?search=test&status=CONTACTED" });

      expect(mockVendorService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: "test", status: "CONTACTED" }),
      );
    });
  });

  // --- GET /vendors/export ---

  describe("GET /vendors/export", () => {
    it("returns CSV with correct content-type", async () => {
      mockVendorService.exportCsv.mockResolvedValue("id,shopName\n1,Test");

      const res = await fastify().inject({ method: "GET", url: "/vendors/export" });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
    });
  });

  // --- GET /vendors/:id ---

  describe("GET /vendors/:id", () => {
    it("returns a vendor by ID", async () => {
      mockVendorService.findOne.mockResolvedValue(mockVendor);

      const res = await fastify().inject({ method: "GET", url: `/vendors/${TEST_UUID}` });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ id: TEST_UUID });
    });

    it("returns 404 when vendor not found", async () => {
      mockVendorService.findOne.mockRejectedValue(new NotFoundException("Vendor not found"));

      const res = await fastify().inject({ method: "GET", url: `/vendors/nonexistent` });

      expect(res.statusCode).toBe(404);
    });
  });

  // --- GET /vendors/:id/audit-logs ---

  describe("GET /vendors/:id/audit-logs", () => {
    it("returns audit logs", async () => {
      mockVendorService.findAuditLogs.mockResolvedValue([{ action: "CREATE", changedBy: "system" }]);

      const res = await fastify().inject({ method: "GET", url: `/vendors/${TEST_UUID}/audit-logs` });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toBeInstanceOf(Array);
    });
  });

  // --- GET /vendors/:id/enrichment-jobs ---

  describe("GET /vendors/:id/enrichment-jobs", () => {
    it("returns enrichment jobs", async () => {
      mockVendorService.findEnrichmentJobs.mockResolvedValue([]);

      const res = await fastify().inject({ method: "GET", url: `/vendors/${TEST_UUID}/enrichment-jobs` });

      expect(res.statusCode).toBe(200);
    });
  });

  // --- POST /vendors/:id/re-enrich ---

  describe("POST /vendors/:id/re-enrich", () => {
    it("returns jobId immediately (async fire-and-forget)", async () => {
      const jobId = "job-abc-123";
      mockVendorService.findOne.mockResolvedValue({ ...mockVendor, placeId: null });
      mockEnrichmentService.startEnrichmentJob.mockResolvedValue(jobId);
      mockVendorService.linkEnrichmentJob.mockResolvedValue(undefined);

      const res = await fastify().inject({
        method: "POST",
        url: `/vendors/${TEST_UUID}/re-enrich`,
        headers: { "content-type": "application/json" },
        payload: "{}",
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.payload)).toMatchObject({ jobId: "job-abc-123" });
    });

    it("uses placeId in maps URL when vendor has placeId", async () => {
      const jobId = "job-place-999";
      mockVendorService.findOne.mockResolvedValue({ ...mockVendor, placeId: "ChIJplace123" });
      mockEnrichmentService.startEnrichmentJob.mockResolvedValue(jobId);
      mockVendorService.linkEnrichmentJob.mockResolvedValue(undefined);

      await fastify().inject({
        method: "POST",
        url: `/vendors/${TEST_UUID}/re-enrich`,
        headers: { "content-type": "application/json" },
        payload: "{}",
      });

      const calledUrl = mockEnrichmentService.startEnrichmentJob.mock.calls[0][0] as string;
      expect(calledUrl).toContain("ChIJplace123");
    });

    it("returns 404 when vendor not found", async () => {
      mockVendorService.findOne.mockRejectedValue(new NotFoundException());

      const res = await fastify().inject({
        method: "POST",
        url: "/vendors/nonexistent/re-enrich",
        headers: { "content-type": "application/json" },
        payload: "{}",
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // --- PATCH /vendors/:id ---

  describe("PATCH /vendors/:id", () => {
    it("updates a vendor", async () => {
      mockVendorService.update.mockResolvedValue({ ...mockVendor, shopName: "Updated Name" });

      const res = await fastify().inject({
        method: "PATCH",
        url: `/vendors/${TEST_UUID}`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ shopName: "Updated Name" }),
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ shopName: "Updated Name" });
    });
  });

  // --- DELETE /vendors/:id ---

  describe("DELETE /vendors/:id", () => {
    it("deletes a vendor and returns 204", async () => {
      mockVendorService.remove.mockResolvedValue(undefined);

      const res = await fastify().inject({ method: "DELETE", url: `/vendors/${TEST_UUID}` });

      expect(res.statusCode).toBe(204);
    });

    it("returns 404 when vendor not found", async () => {
      mockVendorService.remove.mockRejectedValue(new NotFoundException("Not found"));

      const res = await fastify().inject({ method: "DELETE", url: `/vendors/nonexistent` });

      expect(res.statusCode).toBe(404);
    });
  });

  // --- POST /vendors/bulk-import ---

  describe("POST /vendors/bulk-import", () => {
    it("returns 400 when no file is uploaded", async () => {
      const boundary = "----TestBoundary";
      const res = await fastify().inject({
        method: "POST",
        url: "/vendors/bulk-import",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: `--${boundary}--`,
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
