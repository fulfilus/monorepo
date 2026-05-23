import "@fastify/multipart";
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { createWriteStream } from "node:fs";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { DocumentService } from "./document.service";

@ApiTags("documents")
@Controller("vendors/:vendorId/documents")
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get()
  findAll(@Param("vendorId") vendorId: string) {
    return this.documentService.findByVendor(vendorId);
  }

  @Post()
  @ApiConsumes("multipart/form-data")
  async upload(@Param("vendorId") vendorId: string, @Req() req: FastifyRequest) {
    const part = await req.file();
    if (!part) throw new BadRequestException("No file uploaded");

    const ext = extname(part.filename) || ".bin";
    const filename = `${randomUUID()}${ext}`;
    const dest = join(process.cwd(), "uploads", filename);

    let sizeBytes = 0;
    const countingStream = part.file;
    countingStream.on("data", (chunk: Buffer) => { sizeBytes += chunk.length; });
    await pipeline(countingStream, createWriteStream(dest));

    return this.documentService.create(
      vendorId,
      `/uploads/${filename}`,
      part.filename,
      part.mimetype,
      sizeBytes,
    );
  }

  @Delete(":docId")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("vendorId") vendorId: string, @Param("docId") docId: string) {
    return this.documentService.remove(vendorId, docId);
  }
}
