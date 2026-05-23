import { Controller, forwardRef, Get, HttpCode, Inject, Logger, Post, Query, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaService } from "../common/prisma.service";
import { InboundService } from "../inbound/inbound.service";
import { WhatsappService } from "./whatsapp.service";

interface WaMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
}

interface WebhookBody {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: { messages?: WaMessage[] };
    }>;
  }>;
}

@ApiTags("whatsapp")
@Controller("whatsapp")
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);
  private readonly verifyToken = process.env["WHATSAPP_VERIFY_TOKEN"] ?? "fulfilus-verify";

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => InboundService)) private readonly inboundService: InboundService,
  ) {}

  @Get("webhook")
  verify(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
    @Res() reply: FastifyReply,
  ) {
    if (mode === "subscribe" && token === this.verifyToken) {
      this.logger.log("[wa] webhook verified");
      reply.status(200).send(challenge);
    } else {
      reply.status(403).send("Forbidden");
    }
  }

  @Post("webhook")
  @HttpCode(200)
  async incoming(@Req() req: FastifyRequest): Promise<string> {
    const body = req.body as WebhookBody;

    if (body?.object !== "whatsapp_business_account") return "ok";

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          if (!msg.from || !msg.id) continue;
          this.routeMessage(msg).catch(err => {
            this.logger.error(`[wa] routeMessage error: ${String(err)}`);
          });
        }
      }
    }

    return "ok";
  }

  private async routeMessage(msg: WaMessage): Promise<void> {
    const from = msg.from!;
    const msgId = msg.id!;

    const isCustomer = await this.isKnownCustomer(from);

    if (isCustomer) {
      if (msg.type === "text" && msg.text?.body) {
        await this.inboundService.processMessage(msgId, from, "text", msg.text.body);
      } else if (msg.type === "image" && msg.image?.id) {
        await this.inboundService.processMessage(msgId, from, "image", undefined, msg.image.id);
      } else {
        this.logger.warn(`[wa] customer ${from} sent unsupported type: ${msg.type}`);
      }
      return;
    }

    // Vendor onboarding flow (text only)
    if (msg.type === "text" && msg.text?.body) {
      await this.whatsappService.handleIncoming(from, msg.text.body);
    }
  }

  private async isKnownCustomer(fromNumber: string): Promise<boolean> {
    const normalized = fromNumber.replace(/[\s\-().]/g, "");
    const customer = await this.prisma.customer.findFirst({
      where: {
        OR: [
          { phone: { contains: normalized.slice(-10) } },
          { phone: fromNumber },
        ],
      },
      select: { id: true },
    });
    return customer !== null;
  }
}
