import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma.service";

@Injectable()
export class QuotationExpiryTask {
  private readonly logger = new Logger(QuotationExpiryTask.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireQuotations(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.quotation.updateMany({
      where: {
        status: { in: ["SENT", "RECEIVED"] },
        validUntil: { lt: now, not: null },
      },
      data: { status: "EXPIRED" },
    });
    if (result.count > 0) {
      this.logger.log(`[expiry] marked ${result.count} quotation(s) as EXPIRED`);
    }
  }
}
