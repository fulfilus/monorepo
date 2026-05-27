import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import type { IndiaMartCompany, IndiamartImportResult } from "./indiamart-import.dto";

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-IN,en;q=0.9",
};

// IndiaMart API response shape
interface IndiaMartApiResponse {
  CODE: number;
  STATUS: string;
  RESPONSE?: {
    TOTAL_COUNT?: string | number;
    PRODUCTDATA?: IndiaMartApiRecord[];
  };
  MESSAGE?: string;
}

interface IndiaMartApiRecord {
  COMPANY_NAME?: string;
  COMPANY_ADDRESS?: string;
  DISTRICT?: string;
  MOBILE?: string;
  GLID?: string;
  CAT_NAME?: string;
  CATEGORY_L1?: string;
  SUPPLIER_URL?: string;
  GST_NO?: string;
}

@Injectable()
export class IndiamartImportService {
  private readonly logger = new Logger(IndiamartImportService.name);
  private readonly apiKey = process.env.INDIAMART_API_KEY;

  constructor(private readonly prisma: PrismaService) {}

  async runImport(query: string, city: string, maxPages: number, importedBy: string): Promise<IndiamartImportResult> {
    this.logger.log(`[indiamart-import] starting: query="${query}" city="${city}" maxPages=${maxPages}`);

    const allCompanies: IndiaMartCompany[] = [];

    for (let page = 1; page <= maxPages; page++) {
      let companies: IndiaMartCompany[];

      try {
        companies = this.apiKey
          ? await this.fetchViaApi(query, city, page)
          : await this.fetchViaScraping(query, city, page);
      } catch (err) {
        this.logger.warn(`[indiamart-import] page ${page} fetch failed: ${String(err)}`);
        break;
      }

      if (companies.length === 0) {
        this.logger.log(`[indiamart-import] page ${page} returned 0 results — stopping`);
        break;
      }

      this.logger.log(`[indiamart-import] page ${page}: ${companies.length} companies`);
      allCompanies.push(...companies);

      // Respect rate limits
      if (page < maxPages) await this.delay(800);
    }

    this.logger.log(`[indiamart-import] total candidates: ${allCompanies.length}`);

    return this.upsertVendors(allCompanies, importedBy);
  }

  private async fetchViaApi(query: string, city: string, page: number): Promise<IndiaMartCompany[]> {
    const url = new URL("https://api.indiamart.com/search/api/v1/classified");
    url.searchParams.set("glusr_usr_name", this.apiKey!);
    url.searchParams.set("query", query);
    url.searchParams.set("city", city);
    url.searchParams.set("page", String(page));

    this.logger.log(`[indiamart-import] API fetch page ${page}`);

    const res = await fetch(url.toString(), {
      headers: { ...FETCH_HEADERS, "Accept": "application/json" },
    });
    if (!res.ok) throw new Error(`IndiaMart API HTTP ${res.status}`);

    const data = await res.json() as IndiaMartApiResponse;

    if (data.CODE !== 200 || !data.RESPONSE?.PRODUCTDATA) {
      this.logger.warn(`[indiamart-import] API non-200: ${data.MESSAGE ?? "no message"}`);
      return [];
    }

    return data.RESPONSE.PRODUCTDATA.map(r => this.normalizeApiRecord(r));
  }

  private normalizeApiRecord(r: IndiaMartApiRecord): IndiaMartCompany {
    const rawPhone = r.MOBILE?.replace(/[^\d]/g, "") ?? "";
    const phone = this.normalizePhone(rawPhone);

    const categories: string[] = [];
    if (r.CAT_NAME) categories.push(r.CAT_NAME);
    if (r.CATEGORY_L1 && r.CATEGORY_L1 !== r.CAT_NAME) categories.push(r.CATEGORY_L1);

    const address = [r.COMPANY_ADDRESS, r.DISTRICT].filter(Boolean).join(", ");

    return {
      name: r.COMPANY_NAME?.trim() ?? "",
      address: address.trim(),
      phone: phone || undefined,
      glid: r.GLID,
      categories,
      supplierUrl: r.SUPPLIER_URL,
      gstNumber: r.GST_NO || undefined,
    };
  }

  private async fetchViaScraping(query: string, city: string, page: number): Promise<IndiaMartCompany[]> {
    const slug = query.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const citySlug = city.toLowerCase().replace(/\s+/g, "-");
    const startIndex = (page - 1) * 20;
    const url = `https://dir.indiamart.com/city/${citySlug}/${slug}-supplier.html${startIndex > 0 ? `?startindex=${startIndex}` : ""}`;

    this.logger.log(`[indiamart-import] scraping: ${url}`);

    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`Scrape HTTP ${res.status}`);
    const html = await res.text();
    if (html.length < 1000) throw new Error("Page too small — likely blocked");

