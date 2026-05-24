import "reflect-metadata";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { InboundController } from "../src/inbound/inbound.controller";
import { InboundService } from "../src/inbound/inbound.service";
import { createTestApp, TEST_UUID } from "./helpers/test-app.helper";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

const mockValidation = {
  id: "val-001",
  quoteId: TEST_UUID,
  status: "PENDING",
  score: null,
  flags: [],
  reviewedBy: null,
  reviewNotes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockInboundMessage = {
  id: "msg-001",
  waMessageId: "wa-msg-001",
  fromNumber: "+919876543210",
  messageType: "text",
  rawText: "Need 50kg rice and 20kg wheat",
  imageMediaId: null,
  status: "QUOTED",
  extractedItems: [{ itemName: "rice", quantity: 50, unit: "kg" }],
  quoteId: TEST_UUID,
  customerId: null,
  errorMessage: null,
  createdAt: new Date().toISOString(),
};

const mockInboundService = {
  getPendingInbox: vi.fn(),
  reviewQuote: vi.fn(),
};

describe("InboundController (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InboundController],
      providers: [{ provide: InboundService, useValue: mockInboundService }],
    }).compile();

    app = await createTestApp(moduleRef);
  });

  afterAll(async () => await app.close());
  beforeEach(() => vi.clearAllMocks());

  const fastify = () => app.getHttpAdapter().getInstance();
  const json = (payload: string) => JSON.parse(payload);

  // --- GET /inbound ---

  describe("GET /inbound", () => {
    it("returns paginated inbox messages", async () => {
      mockInboundService.getPendingInbox.mockResolvedValue({
        data: [mockInboundMessage],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await fastify().inject({ method: "GET", url: "/inbound" });

      expect(res.statusCode).toBe(200);
      const body = json(res.payload);
      expect(body).toMatchObject({ total: 1 });
      expect(body.data).toBeInstanceOf(Array);
    });

    it("passes page and limit query params", async () => {
      mockInboundService.getPendingInbox.mockResolvedValue({ data: [], total: 0, page: 2, limit: 5 });

      await fastify().inject({ method: "GET", url: "/inbound?page=2&limit=5" });

      expect(mockInboundService.getPendingInbox).toHaveBeenCalledWith(2, 5);
    });
  });

  // --- PATCH /inbound/:quoteId/review ---

  describe("PATCH /inbound/:quoteId/review", () => {
    it("approves quote and triggers auto-send", async () => {
      mockInboundService.reviewQuote.mockResolvedValue({ ...mockValidation, status: "APPROVED", reviewedBy: "nvarma" });

      const res = await fastify().inject({
        method: "PATCH",
        url: `/inbound/${TEST_UUID}/review`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ action: "APPROVED", reviewedBy: "nvarma" }),
      });

      expect(res.statusCode).toBe(200);
      expect(json(res.payload)).toMatchObject({ status: "APPROVED", reviewedBy: "nvarma" });
      expect(mockInboundService.reviewQuote).toHaveBeenCalledWith(
        TEST_UUID,
        "APPROVED",
        "nvarma",
        undefined,
      );
    });

    it("rejects quote with notes", async () => {
      mockInboundService.reviewQuote.mockResolvedValue({
        ...mockValidation,
        status: "REJECTED",
        reviewedBy: "admin",
        reviewNotes: "Prices too high",
      });

      const res = await fastify().inject({
        method: "PATCH",
        url: `/inbound/${TEST_UUID}/review`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ action: "REJECTED", reviewedBy: "admin", reviewNotes: "Prices too high" }),
      });

      expect(res.statusCode).toBe(200);
      expect(mockInboundService.reviewQuote).toHaveBeenCalledWith(
        TEST_UUID,
        "REJECTED",
        "admin",
        "Prices too high",
      );
    });

    it("returns 400 when action is invalid", async () => {
      const res = await fastify().inject({
        method: "PATCH",
        url: `/inbound/${TEST_UUID}/review`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ action: "MAYBE", reviewedBy: "admin" }),
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when reviewedBy is missing", async () => {
      const res = await fastify().inject({
        method: "PATCH",
        url: `/inbound/${TEST_UUID}/review`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ action: "APPROVED" }),
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
