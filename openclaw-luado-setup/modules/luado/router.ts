import {
  type CalendarPort,
  type LuadoStore,
  type TelegramCallbackPayload,
} from "./types.js";

type CallbackAction = "approve" | "reject";

function parseCallbackData(data: string): { action: CallbackAction; orderId: string } | null {
  const match = data.match(/^luado:(approve|reject):(.+)$/);
  if (!match) {
    return null;
  }
  return {
    action: match[1] as CallbackAction,
    orderId: match[2].trim(),
  };
}

export class LuadoTelegramRouter {
  private readonly store: LuadoStore;
  private readonly calendar: CalendarPort;

  constructor(store: LuadoStore, calendar: CalendarPort) {
    this.store = store;
    this.calendar = calendar;
  }

  async handleCallback(payload: TelegramCallbackPayload): Promise<string> {
    const parsed = parseCallbackData(payload.data);
    if (!parsed) {
      return "Ugyldig handling.";
    }

    if (parsed.action === "approve") {
      const result = await this.store.approveJobWithCalendarEvent(
        parsed.orderId,
        async (job) => this.calendar.createLuadoEvent(job),
      );
      if (result.kind === "approved" || result.kind === "already_approved") {
        return "Lagt i kalender ✅";
      }
      return "Fant ikke jobb.";
    }

    const rejectResult = await this.store.rejectJob(parsed.orderId);
    if (rejectResult.kind === "rejected" || rejectResult.kind === "already_rejected") {
      return "Avvist ❌";
    }
    return "Fant ikke jobb.";
  }
}
