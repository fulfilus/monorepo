import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import type { EnrichedProduct } from "@fulfilus/shared";
import { VendorCategory } from "@fulfilus/shared";
import type { EnrichmentResult } from "./enrichment.dto";

const MODEL_ID = "claude-sonnet-4-6";
const VENDOR_CATEGORIES = Object.values(VendorCategory) as string[];

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-IN,en;q=0.9",
};

export interface IndiaMartSearchResult {
  categories: VendorCategory[];
  items: string[];
  notes: string;
  shopDetails: string;
  confidence: number;
  insight: string;
  gstNumber?: string;
  phone?: string;
  address?: string;
}

@Injectable()
export class IndiamartService {
  private readonly logger = new Logger(IndiamartService.name);
  private readonly anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  /** Search IndiaMart by business name + city. Returns null if not found or blocked. */
  async searchAndEnrich(businessName: string, city: string): Promise<IndiaMartSearchResult | null> {
    this.logger.log(`[indiamart] searching for "${businessName}" in "${city}"`);
    const html = await this.fetchSearchPage(businessName, city);
    if (!html) return null;
    return this.extractWithLLM(html, businessName, city);
  }

  async enrichFromUrl(url: string): Promise<Omit<EnrichmentResult, "jobId">> {
    this.logger.log(`[indiamart] fetching: ${url}`);

    const html = await this.fetchPage(url);
    const extracted = this.extractFromHtml(html, url);
    this.logger.log(`[indiamart] extracted title: "${extracted.title}", products: ${extracted.products.length}`);

    const catalogProducts = await this.fetchProductCatalog(url);
    this.logger.log(`[indiamart] catalog products: ${catalogProducts.length}`);

    return this.enrichWithLLM(extracted, url, catalogProducts);
  }

  /** Fetch /products.html for the supplier and extract structured product rows. */
  private async fetchProductCatalog(supplierUrl: string): Promise<EnrichedProduct[]> {
    const base = supplierUrl.replace(/\/$/, "").replace(/\/products\.html$/, "");
    const catalogUrl = `${base}/products.html`;
    try {
      const html = await this.fetchPage(catalogUrl);
      return this.extractProductsFromHtml(html);
    } catch (err) {
      this.logger.warn(`[indiamart] product catalog fetch failed: ${String(err)}`);
      return [];
    }
  }

  private extractProductsFromHtml(html: string): EnrichedProduct[] {
    const products: EnrichedProduct[] = [];

    // Strip scripts/styles for text extraction
    const clean = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");

    // IndiaMart product card selectors (class names seen in their catalog pages)
    // Each card typically contains: .gdname/.gpnm (name), .gprc/.price (price), .moq (MOQ)
    const cardRegex = /<(?:div|li)[^>]+class="[^"]*(?:mpgbox|prd-card|product-listing|lst_cl|p-card)[^"]*"[^>]*>([\s\S]*?)(?=<(?:div|li)[^>]+class="[^"]*(?:mpgbox|prd-card|product-listing|lst_cl|p-card)[^"]*"|$)/gi;
    const cards = [...clean.matchAll(cardRegex)].map(m => m[1]);

    // Fallback: split by price pattern blocks if no cards found
    const blocks = cards.length >= 2 ? cards : this.splitIntoProductBlocks(clean);

    for (const block of blocks.slice(0, 30)) {
      const name = this.extractText(block, [
        /class="[^"]*(?:gdname|gpnm|pname|product-name)[^"]*"[^>]*>([\s\S]*?)<\//i,
        /<h[23][^>]*>([\s\S]{4,80}?)<\/h[23]>/i,
      ]);
      if (!name || name.length < 3) continue;

      const priceRange = this.extractText(block, [
        /class="[^"]*(?:gprc|price|prc)[^"]*"[^>]*>([\s\S]*?)<\//i,
        /(?:₹|Rs\.?)\s*[\d,]+\s*[-–]\s*(?:₹|Rs\.?)?\s*[\d,]+[^<]{0,30}/i,
        /(?:₹|Rs\.?)\s*[\d,]+(?:\s*\/\s*\w+)?/i,
      ]);

      const moqText = this.extractText(block, [
        /class="[^"]*(?:moq|min-order)[^"]*"[^>]*>([\s\S]*?)<\//i,
        /(?:Min(?:imum)?\s*(?:Order|Qty|Quantity)[^<]{0,60})/i,
      ]);

      const unitText = this.extractText(block, [
        /class="[^"]*(?:unit|uom)[^"]*"[^>]*>([\s\S]*?)<\//i,
        /\/\s*(Piece|Kg|Litre|Meter|Set|Box|Pair|Unit|Ton|MT|Nos)\b/i,
      ]);

      const specsRaw = this.extractText(block, [
        /class="[^"]*(?:specs?|attr|feature)[^"]*"[^>]*>([\s\S]*?)<\//i,
      ]);

      products.push({
        name: this.cleanText(name),
        priceRange: priceRange ? this.cleanText(priceRange) : undefined,
        moq: moqText ? this.cleanText(moqText) : undefined,
        unit: unitText ? this.cleanText(unitText) : undefined,
        specs: specsRaw ? this.cleanText(specsRaw).slice(0, 200) : undefined,
      });
    }

    return products;
  }

