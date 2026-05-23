import "@fastify/multipart";
import { BadRequestException, Body, Controller, Get, InternalServerErrorException, NotFoundException, Param, Post, Req, UsePipes, ValidationPipe } from "@nestjs/common";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { EnrichFromIndiamartUrlDto, EnrichFromJustdialUrlDto, EnrichFromMapsUrlDto } from "./enrichment.dto";
import { EnrichmentService } from "./enrichment.service";
import { IndiamartService } from "./indiamart.service";
import { JustdialService } from "./justdial.service";
import { OcrService } from "./ocr.service";

@ApiTags("enrich")
@Controller("enrich")
@UsePipes(new ValidationPipe({ whitelist: true }))
export class EnrichmentController {
  constructor(
    private readonly enrichmentService: EnrichmentService,
    private readonly indiamartService: IndiamartService,
    private readonly justdialService: JustdialService,
    private readonly ocrService: OcrService,
  ) {}

  @Post("maps-url")
  async enrichFromMapsUrl(@Body() dto: EnrichFromMapsUrlDto) {
    const jobId = await this.enrichmentService.startEnrichmentJob(dto.mapsUrl);
    return { jobId, status: "PENDING" };
  }

  @Post("indiamart-url")
  async enrichFromIndiamartUrl(@Body() dto: EnrichFromIndiamartUrlDto) {
    if (!dto.url.includes("indiamart.com")) {
      throw new BadRequestException("URL must be from indiamart.com");
    }
    try {
      return await this.indiamartService.enrichFromUrl(dto.url);
    } catch (err) {
      throw new InternalServerErrorException(String(err));
    }
  }

  @Post("justdial-url")
  async enrichFromJustdialUrl(@Body() dto: EnrichFromJustdialUrlDto) {
    if (!dto.url.includes("justdial.com")) {
      throw new BadRequestException("URL must be from justdial.com");
    }
    try {
      return await this.justdialService.enrichFromUrl(dto.url);
    } catch (err) {
      throw new InternalServerErrorException(String(err));
    }
  }

  @Post("ocr-price-list")
  @ApiConsumes("multipart/form-data")
  async ocrPriceList(@Req() req: FastifyRequest) {
    const part = await req.file();
    if (!part) throw new BadRequestException("No file uploaded");
    const chunks: Buffer[] = [];
    for await (const chunk of part.file) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) throw new BadRequestException("Empty file");
    const items = await this.ocrService.extractPriceList(buffer, part.mimetype);
    return { items, count: items.length };
  }

  @Get("jobs/:id")
  async getJob(@Param("id") id: string) {
    const job = await this.enrichmentService.getJob(id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }
}
