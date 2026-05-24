import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { VendorCategory } from "@fulfilus/shared";
import type { EnrichmentResult } from "./enrichment.dto";

const MODEL_ID = "claude-sonnet-4-6";
const VENDOR_CATEGORIES = Object.values(VendorCategory) as string[];

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-IN,en;q=0.9",
  "Referer": "https://www.google.com/",
};

export interface JustDialSearchResult {
  categories: VendorCategory[];
  items: string[];
  notes: string;
  shopDetails: string;
  confidence: number;
  insight: string;
  phone?: string;
  address?: string;
}

@Injectable()
export class JustdialService {
  private readonly logger = new Logger(JustdialService.name);
  private readonly anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  /** Search JustDial by business name + city. Returns null if not found or blocked. */
  async searchAndEnrich(businessName: string, city: string): Promise<JustDialSearchResult | null> {
    this.logger.log(`[justdial] searching for "${businessName}" in "${city}"`);
    const html = await this.fetchSearchPage(businessName, city);
    if (!html) return null;
    return this.extractWithLLM(html, businessName, city);
  }

  async enrichFromUrl(url: string): Promise<Omit<EnrichmentResult, "jobId">> {
    this.logger.log(`[justdial] fetching: ${url}`);
    const html = await this.fetchPage(url);
    const extracted = this.extractFromHtml(html);
    this.logger.log(`[justdial] title: "${extracted.title}", categories: "${extracted.category}"`);
    return this.enrichWithLLM(extracted, url);
  }

  private async fetchSearchPage(name: string, city: string): Promise<string | null> {
    // Strategy 1: direct slug URL (well-indexed, often has full listing data)
    const citySlug = city.split(",")[0].trim().replace(/[^a-zA-Z0-9]+/g, "-");
    const nameSlug = name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "");
    const directUrl = `https://www.justdial.com/${citySlug}/${nameSlug}/nct-10000009`;

    try {
      const html = await this.fetchPage(directUrl);
      if (html.length > 1000) {
        this.logger.log(`[justdial] direct URL returned ${html.length} bytes`);
        return html;
      }
    } catch {
      this.logger.warn(`[justdial] direct URL failed, falling back to search`);
    }

    // Strategy 2: search page
    const searchUrl = `https://www.justdial.com/search?q=${encodeURIComponent(`${name} ${city}`)}`;
    try {
      const html = await this.fetchPage(searchUrl);
      if (html.length > 500) return html;
    } catch (err) {
      this.logger.warn(`[justdial] search page failed: ${String(err)}`);
    }