  /** Fallback: split HTML into chunks around price patterns when no card containers are found. */
  private splitIntoProductBlocks(html: string): string[] {
    const chunks: string[] = [];
    const lines = html.split("\n");
    let buf = "";
    for (const line of lines) {
      buf += line + "\n";
      if (/(?:₹|Rs\.?)\s*[\d,]+/.test(line) || /Min(?:imum)?\s*Order/i.test(line)) {
        if (buf.length > 50) chunks.push(buf);
        buf = "";
      }
    }
    return chunks;
  }

  private extractText(html: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const m = html.match(pattern);
      if (m) {
        const raw = (m[1] ?? m[0]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (raw.length > 2) return raw;
      }
    }
    return undefined;
  }

  private cleanText(s: string): string {
    return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  private async fetchSearchPage(name: string, city: string): Promise<string | null> {
    // Strategy 1: company search with city filter
    const searchUrl = `https://www.indiamart.com/search.mp?ss=${encodeURIComponent(`${name} ${city}`)}&type=comp`;
    try {
      const html = await this.fetchPage(searchUrl);
      if (html.length > 1000) {
        this.logger.log(`[indiamart] search URL returned ${html.length} bytes`);
        return html;
      }
    } catch {
      this.logger.warn(`[indiamart] search URL failed, falling back to directory search`);
    }

    // Strategy 2: directory search
    const dirUrl = `https://dir.indiamart.com/search.mp?ss=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}`;
    try {
      const html = await this.fetchPage(dirUrl);
      if (html.length > 500) return html;
    } catch (err) {
      this.logger.warn(`[indiamart] directory search failed: ${String(err)}`);
    }

    return null;
  }

  private async fetchPage(pageUrl: string): Promise<string> {
    const res = await fetch(pageUrl, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`IndiaMART fetch failed: HTTP ${res.status}`);
    const text = await res.text();
    if (text.length < 500) throw new Error(`IndiaMART returned an empty or blocked page (${pageUrl})`);
    return text;
  }

  /** LLM extraction from a search results page when searching by name */
  private async extractWithLLM(html: string, businessName: string, city: string): Promise<IndiaMartSearchResult | null> {
    const jsonLdBlocks: string[] = [];
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = jsonLdRegex.exec(html)) !== null) jsonLdBlocks.push(m[1].trim());

    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .slice(0, 4000);

    const pageContent = bodyText + (jsonLdBlocks.length ? `\n\nJSON-LD:\n${jsonLdBlocks.slice(0, 3).join("\n")}` : "");

    const systemPrompt = `You are an AI assistant for Fulfilus, an industrial vendor intelligence platform.
Analyze IndiaMART page content to extract data about a specific vendor.

Available VendorCategory values: ${VENDOR_CATEGORIES.join(", ")}

Return ONLY valid JSON:
{
  "found": true or false,
  "categories": ["VendorCategory values that match this business"],
  "items": ["specific products or items this vendor supplies — be specific, e.g. 'M8 Hex Bolts', 'Hydraulic Cylinders', 'Cable Lugs'"],
  "notes": "operational details: certifications, capacity, years in business, specializations",
  "shopDetails": "2-3 sentence description of this specific business",
  "confidence": 0.0,
  "insight": "one sentence on how confident you are and why",
  "gstNumber": "GST number if visible",
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
      this.logger.error("[indiamart] LLM returned invalid JSON");
      return null;
    }

    if (!parsed.found) {
      this.logger.log(`[indiamart] LLM did not find "${businessName}" on the page`);
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
      gstNumber: (parsed.gstNumber as string) || undefined,
      phone: (parsed.phone as string) || undefined,
      address: (parsed.address as string) || undefined,
    };
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

  private async enrichWithLLM(data: ReturnType<IndiamartService["extractFromHtml"]>, url: string, catalogProducts: EnrichedProduct[] = []): Promise<Omit<EnrichmentResult, "jobId">> {
    const catalogSummary = catalogProducts.length
      ? catalogProducts.slice(0, 20).map(p => {
          const parts = [p.name];
          if (p.priceRange) parts.push(`price: ${p.priceRange}`);
          if (p.moq) parts.push(`MOQ: ${p.moq}`);
          if (p.unit) parts.push(`unit: ${p.unit}`);
          if (p.specs) parts.push(`specs: ${p.specs}`);
          return parts.join(" | ");
        }).join("\n")
      : "not available";

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
  "notes": "key operational details: capacity, certifications, specializations",
  "confidence": 0.0,
  "insight": "one sentence explaining category selection",
  "items": ["concise product names from catalog, max 20"]
}`;

    const userMessage = `IndiaMART vendor page: ${url}
Title: ${data.title}
Description: ${data.description}
Address: ${data.address || "not found"}
Phone: ${data.phone || "not found"}
GST: ${data.gst || "not found"}
Website: ${data.website || "not found"}
Page text (excerpt): ${data.rawText.slice(0, 1200)}

Product catalog (${catalogProducts.length} items):
${catalogSummary}`;

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
      items: ((parsed.items as string[]) ?? []).slice(0, 20),
      products: catalogProducts.length ? catalogProducts : undefined,
    };
  }
}