    return this.parseDirectoryPage(html);
  }

  private parseDirectoryPage(html: string): IndiaMartCompany[] {
    const companies: IndiaMartCompany[] = [];

    // Strip scripts/styles
    const clean = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");

    // Split into per-supplier blocks by common container classes
    const blockRegex = /<(?:div|li)[^>]+class="[^"]*(?:comp-box|company-list|clg|biz_listing|mpgbox|supplier-card)[^"]*"[^>]*>([\s\S]*?)(?=<(?:div|li)[^>]+class="[^"]*(?:comp-box|company-list|clg|biz_listing|mpgbox|supplier-card)[^"]*"|$)/gi;
    const blocks = [...clean.matchAll(blockRegex)].map(m => m[1]);

    if (blocks.length === 0) {
      // Fallback: split on supplier profile links
      const links = [...clean.matchAll(/href=["'](https?:\/\/www\.indiamart\.com\/[a-z0-9-]+\/)["'][^>]*>([\s\S]{0,500})/gi)];
      for (const m of links.slice(0, 20)) {
        const block = m[2];
        const name = this.extractText(block, [
          /class="[^"]*(?:bname|compname|company-name|name)[^"]*"[^>]*>([\s\S]{2,80}?)</i,
          /<(?:h[1-4]|strong)[^>]*>([\s\S]{2,80}?)<\/(?:h[1-4]|strong)>/i,
        ]);
        if (!name || name.length < 3) continue;
        companies.push({
          name: this.cleanText(name),
          address: "",
          supplierUrl: m[1],
          categories: [],
        });
      }
      return companies;
    }

    for (const block of blocks) {
      const name = this.extractText(block, [
        /class="[^"]*(?:bname|compname|company-name|comp_name)[^"]*"[^>]*>([\s\S]{2,100}?)</i,
        /itemprop="name"[^>]*>([\s\S]{2,100}?)</i,
        /<(?:h[2-4])[^>]*>([\s\S]{2,100}?)<\/(?:h[2-4])>/i,
      ]);
      if (!name || name.length < 3) continue;

      const address = this.extractText(block, [
        /class="[^"]*(?:comp-address|addr|address|location)[^"]*"[^>]*>([\s\S]{2,200}?)</i,
        /itemprop="addressLocality"[^>]*>([\s\S]{2,100}?)</i,
      ]);

      const rawPhone = this.extractText(block, [
        /data-mobno=["']([0-9+\s-]{8,15})["']/i,
        /class="[^"]*(?:moblink|mobile|phone)[^"]*"[^>]*>([\s\S]{6,15}?)</i,
        /(?:tel:|Mobile:|Ph:)\s*([+\d\s-]{8,15})/i,
      ]);

      const gst = this.extractText(block, [
        /class="[^"]*gst[^"]*"[^>]*>([\s\S]{10,20}?)</i,
        /GST[^:]*:\s*([A-Z0-9]{15})/i,
      ]);

      const supplierUrl = block.match(/href=["'](https?:\/\/www\.indiamart\.com\/[a-z0-9-]+\/)["']/i)?.[1];
      const glid = block.match(/data-glid=["'](\d+)["']/i)?.[1];
      const phone = rawPhone ? this.normalizePhone(rawPhone.replace(/[^\d]/g, "")) : undefined;

      companies.push({
        name: this.cleanText(name),
        address: address ? this.cleanText(address) : "",
        phone: phone || undefined,
        glid,
        categories: [],
        supplierUrl,
        gstNumber: gst ? this.cleanText(gst) : undefined,
      });
    }

    return companies;
  }

  private async upsertVendors(companies: IndiaMartCompany[], importedBy: string): Promise<IndiamartImportResult> {
    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    const errors: { name: string; reason: string }[] = [];

    for (const company of companies) {
      if (!company.name) {
        skipped++;
        continue;
      }

      try {
        const existing = await this.prisma.vendor.findFirst({
          where: { shopName: { equals: company.name, mode: "insensitive" } },
          select: { id: true },
        });

        if (existing) {
          duplicates++;
          continue;
        }

        const whatsappNumber = this.resolvePhone(company);

        await this.prisma.vendor.create({
          data: {
            shopName: company.name,
            location: company.address || "Hyderabad",
            whatsappNumber,
            gstNumber: company.gstNumber,
            contactStatus: "NOT_CONTACTED",
            notes: this.buildNotes(company),
            categories: [],
            auditLogs: {
              create: { action: "INDIAMART_IMPORT", changedBy: importedBy },
            },
          },
        });

        imported++;
      } catch (err) {
        this.logger.error(`[indiamart-import] failed to create "${company.name}": ${String(err)}`);
        errors.push({ name: company.name, reason: String(err) });
        skipped++;
      }
    }

    this.logger.log(`[indiamart-import] done: imported=${imported} duplicates=${duplicates} skipped=${skipped} errors=${errors.length}`);

    return {
      imported,
      skipped,
      duplicates,
      errors,
      total: companies.length,
    };
  }

  /** Build a stable synthetic phone for vendors with no real number */
  private resolvePhone(company: IndiaMartCompany): string {
    if (company.phone) return company.phone;
    if (company.glid) {
      // +91 + GLID zero-padded to 10 digits — starts with 91 then 0s, clearly synthetic
      return `+91${company.glid.padStart(10, "0")}`;
    }
    // UUID-based fallback — first 10 hex digits of crypto random, prefixed with +919
    const rand = Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, "0");
    return `+919${rand}`;
  }

  private buildNotes(company: IndiaMartCompany): string {
    const parts: string[] = ["Imported from IndiaMart."];
    if (company.supplierUrl) parts.push(`Profile: ${company.supplierUrl}`);
    if (!company.phone) parts.push("Phone not available — number is synthetic placeholder.");
    if (company.categories.length) parts.push(`IndiaMart categories: ${company.categories.join(", ")}.`);
    return parts.join(" ");
  }

  private normalizePhone(digits: string): string {
    if (!digits) return "";
    // Strip leading country code 91
    if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
    if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
    return "";
  }

  private extractText(html: string, patterns: RegExp[]): string | undefined {
    for (const p of patterns) {
      const m = html.match(p);
      if (m) {
        const raw = (m[1] ?? m[0]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (raw.length > 1) return raw;
      }
    }
    return undefined;
  }

  private cleanText(s: string): string {
    return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
