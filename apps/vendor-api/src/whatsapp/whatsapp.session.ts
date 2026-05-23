import { VendorCategory } from "@fulfilus/shared";

export type OnboardingStep =
  | "WELCOME"
  | "SHOP_NAME"
  | "LOCATION"
  | "WHATSAPP"
  | "CATEGORIES"
  | "CONFIRM"
  | "DONE";

export interface OnboardingSession {
  step: OnboardingStep;
  shopName?: string;
  location?: string;
  whatsappNumber?: string;
  categories?: VendorCategory[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
  updatedAt: number;
}

export class SessionStore {
  private readonly sessions = new Map<string, OnboardingSession>();
  private readonly TTL_MS = 30 * 60 * 1000;

  get(phone: string): OnboardingSession {
    const existing = this.sessions.get(phone);
    if (existing && Date.now() - existing.updatedAt < this.TTL_MS) {
      return existing;
    }
    const fresh: OnboardingSession = { step: "WELCOME", history: [], updatedAt: Date.now() };
    this.sessions.set(phone, fresh);
    return fresh;
  }

  set(phone: string, session: OnboardingSession): void {
    this.sessions.set(phone, { ...session, updatedAt: Date.now() });
  }

  clear(phone: string): void {
    this.sessions.delete(phone);
  }
}
