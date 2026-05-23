import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { ContactStatus, VendorCategory } from "@fulfilus/shared";
import { VendorService } from "../vendor/vendor.service";
import { OnboardingSession, OnboardingStep, SessionStore } from "./whatsapp.session";

const MODEL_ID = "claude-sonnet-4-6";
const ALL_CATEGORIES = Object.values(VendorCategory);

const SYSTEM_PROMPT = `You are a friendly vendor onboarding assistant for Fulfilus, an industrial supply platform.
Your job is to collect the following vendor information through a WhatsApp conversation:
1. Shop name
2. Shop location / address
3. WhatsApp number (for business contact)
4. Categories (from the list: ${ALL_CATEGORIES.join(", ")})

Rules:
- Be concise and friendly. Messages must be under 200 characters when possible.
- Guide the user step by step. Only ask for one piece of information at a time.
- When the user provides information, confirm it briefly and move to the next step.
- For categories, show a short numbered list and let the user pick by number or name.
- When all data is collected, summarize and ask for confirmation (yes/no).
- If the user says "restart" or "start over", reset the session.
- Respond in the same language the user uses (English or Hindi).

Always respond with a JSON object: { "reply": "<message to send>", "extracted": { ... }, "step": "<next step>" }
Steps: SHOP_NAME, LOCATION, WHATSAPP, CATEGORIES, CONFIRM, DONE`;

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly anthropic: Anthropic;
  private readonly store = new SessionStore();
  private readonly apiToken = process.env["WHATSAPP_API_TOKEN"] ?? "";
  private readonly phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"] ?? "";
  private readonly graphBase = "https://graph.facebook.com/v19.0";

  constructor(private readonly vendorService: VendorService) {
    this.anthropic = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });
  }

  async handleIncoming(from: string, messageBody: string): Promise<void> {
    const session = this.store.get(from);
    this.logger.log(`[wa] from=${from} step=${session.step} msg="${messageBody}"`);

    if (/^(restart|start over|reset)$/i.test(messageBody.trim())) {
      this.store.clear(from);
      await this.sendMessage(from, "Starting over! What is the name of your shop?");
      this.store.set(from, { step: "SHOP_NAME", history: [], updatedAt: Date.now() });
      return;
    }

    if (session.step === "WELCOME") {
      session.step = "SHOP_NAME";
      await this.sendMessage(from, "Welcome to Fulfilus vendor onboarding! What is the name of your shop?");
      this.store.set(from, session);
      return;
    }

    if (session.step === "DONE") {
      await this.sendMessage(from, "Your vendor profile is already registered! Reply *restart* to add another.");
      return;
    }

    session.history.push({ role: "user", content: messageBody });

    const contextMessage = `Current session state:
Step: ${session.step}
Shop Name: ${session.shopName ?? "not provided"}
Location: ${session.location ?? "not provided"}
WhatsApp: ${session.whatsappNumber ?? "not provided"}
Categories: ${session.categories?.join(", ") ?? "not provided"}

User just said: "${messageBody}"

Based on the current step and user message, extract relevant information and determine the next step.`;

    let parsed: { reply: string; extracted: Record<string, unknown>; step: OnboardingStep };
    try {
      const msg = await this.anthropic.messages.create({
        model: MODEL_ID,
        max_tokens: 512,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [...session.history.slice(-6).map(h => ({ role: h.role, content: h.content })),
          { role: "user", content: contextMessage }],
      });
      const text = msg.content.find(b => b.type === "text");
      if (!text || text.type !== "text") throw new Error("No text response");
      const json = text.text.replace(/^```(?:json)?\s*|```\s*$/g, "").trim();
      parsed = JSON.parse(json) as typeof parsed;
    } catch (err) {
      this.logger.error(`[wa] Claude error: ${String(err)}`);
      await this.sendMessage(from, "Sorry, I had a hiccup. Please try again.");
      return;
    }

    const { reply, extracted, step } = parsed;

    if (extracted["shopName"]) session.shopName = String(extracted["shopName"]);
    if (extracted["location"]) session.location = String(extracted["location"]);
    if (extracted["whatsappNumber"]) session.whatsappNumber = String(extracted["whatsappNumber"]);
    if (Array.isArray(extracted["categories"])) {
      session.categories = (extracted["categories"] as string[]).filter(
        c => ALL_CATEGORIES.includes(c as VendorCategory),
      ) as VendorCategory[];
    }

    session.step = step;
    session.history.push({ role: "assistant", content: reply });
    this.store.set(from, session);

    await this.sendMessage(from, reply);

    if (step === "DONE" && session.shopName && session.location) {
      await this.createVendor(from, session);
    }
  }

  private async createVendor(phone: string, session: OnboardingSession): Promise<void> {
    try {
      const vendor = await this.vendorService.create({
        shopName: session.shopName!,
        location: session.location!,
        whatsappNumber: session.whatsappNumber ?? phone.replace(/\D/g, ""),
        categories: session.categories ?? [],
        contactStatus: ContactStatus.NOT_CONTACTED,
        notes: `Onboarded via WhatsApp (${phone})`,
      }, "whatsapp-bot");
      this.logger.log(`[wa] created vendor ${vendor.id} for ${phone}`);
    } catch (err) {
      this.logger.error(`[wa] failed to create vendor: ${String(err)}`);
      await this.sendMessage(phone, "There was an error saving your profile. Our team will follow up.");
    }
  }

  async sendMessage(to: string, body: string): Promise<void> {
    if (!this.apiToken || !this.phoneNumberId) {
      this.logger.warn("[wa] WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set — skipping send");
      return;
    }
    const url = `${this.graphBase}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiToken}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`[wa] send failed ${res.status}: ${err}`);
      }
    } catch (err) {
      this.logger.error(`[wa] send error: ${String(err)}`);
    }
  }
}
