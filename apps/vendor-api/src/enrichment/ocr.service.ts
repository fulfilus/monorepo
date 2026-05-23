import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";

export interface OcrPriceItem {
  itemName: string;
  price: number | null;
  unit: string | null;
}

type SupportedImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const SUPPORTED_IMAGE_TYPES: SupportedImageType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const EXTRACT_SYSTEM = `You are a procurement assistant. Extract all product/item entries from this price list.
Return ONLY a JSON array. Each element: { "itemName": string, "price": number|null, "unit": string|null }.
- itemName: exact product name as written, normalised to Title Case
- price: numeric value only, no currency symbols (extract per-unit price where possible)
- unit: unit of measure if present (kg, pcs, litre, box, dozen, etc.); null if not stated
If a price is a range, use the lower value. Ignore headers, totals, and non-item rows.
Do not include any explanation — only the JSON array.`;

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });
  }

  async extractPriceList(buffer: Buffer, mimeType: string): Promise<OcrPriceItem[]> {
    if (mimeType === "application/pdf") {
      return this.extractFromPdf(buffer);
    }
    if ((SUPPORTED_IMAGE_TYPES as string[]).includes(mimeType)) {
      return this.extractFromImage(buffer, mimeType as SupportedImageType);
    }
    throw new BadRequestException(`Unsupported file type: ${mimeType}. Use JPEG, PNG, WebP, or PDF.`);
  }

  private async extractFromImage(buffer: Buffer, mimeType: SupportedImageType): Promise<OcrPriceItem[]> {
    const base64 = buffer.toString("base64");
    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: EXTRACT_SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
          { type: "text", text: "Extract all items and prices from this price list image. Return only the JSON array." },
        ],
      }],
    });
    return this.parse(response.content[0].type === "text" ? response.content[0].text : "[]");
  }

  private async extractFromPdf(buffer: Buffer): Promise<OcrPriceItem[]> {
    const base64 = buffer.toString("base64");
    // SDK doesn't export the document block type publicly; cast is safe — runtime shape is correct
    const docBlock = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf" as Anthropic.Base64PDFSource["media_type"], data: base64 },
    } as unknown as Anthropic.ContentBlockParam;
    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: EXTRACT_SYSTEM,
      messages: [{
        role: "user",
        content: [
          docBlock,
          { type: "text", text: "Extract all items and prices from this price list PDF. Return only the JSON array." },
        ],
      }],
    });
    return this.parse(response.content[0].type === "text" ? response.content[0].text : "[]");
  }

  private parse(raw: string): OcrPriceItem[] {
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]) as unknown;
      if (!Array.isArray(parsed)) return [];
      return (parsed as unknown[]).filter((i): i is OcrPriceItem =>
        typeof i === "object" && i !== null && "itemName" in i &&
        typeof (i as { itemName: unknown }).itemName === "string",
      );
    } catch {
      this.logger.warn(`[ocr] parse failed on: ${raw.substring(0, 200)}`);
      return [];
    }
  }
}
