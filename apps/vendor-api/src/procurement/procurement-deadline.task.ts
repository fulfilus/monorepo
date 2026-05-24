import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";

@Injectable()
export class ProcurementDeadlineTask {
  private readonly logger = new Logger(ProcurementDeadlineTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendDeadlineReminders(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const reminderCooloff = new Date(now.getTime() - 22 * 60 * 60 * 1000);

    const rounds = await this.prisma.procurementRound.findMany({
      where: {
        status: "OPEN",
        deadline: { gte: now, lte: in24h },
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: reminderCooloff } }],
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        vendorBids: {
          where: { status: { in: ["PENDING", "SENT"] } },
          include: { vendor: { select: { whatsappNumber: true, shopName: true } } },
        },
      },
    });

    for (const round of rounds) {
      const pendingBids = round.vendorBids.filter(b => b.vendor.whatsappNumber);
      if (pendingBids.length === 0) continue;

      const deadline = round.deadline!;
      const hoursLeft = Math.round((deadline.getTime() - now.getTime()) / (60 * 60 * 1000));
      const itemLines = round.items.map((item, i) => {
        let line = `${i + 1}. ${item.itemName}`;
        if (item.quantity) line += ` x${item.quantity}`;
        if (item.unit) line += ` ${item.unit}`;
        return line;
      }).join("\n");

      const message =
        `*REMINDER — RFQ closes in ${hoursLeft}h: ${round.title}*\n\n` +
        `We have not received your prices yet. Please reply urgently for:\n\n` +
        `${itemLines}\n\n` +
        `Deadline: ${deadline.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;

      let sent = 0;
      for (const bid of pendingBids) {
        const phone = bid.vendor.whatsappNumber!;
        try {
          await this.whatsapp.sendMessage(phone, message);
          sent++;
          this.logger.log(`[deadline-reminder] sent to ${bid.vendor.shopName} for round ${round.id}`);
        } catch (err) {
          this.logger.error(`[deadline-reminder] failed for ${bid.vendor.shopName}: ${String(err)}`);
        }
      }

      if (sent > 0) {
        await this.prisma.procurementRound.update({
          where: { id: round.id },
          data: { lastReminderAt: now },
        });
        this.logger.log(`[deadline-reminder] round ${round.id}: reminded ${sent}/${pendingBids.length} vendors`);
      }
    }
  }
}
