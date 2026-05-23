import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { PrismaService } from "../common/prisma.service";

const MODEL_ID = "claude-sonnet-4-6";

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly anthropic: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.anthropic = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });
  }

  async create(vendorId: string, filePath: string, filename: string, mimeType: string, sizeBytes: number) {
    const doc = await this.prisma.document.create({
      data: {
        vendorId,
        type: this.inferDocType(filename),
        url: filePath,
        mimeType,
        sizeBytes,
      },
    });

    this.extractOcr(doc.id, filePath, mimeType).catch(err => {
      this.logger.error(`[ocr] background extraction failed for doc ${doc.id}: ${String(err)}`);
    });

    return doc;
  }

  findByVendor(vendorId: string) {
    return this.prisma.document.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
    });
  }

  async remove(vendorId: string, docId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id: docId, vendorId } });
    if (!doc) throw new NotFoundException(`Document ${docId} not found`);
    await this.prisma.document.delete({ where: { id: docId } });
  }

  private inferDocType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes("invoice")) return "INVOICE";
    if (lower.includes("gst") || lower.includes("gstin")) return "GST_CERTIFICATE";
    if (lower.includes("license") || lower.includes("licence")) return "LICENSE";
    if (lower.includes("pan")) return "PAN_CARD";
    const ext = extname(lower);
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return "PHOTO";
    return "OTHER";
  }

  private async extractOcr(docId: string, filePath: string, mimeType: string): Promise<void> {
    const supportedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!supportedImageTypes.includes(mimeType)) {
      this.logger.log(`[ocr] skipping non-image document ${docId} (${mimeType})`);
      return;
    }

    const fullPath = filePath.startsWith("/") ? filePath : `${process.cwd()}${filePath}`;
    const imageData = readFileSync(fullPath).toString("base64");
    const mediaType = mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const msg = await this.anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageData },
          },
          {
            type: "text",
            text: "Extract all text from this document. Focus on: business name, address, GST number, phone numbers, dates, amounts. Return as plain text.",
          },
        ],
      }],
    });

    const textBlock = msg.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return;

    this.logger.log(`[ocr] extracted ${textBlock.text.length} chars for doc ${docId}`);
  }
}
