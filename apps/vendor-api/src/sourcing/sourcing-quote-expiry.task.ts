import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";

@Injectable()
export class SourcingQuoteExpiryTask {
  private readonly logger = new Logger(SourcingQuoteExpiryTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runExpiryAndNotify(): Promise<void> {
    await this.expireStaleQuotes();
    await this.sendExpiryWarnings();
  }

  private async expireStaleQuotes(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.sourcingQuote.updateMany({
      where: { status: "SENT", validUntil: { lt: now, not: null } },
      data: { status: "EXPIRED" },
    });
    if (result.count > 0) {
      this.logger.log(`[sourcing-expiry] marked ${result.count} sourcing quote(s) as EXPIRED`);
    }
  }

  private async sendExpiryWarnings(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const alreadyNotifiedNotes = "expiry-warning";

    const quotes = await this.prisma.sourcingQuote.findMany({
      where: {
        status: "SENT",
        validUntil: { gte: now, lte: in24h },
      },
      include: {
        sends: { where: { notes: alreadyNotifiedNotes } },
      },
    });

    for (const quote of quotes) {
      if (quote.sends.length > 0) continue; // already warned
      if (!quote.customerPhone) continue;

      const hoursLeft = Math.round((quote.validUntil!.getTime() - now.getTime()) / (60 * 60 * 1000));
      const name = quote.customerName ?? "there";
      const message =
        `Hi ${name}! Your quote *${quote.referenceNumber}* expires in ${hoursLeft} hour(s).\n\n` +
        `Reply *YES* to confirm your order before it expires.`;

      try {
        await this.whatsapp.sendMessage(quote.customerPhone, message);
        await this.prisma.sourcingQuoteSend.create({
          data: { quoteId: quote.id, method: "WHATSAPP", sentBy: "system", notes: alreadyNotifiedNotes },
        });
        this.logger.log(`[sourcing-expiry] expiry warning sent for quote ${quote.id}`);
      } catch (err) {
        this.logger.error(`[sourcing-expiry] warning send failed for quote ${quote.id}: ${String(err)}`);
      }
    }
  }
}
