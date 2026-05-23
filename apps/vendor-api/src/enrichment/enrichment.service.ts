import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { EnrichmentSource, VendorCategory } from "@fulfilus/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import type { EnrichmentResult, PlaceData } from "./enrichment.dto";

const MODEL_ID = "claude-sonnet-4-6";
const VENDOR_CATEGORIES = Object.values(VendorCategory) as string[];

interface PlacesSearchResult {
  place_id: string;
  name?: string;
}

interface PlacesTextSearchResponse {
  results: PlacesSearchResult[];
  status: string;
  error_message?: string;
}

interface PlacesNearbyResponse {
  results: PlacesSearchResult[];
  status: string;
  error_message?: string;
}

interface PlacesDetailsResponse {
  result: {
    name: string;
    formatted_address: string;
    types: string[];
    formatted_phone_number?: string;
    website?: string;
    rating?: number;
    business_status?: string;
  };
  status: string;
  error_message?: string;
}

interface Coords {
  lat: number;
  lng: number;
}

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);
  private readonly anthropic: Anthropic;
  private readonly mapsKey = process.env.GOOGLE_MAPS_SERVER_KEY ?? "";

  constructor(private readonly prisma: PrismaService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async startEnrichmentJob(url: string): Promise<string> {
    const jobId = await this.createJob();
    this.doEnrich(url, jobId).catch(err => {
      this.logger.error(`[enrich] async job ${jobId} failed: ${String(err)}`);
    });
    return jobId;
  }

  async getJob(jobId: string) {
    const job = await this.prisma.enrichmentJob.findUnique({
      where: { id: jobId },
      select: {
        id: true, status: true, confidenceScore: true, modelId: true,
        errorMessage: true, startedAt: true, completedAt: true,
        rawPayload: true,
      },
    });
    if (!job) return null;
    return job;
  }

  async enrichFromMapsUrl(url: string): Promise<EnrichmentResult> {
    const jobId = await this.createJob();
    return this.doEnrich(url, jobId);
  }

  private async doEnrich(url: string, jobId: string): Promise<EnrichmentResult> {
    this.logger.log(`[enrich] input URL: ${url}`);

    try {
      const fullUrl = await this.resolveRedirects(url);
      this.logger.log(`[enrich] resolved URL: ${fullUrl}`);

      const placeName = this.extractPlaceName(fullUrl);
      this.logger.log(`[enrich] extracted place name: "${placeName}"`);

      const coords = this.extractCoords(fullUrl);
      this.logger.log(`[enrich] extracted coords: ${coords ? `${coords.lat},${coords.lng}` : "none"}`);

      const placeData = await this.fetchPlaceData(placeName, coords);
      this.logger.log(`[enrich] place resolved: "${placeData.name}" (${placeData.placeId})`);

      const result = await this.enrichWithLLM(placeData);
      const whatsappNumber = placeData.phoneNumber ? this.normalizePhone(placeData.phoneNumber) : undefined;
      const finalResult = { ...result, ...(whatsappNumber ? { whatsappNumber } : {}) };
      await this.completeJob(jobId, finalResult, placeData);

      return { ...finalResult, jobId };
    } catch (err) {
      await this.failJob(jobId, String(err));
      throw err;
    }
  }

  private async createJob(): Promise<string> {
    try {
      const job = await this.prisma.enrichmentJob.create({
        data: {
          source: EnrichmentSource.GOOGLE_MAPS,
          status: "PENDING",
          startedAt: new Date(),
        },
      });
      return job.id;
    } catch (err) {
      this.logger.error(`[enrich] failed to create job record: ${String(err)}`);
      return "";
    }
  }

  private async completeJob(jobId: string, result: Omit<EnrichmentResult, "jobId">, raw: PlaceData): Promise<void> {
    if (!jobId) return;
    try {
      const payload = { ...result, placeData: raw };
      const job = await this.prisma.enrichmentJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          confidenceScore: result.confidence,
          modelId: MODEL_ID,
          rawPayload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      if (job.vendorId) {
        await this.prisma.vendor.update({
          where: { id: job.vendorId },
          data: { placeId: raw.placeId, rating: raw.rating ?? null },
        }).catch(() => {});
      }
    } catch (err) {
      this.logger.error(`[enrich] failed to complete job record: ${String(err)}`);
    }
  }

  private async failJob(jobId: string, errorMessage: string): Promise<void> {
    if (!jobId) return;
    try {
      await this.prisma.enrichmentJob.update({
        where: { id: jobId },
        data: { status: "FAILED", errorMessage, completedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`[enrich] failed to mark job as failed: ${String(err)}`);
    }
  }

  private async resolveRedirects(url: string): Promise<string> {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      this.logger.log(`[redirect] final status: ${res.status}, url: ${res.url}`);
      return res.url;
    } catch (err) {
      this.logger.error(`[redirect] failed: ${String(err)}`);
      throw new BadRequestException("Could not resolve the provided URL");
    }
  }

  private extractPlaceName(url: string): string {
    const match = url.match(/\/maps\/place\/([^/@?#]+)/);
    if (!match) {
      throw new BadRequestException(
        "URL does not appear to be a valid Google Maps place URL (missing /maps/place/ segment).",
      );
    }
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  }

  private normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    // Indian local format: starts with 0, 10-11 digits → +91XXXXXXXXXX
    if (digits.startsWith("0") && digits.length === 11) {
      return `+91${digits.slice(1)}`;
    }
    // Already has country code (10+ digits not starting with 0)
    if (digits.length >= 10) {
      return digits.startsWith("91") && digits.length === 12 ? `+${digits}` : `+91${digits.slice(-10)}`;
    }
    return raw.replace(/\s/g, "");
  }

  private extractCoords(url: string): Coords | null {
    const match = url.match(new RegExp("/@(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)"));
    if (!match) return null;
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  private async fetchPlaceData(name: string, coords: Coords | null): Promise<PlaceData> {
    if (!this.mapsKey) {
      throw new InternalServerErrorException("GOOGLE_MAPS_SERVER_KEY is not configured");
    }

    this.logger.log(`[places] strategy 1 — text search: "${name}"`);
    let placeId = await this.textSearch(name);

    if (!placeId && coords) {
      this.logger.log(`[places] strategy 2 — nearby search at ${coords.lat},${coords.lng}`);
      placeId = await this.nearbySearch(coords, name);
    }

    if (!placeId) {
      const simplified = name.replace(/[&+]/g, " ").replace(/\s{2,}/g, " ").trim();
      if (simplified !== name) {
        this.logger.log(`[places] strategy 3 — simplified text search: "${simplified}"`);
        placeId = await this.textSearch(simplified);
      }
    }

    if (!placeId) {
      throw new BadRequestException(
        `Could not locate "${name}" via Google Maps. ` +
          "Check that the Places API is enabled and the server key has no HTTP referrer restrictions.",
      );
    }

    return this.placeDetails(placeId);
  }

  private async textSearch(query: string): Promise<string | null> {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${this.mapsKey}`;
    const res = await fetch(url);
    const data = (await res.json()) as PlacesTextSearchResponse;

    this.logger.log(`[text-search] status: ${data.status}, results: ${data.results.length}`);
    if (data.error_message) this.logger.warn(`[text-search] error_message: ${data.error_message}`);

    if (data.status === "OK" && data.results.length > 0) {
      return data.results[0].place_id;
    }
    return null;
  }

  private async nearbySearch(coords: Coords, name: string): Promise<string | null> {
    const keyword = encodeURIComponent(name.split(" ").slice(0, 3).join(" "));
    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${coords.lat},${coords.lng}&radius=100&keyword=${keyword}&key=${this.mapsKey}`;
    const res = await fetch(url);
    const data = (await res.json()) as PlacesNearbyResponse;

    this.logger.log(`[nearby-search] status: ${data.status}, results: ${data.results.length}`);
    if (data.error_message) this.logger.warn(`[nearby-search] error_message: ${data.error_message}`);

    if (data.status === "OK" && data.results.length > 0) {
      return data.results[0].place_id;
    }
    return null;
  }

  private async placeDetails(placeId: string): Promise<PlaceData> {
    const fields = "name,formatted_address,types,formatted_phone_number,website,rating,business_status";
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${this.mapsKey}`;
    const res = await fetch(url);
    const data = (await res.json()) as PlacesDetailsResponse;

    if (data.status !== "OK") {
      this.logger.error(`Place Details status: ${data.status} — ${data.error_message ?? ""}`);
      throw new InternalServerErrorException("Failed to fetch place details from Google Maps");
    }

    const p = data.result;
    return {
      name: p.name,
      formattedAddress: p.formatted_address,
      types: p.types,
      phoneNumber: p.formatted_phone_number,
      website: p.website,
      rating: p.rating,
      businessStatus: p.business_status,
      placeId,
    };
  }

  private async enrichWithLLM(place: PlaceData): Promise<Omit<EnrichmentResult, "jobId">> {
    const systemPrompt = `You are an AI assistant for Fulfilus, an industrial vendor intelligence platform.
Analyze Google Maps place data and return structured vendor information as valid JSON.

Available VendorCategory values (industrial supply categories only):
${VENDOR_CATEGORIES.join(", ")}

Return ONLY a valid JSON object (no markdown fences) with these exact fields:
{
  "shopName": "business name",
  "location": "full formatted address",
  "shopDetails": "1-2 sentence business description based on types and status",
  "categories": ["only matching VendorCategory values from the list above"],
  "notes": "operational details: rating, website if available",
  "confidence": 0.0,
  "insight": "one sentence explaining why these categories were chosen"
}

If the vendor does not match any industrial category, return an empty categories array and low confidence.`;

    const userMessage = `Google Maps place data:
Name: ${place.name}
Address: ${place.formattedAddress}
Types: ${place.types.join(", ")}
Phone: ${place.phoneNumber ?? "N/A"}
Website: ${place.website ?? "N/A"}
Rating: ${place.rating ?? "N/A"}/5
Business Status: ${place.businessStatus ?? "N/A"}`;

    const msg = await this.anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new InternalServerErrorException("AI returned no text response");
    }

    let parsed: Record<string, unknown>;
    try {
      const json = textBlock.text.replace(/^```(?:json)?\s*|```\s*$/g, "").trim();
      parsed = JSON.parse(json) as Record<string, unknown>;
    } catch {
      this.logger.error("LLM returned invalid JSON", textBlock.text);
      throw new InternalServerErrorException("AI enrichment returned invalid data");
    }

    const validCategories = ((parsed.categories as string[]) ?? []).filter((c) =>
      VENDOR_CATEGORIES.includes(c),
    ) as VendorCategory[];

    return {
      shopName: (parsed.shopName as string) || place.name,
      location: (parsed.location as string) || place.formattedAddress,
      shopDetails: (parsed.shopDetails as string) || "",
      categories: validCategories,
      notes: (parsed.notes as string) || "",
      confidence: Math.min(1, Math.max(0, (parsed.confidence as number) || 0)),
      insight: (parsed.insight as string) || "",
      placeId: place.placeId,
      enrichedAt: new Date().toISOString(),
      modelUsed: MODEL_ID,
    };
  }
}