    return null;
  }

  private async fetchPage(pageUrl: string): Promise<string> {
    const res = await fetch(pageUrl, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`JustDial fetch failed: HTTP ${res.status}`);
    const text = await res.text();
    if (text.length < 500) throw new Error(`JustDial returned an empty or blocked page`);
    return text;
  }

  private stripHtml(html: string, maxChars = 4000): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .slice(0, maxChars);
  }

  private extractJsonLd(html: string): string[] {
    const blocks: string[] = [];
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) blocks.push(m[1].trim());
    return blocks;
  }

  private extractFromHtml(html: string) {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = metaMatch ? metaMatch[1].trim() : "";
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const h1Match = html.match(/<h1[^>]*>([^<]{3,100})<\/h1>/i);
    const businessName = ogTitleMatch ? ogTitleMatch[1].trim() : (h1Match ? h1Match[1].trim() : "");
    const catMatch = html.match(/(?:category|business type|jd-category)[^>]*>([^<]{3,60})</i)
      ?? html.match(/class=["'][^"']*catg[^"']*["'][^>]*>([^<]{3,60})</i);
    const category = catMatch ? catMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    const addrMatch = html.match(/(?:itemprop=["']address["']|class=["'][^"']*address[^"']*["'])[^>]*>([\s\S]{5,200}?)<\/(?:span|div|p)>/i);
    const address = addrMatch ? addrMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
    const phoneMatch = html.match(/(?:tel:|callnow|mobilesv)[^"']*["']([+\d]{8,14})["']/i)
      ?? html.match(/(?:Phone|Mobile|Contact)[:\s]*([+\d\s\-()]{8,16})/i);
    const phone = phoneMatch ? phoneMatch[1].trim() : "";
    const ratingMatch = html.match(/(?:itemprop=["']ratingValue["']|class=["'][^"']*rating[^"']*["'])[^>]*>([\d.]+)/i);
    const rating = ratingMatch ? ratingMatch[1] : "";
    const hoursMatch = html.match(/(?:opening hours|timings|open)[^>]*>([^<]{5,60})</i);
    const openingHours = hoursMatch ? hoursMatch[1].trim() : "";
    const jsonLd = this.extractJsonLd(html);
    const rawText = this.stripHtml(html) + (jsonLd.length ? `\n\nJSON-LD: ${jsonLd.join("\n")}` : "");
    return { title, description, businessName, category, address, phone, rating, openingHours, rawText };
  }

  /** LLM extraction from a search results or listing page when searching by name */
  private async extractWithLLM(html: string, businessName: string, city: string): Promise<JustDialSearchResult | null> {
    const jsonLd = this.extractJsonLd(html);
    const bodyText = this.stripHtml(html, 4000);
    const pageContent = bodyText + (jsonLd.length ? `\n\nJSON-LD:\n${jsonLd.slice(0, 3).join("\n")}` : "");

    const systemPrompt = `You are an AI assistant for Fulfilus, an industrial vendor intelligence platform.
Analyze JustDial page content to extract data about a specific vendor.

Available VendorCategory values: ${VENDOR_CATEGORIES.join(", ")}

Return ONLY valid JSON:
{
  "found": true or false,
  "categories": ["VendorCategory values that match this business"],
  "items": ["specific products or items this vendor supplies — be specific, e.g. 'M8 Hex Bolts', 'Hydraulic Cylinders', 'Cable Lugs'"],
  "notes": "operational details: hours, rating, years in business, specializations",
  "shopDetails": "2-3 sentence description of this specific business",
  "confidence": 0.0,
  "insight": "one sentence on how confident you are and why",
  "phone": "phone number if visible",
  "address": "address if visible"
}

Set "found": false if the target business is not present in the page.`;

    const msg = await this.anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Target: "${businessName}" in ${city}\n\nPage content:\n${pageContent}` }],
    });

    const textBlock = msg.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(textBlock.text.replace(/^```(?:json)?\s*|```\s*$/g, "").trim()) as Record<string, unknown>;
    } catch {
      this.logger.error("[justdial] LLM returned invalid JSON");
      return null;
    }

    if (!parsed.found) {
      this.logger.log(`[justdial] LLM did not find "${businessName}" on the page`);
      return null;
    }

    const validCategories = ((parsed.categories as string[]) ?? []).filter(c =>
      VENDOR_CATEGORIES.includes(c),
    ) as VendorCategory[];

    return {
      categories: validCategories,
      items: (parsed.items as string[]) ?? [],
      notes: (parsed.notes as string) ?? "",
      shopDetails: (parsed.shopDetails as string) ?? "",
      confidence: Math.min(1, Math.max(0, (parsed.confidence as number) || 0)),
      insight: (parsed.insight as string) ?? "",
      phone: (parsed.phone as string) || undefined,
      address: (parsed.address as string) || undefined,
    };
  }

  private async enrichWithLLM(
    data: ReturnType<JustdialService["extractFromHtml"]>,
    url: string,
  ): Promise<Omit<EnrichmentResult, "jobId">> {
    const systemPrompt = `You are an AI assistant for Fulfilus, an industrial vendor intelligence platform.
Analyze JustDial vendor page data and return structured vendor information as valid JSON.

Available VendorCategory values: ${VENDOR_CATEGORIES.join(", ")}

Return ONLY a valid JSON object with these fields:
{
  "shopName": "business name",
  "location": "full address",
  "shopDetails": "2-3 sentence description",
  "categories": ["matching VendorCategory values only"],
  "items": ["specific products/services this vendor offers"],
  "notes": "key operational details: hours, rating, specializations",
  "confidence": 0.0,
  "insight": "one sentence explaining category selection"
}`;

    const userMessage = `JustDial vendor page: ${url}
Title: ${data.title}
Business Name: ${data.businessName || "not found"}
Description: ${data.description}
Category: ${data.category || "not found"}
Address: ${data.address || "not found"}
Phone: ${data.phone || "not found"}
Rating: ${data.rating || "not found"}
Opening Hours: ${data.openingHours || "not found"}
Page text: ${data.rawText.slice(0, 1500)}`;

    const msg = await this.anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      messages: [{ role: "user", content: `${systemPrompt}\n\n${userMessage}` }],
    });

    const textBlock = msg.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("AI returned no text");

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(textBlock.text.replace(/^```(?:json)?\s*|```\s*$/g, "").trim()) as Record<string, unknown>;
    } catch {
      this.logger.error("[justdial] LLM returned invalid JSON", textBlock.text);
      throw new Error("AI enrichment returned invalid data");
    }

    const validCategories = ((parsed.categories as string[]) ?? []).filter(c =>
      VENDOR_CATEGORIES.includes(c),
    ) as VendorCategory[];

    return {
      shopName: (parsed.shopName as string) || data.businessName || data.title.split("|")[0].trim(),
      location: (parsed.location as string) || data.address || "",
      shopDetails: (parsed.shopDetails as string) || data.description,
      categories: validCategories,
      items: (parsed.items as string[]) ?? [],
      notes: (parsed.notes as string) || "",
      confidence: Math.min(1, Math.max(0, (parsed.confidence as number) || 0)),
      insight: (parsed.insight as string) || "",
      placeId: undefined,
      enrichedAt: new Date().toISOString(),
      modelUsed: MODEL_ID,
    };
  }
}
