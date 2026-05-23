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

@Injectable()
export class JustdialService {
  private readonly logger = new Logger(JustdialService.name);
  private readonly anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async enrichFromUrl(url: string): Promise<Omit<EnrichmentResult, "jobId">> {
    this.logger.log(`[justdial] fetching: ${url}`);

    const html = await this.fetchPage(url);
    const extracted = this.extractFromHtml(html);
    this.logger.log(`[justdial] title: "${extracted.title}", categories: "${extracted.category}"`);

    return this.enrichWithLLM(extracted, url);
  }

  private async fetchPage(pageUrl: string): Promise<string> {
    const res = await fetch(pageUrl, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`JustDial fetch failed: HTTP ${res.status}`);
    const text = await res.text();
    if (text.length < 500) throw new Error(`JustDial returned an empty or blocked page (${pageUrl})`);
    return text;
  }

  private extractFromHtml(html: string): {
    title: string;
    description: string;
    businessName: string;
    category: string;
    address: string;
    phone: string;
    rating: string;
    openingHours: string;
    rawText: string;
  } {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = metaMatch ? metaMatch[1].trim() : "";

    // JSON-LD blocks often contain structured business data on JustDial
    const jsonLdBlocks: string[] = [];
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = jsonLdRegex.exec(html)) !== null) {
      jsonLdBlocks.push(m[1].trim());
    }

    // Business name from og:title or h1
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const h1Match = html.match(/<h1[^>]*>([^<]{3,100})<\/h1>/i);
    const businessName = ogTitleMatch ? ogTitleMatch[1].trim() : (h1Match ? h1Match[1].trim() : "");

    // Category / business type
    const catMatch = html.match(/(?:category|business type|jd-category)[^>]*>([^<]{3,60})</i)
      ?? html.match(/class=["'][^"']*catg[^"']*["'][^>]*>([^<]{3,60})</i);
    const category = catMatch ? catMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    // Address
    const addrMatch = html.match(/(?:itemprop=["']address["']|class=["'][^"']*address[^"']*["'])[^>]*>([\s\S]{5,200}?)<\/(?:span|div|p)>/i);
    const address = addrMatch ? addrMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";

    // Phone (JustDial often hides numbers but some are visible in HTML)
    const phoneMatch = html.match(/(?:tel:|callnow|mobilesv)[^"']*["']([+\d]{8,14})["']/i)
      ?? html.match(/(?:Phone|Mobile|Contact)[:\s]*([+\d\s\-()]{8,16})/i);
    const phone = phoneMatch ? phoneMatch[1].trim() : "";

    // Rating
    const ratingMatch = html.match(/(?:itemprop=["']ratingValue["']|class=["'][^"']*rating[^"']*["'])[^>]*>([\d.]+)/i);
    const rating = ratingMatch ? ratingMatch[1] : "";

    // Opening hours
    const hoursMatch = html.match(/(?:opening hours|timings|open)[^>]*>([^<]{5,60})</i);
    const openingHours = hoursMatch ? hoursMatch[1].trim() : "";

    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .slice(0, 3000);

    return {
      title,
      description,
      businessName,
      category,
      address,
      phone,
      rating,
      openingHours,
      rawText: bodyText + (jsonLdBlocks.length ? `\n\nJSON-LD: ${jsonLdBlocks.join("\n")}` : ""),
    };
  }

  private async enrichWithLLM(
    data: ReturnType<JustdialService["extractFromHtml"]>,
    url: string,
  ): Promise<Omit<EnrichmentResult, "jobId">> {
    const systemPrompt = `You are an AI assistant for Fulfilus, an industrial vendor intelligence platform.
Analyze JustDial vendor page data and return structured vendor information as valid JSON.

Available VendorCategory values:
${VENDOR_CATEGORIES.join(", ")}

Return ONLY a valid JSON object (no markdown fences) with these exact fields:
{
  "shopName": "business name",
  "location": "full address",
  "shopDetails": "2-3 sentence description",
  "categories": ["matching VendorCategory values only"],
  "notes": "key operational details: hours, rating, specializations",
  "confidence": 0.0,
  "insight": "one sentence explaining category selection"
}`;

    const userMessage = `JustDial vendor page: ${url}
Title: ${data.title}
Business Name: ${data.businessName || "not found"}
Description: ${data.description}
Category (JustDial): ${data.category || "not found"}
Address: ${data.address || "not found"}
Phone: ${data.phone || "not found"}
Rating: ${data.rating || "not found"}
Opening Hours: ${data.openingHours || "not found"}
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
      notes: (parsed.notes as string) || "",
      confidence: Math.min(1, Math.max(0, (parsed.confidence as number) || 0)),
      insight: (parsed.insight as string) || "",
      placeId: undefined,
      enrichedAt: new Date().toISOString(),
      modelUsed: MODEL_ID,
    };
  }
}
