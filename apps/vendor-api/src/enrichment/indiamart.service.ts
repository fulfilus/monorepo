import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { VendorCategory } from "@fulfilus/shared";
import type { EnrichmentResult } from "./enrichment.dto";

const MODEL_ID = "claude-sonnet-4-6";
const VENDOR_CATEGORIES = Object.values(VendorCategory) as string[];

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-IN,en;q=0.9",
};

@Injectable()
export class IndiamartService {
  private readonly logger = new Logger(IndiamartService.name);
  private readonly anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async enrichFromUrl(url: string): Promise<Omit<EnrichmentResult, "jobId">> {
    this.logger.log(`[indiamart] fetching: ${url}`);

    const html = await this.fetchPage(url);
    const extracted = this.extractFromHtml(html, url);
    this.logger.log(`[indiamart] extracted title: "${extracted.title}", products: ${extracted.products.length}`);

    return this.enrichWithLLM(extracted, url);
  }

  private async fetchPage(pageUrl: string): Promise<string> {
    const res = await fetch(pageUrl, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`IndiaMART fetch failed: HTTP ${res.status}`);
    const text = await res.text();
    if (text.length < 500) throw new Error(`IndiaMART returned an empty or blocked page (${pageUrl})`);
    return text;
  }

  private extractFromHtml(html: string, _url: string): {
    title: string;
    description: string;
    products: string[];
    address: string;
    phone: string;
    website: string;
    gst: string;
    rawText: string;
  } {
    // Title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

    // Meta description
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = metaMatch ? metaMatch[1].trim() : "";

    // JSON-LD structured data
    const jsonLdBlocks: string[] = [];
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      jsonLdBlocks.push(match[1].trim());
    }

    // Phone numbers from page
    const phoneMatch = html.match(/(?:tel:|Phone:|Mobile:)\s*([+\d\s\-()]{8,16})/i);
    const phone = phoneMatch ? phoneMatch[1].trim() : "";

    // Address patterns
    const addressMatch = html.match(/(?:Address:|Location:)[^<]{5,200}/i);
    const address = addressMatch ? addressMatch[0].replace(/Address:|Location:/i, "").trim() : "";

    // GST number
    const gstMatch = html.match(/GST[^:]*:\s*([A-Z0-9]{15})/i);
    const gst = gstMatch ? gstMatch[1] : "";

    // Product names from list items or headings — limit to first 20
    const productMatches = html.matchAll(/<(?:li|h[23456])[^>]*class="[^"]*(?:product|cat)[^"]*"[^>]*>([\s\S]{3,80}?)<\/(?:li|h[23456])>/gi);
    const products: string[] = [];
    for (const m of productMatches) {
      const cleaned = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (cleaned.length > 3 && cleaned.length < 80) products.push(cleaned);
      if (products.length >= 20) break;
    }

    // Company website from "website" link
    const websiteMatch = html.match(/href=["'](https?:\/\/(?!(?:www\.)?indiamart)[^"']+)["'][^>]*>(?:Visit|Website|www)/i);
    const website = websiteMatch ? websiteMatch[1] : "";

    // Compact raw text (first 3000 chars of stripped body text)
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .slice(0, 3000);

    return {
      title,
      description,
      products,
      address,
      phone,
      website,
      gst,
      rawText: bodyText + (jsonLdBlocks.length ? `\n\nJSON-LD: ${jsonLdBlocks.join("\n")}` : ""),
    };
  }

  private async enrichWithLLM(data: ReturnType<IndiamartService["extractFromHtml"]>, url: string): Promise<Omit<EnrichmentResult, "jobId">> {
    const systemPrompt = `You are an AI assistant for Fulfilus, an industrial vendor intelligence platform.
Analyze IndiaMART vendor page data and return structured vendor information as valid JSON.

Available VendorCategory values:
${VENDOR_CATEGORIES.join(", ")}

Return ONLY a valid JSON object (no markdown fences) with these exact fields:
{
  "shopName": "business name",
  "location": "full address",
  "shopDetails": "2-3 sentence description",
  "categories": ["matching VendorCategory values only"],
  "notes": "key operational details: products, capacity, certifications",
  "confidence": 0.0,
  "insight": "one sentence explaining category selection"
}`;

    const userMessage = `IndiaMART vendor page: ${url}
Title: ${data.title}
Description: ${data.description}
Address: ${data.address || "not found"}
Phone: ${data.phone || "not found"}
GST: ${data.gst || "not found"}
Website: ${data.website || "not found"}
Products (sample): ${data.products.slice(0, 10).join(", ") || "not parsed"}
Page text (excerpt): ${data.rawText.slice(0, 1500)}`;

    const msg = await this.anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      messages: [{ role: "user", content: `${systemPrompt}\n\n${userMessage}` }],
    });

    const textBlock = msg.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("AI returned no text");

    let parsed: Record<string, unknown>;
    try {
      const json = textBlock.text.replace(/^```(?:json)?\s*|```\s*$/g, "").trim();
      parsed = JSON.parse(json) as Record<string, unknown>;
    } catch {
      this.logger.error("[indiamart] LLM returned invalid JSON", textBlock.text);
      throw new Error("AI enrichment returned invalid data");
    }

    const validCategories = ((parsed.categories as string[]) ?? []).filter(c =>
      VENDOR_CATEGORIES.includes(c),
    ) as VendorCategory[];

    return {
      shopName: (parsed.shopName as string) || data.title.split("|")[0].trim(),
      location: (parsed.location as string) || data.address || "",
      shopDetails: (parsed.shopDetails as string) || data.description,
      categories: validCategories,
      notes: (parsed.notes as string) || "",
      confidence: Math.min(1, Math.max(0, (parsed.confidence as number) || 0)),
      insight: (parsed.insight as string) || "",
      placeId: undefined,
      enrichedAt: new Date().toISOString(),
      modelUsed: MODEL_ID,
    };
  }
}
