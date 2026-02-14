import { describe, expect, it } from "vitest";
import { LuadoGmailPoller } from "../gmail_poll.js";
import { parseLuadoEmail } from "../parser.js";
import { LuadoTelegramRouter } from "../router.js";
import {
  LUADO_SOURCE,
  type ApproveJobResult,
  type CalendarPort,
  type GmailMessageSummary,
  type GmailPort,
  type JobRecord,
  type LuadoStore,
  type RejectJobResult,
  type TelegramCallbackPayload,
  type TelegramPort,
  type UpsertJobInput,
  type UpsertJobResult,
} from "../types.js";

class MemoryStore implements LuadoStore {
  private readonly byOrder = new Map<string, JobRecord>();
  private nextId = 1;

  async ensureSchema(): Promise<void> {}

  async close(): Promise<void> {}

  async upsertJob(input: UpsertJobInput): Promise<UpsertJobResult> {
    const existing = this.byOrder.get(input.orderId);
    if (existing) {
      const updated: JobRecord = {
        ...existing,
        ...input,
        status: existing.status,
        calendarEventId: existing.calendarEventId,
        updatedAt: new Date().toISOString(),
      };
      this.byOrder.set(input.orderId, updated);
      return { job: updated, inserted: false };
    }

    const now = new Date().toISOString();
    const created: JobRecord = {
      id: this.nextId++,
      status: "new",
      calendarEventId: null,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.byOrder.set(input.orderId, created);
    return { job: created, inserted: true };
  }

  async approveJobWithCalendarEvent(
    orderId: string,
    createCalendarEvent: (job: JobRecord) => Promise<string>,
  ): Promise<ApproveJobResult> {
    const job = this.byOrder.get(orderId);
    if (!job) {
      return { kind: "not_found" };
    }
    if (job.calendarEventId) {
      return {
        kind: "already_approved",
        job,
        calendarEventId: job.calendarEventId,
      };
    }

    const eventId = await createCalendarEvent(job);
    const updated: JobRecord = {
      ...job,
      status: "approved",
      calendarEventId: eventId,
      updatedAt: new Date().toISOString(),
    };
    this.byOrder.set(orderId, updated);
    return { kind: "approved", job: updated, calendarEventId: eventId };
  }

  async rejectJob(orderId: string): Promise<RejectJobResult> {
    const job = this.byOrder.get(orderId);
    if (!job) {
      return { kind: "not_found" };
    }
    if (job.status === "rejected") {
      return { kind: "already_rejected", job };
    }
    const updated: JobRecord = {
      ...job,
      status: "rejected",
      updatedAt: new Date().toISOString(),
    };
    this.byOrder.set(orderId, updated);
    return { kind: "rejected", job: updated };
  }

  size(): number {
    return this.byOrder.size;
  }
}

class FakeGmailPort implements GmailPort {
  private readonly messages = new Map<string, { body: string; threadId: string | null }>();
  private readonly processed = new Set<string>();

  constructor(seed: Array<{ id: string; threadId: string | null; body: string }>) {
    for (const message of seed) {
      this.messages.set(message.id, { body: message.body, threadId: message.threadId });
    }
  }

  async ensureProcessedLabel(_labelName: string): Promise<string> {
    return "label-ops-processed";
  }

  async searchMessages(_query: string): Promise<GmailMessageSummary[]> {
    const out: GmailMessageSummary[] = [];
    for (const [id, value] of this.messages.entries()) {
      if (!this.processed.has(id)) {
        out.push({ id, threadId: value.threadId });
      }
    }
    return out;
  }

  async getMessagePlainText(messageId: string): Promise<string | null> {
    return this.messages.get(messageId)?.body ?? null;
  }

  async addLabel(messageId: string, _labelId: string): Promise<void> {
    this.processed.add(messageId);
  }
}

class FakeTelegramPort implements TelegramPort {
  readonly approvals: JobRecord[] = [];
  readonly sentMessages: Array<{ chatId: string; text: string }> = [];
  readonly callbackAnswers: Array<{ callbackId: string; text: string }> = [];

  async sendApprovalMessage(job: JobRecord): Promise<void> {
    this.approvals.push(job);
  }
  async sendMessage(chatId: string, text: string): Promise<void> {
    this.sentMessages.push({ chatId, text });
  }
  async answerCallbackQuery(callbackId: string, text: string): Promise<void> {
    this.callbackAnswers.push({ callbackId, text });
  }
  async startCallbackPolling(
    _handler: (payload: TelegramCallbackPayload) => Promise<void>,
  ): Promise<void> {}
  async stopCallbackPolling(): Promise<void> {}
}

class FakeCalendarPort implements CalendarPort {
  readonly createdOrderIds: string[] = [];

  async createLuadoEvent(job: JobRecord): Promise<string> {
    this.createdOrderIds.push(job.orderId);
    return `evt_${this.createdOrderIds.length}`;
  }
}

const SAMPLE_MAIL = `
Luado-jobb Nr. 79775
Kjøper: Linh Do
Type jobb: Flyttehjelp
Adresse: Nedre Ullern Terrasse 15B, 0280 Oslo
Starttid: 14.02.2026 kl. 09:00
Avsluttes: 14.02.2026 kl. 19:00
Betaling: Kr 4 962
`;

const SAMPLE_MAIL_DUPLICATE = `
Luado-jobb Nr. 79775
Kjøper: Linh Do
Type jobb: Flyttehjelp
Adresse: Nedre Ullern Terrasse 15B, 0280 Oslo
Starttid: 14.02.2026 kl. 09:00
Avsluttes: 14.02.2026 kl. 19:00
Betaling: Kr 4 962
`;

function seedStoreWithOneJob(): MemoryStore {
  const parsed = parseLuadoEmail(SAMPLE_MAIL);
  if (!parsed) {
    throw new Error("failed to parse seed mail");
  }
  const store = new MemoryStore();
  void store.upsertJob({
    ...parsed,
    source: LUADO_SOURCE,
    gmailMessageId: "seed-msg",
    gmailThreadId: "seed-thread",
  });
  return store;
}

describe("Luado phase 1 flow", () => {
  it("New job mail -> Telegram appears", async () => {
    const store = new MemoryStore();
    const telegram = new FakeTelegramPort();
    const gmail = new FakeGmailPort([
      { id: "m1", threadId: "t1", body: SAMPLE_MAIL },
    ]);

    const poller = new LuadoGmailPoller({ gmail, store, telegram });
    await poller.pollOnce();

    expect(telegram.approvals).toHaveLength(1);
    expect(telegram.approvals[0].orderId).toBe("79775");
  });

  it("Approve -> Calendar event created", async () => {
    const store = seedStoreWithOneJob();
    const calendar = new FakeCalendarPort();
    const router = new LuadoTelegramRouter(store, calendar);

    const reply = await router.handleCallback({
      callbackId: "cb1",
      data: "luado:approve:79775",
      chatId: "12345",
      messageId: 1,
      fromId: 99,
    });

    expect(reply).toBe("Lagt i kalender ✅");
    expect(calendar.createdOrderIds).toEqual(["79775"]);
  });

  it("Reject -> No calendar event", async () => {
    const store = seedStoreWithOneJob();
    const calendar = new FakeCalendarPort();
    const router = new LuadoTelegramRouter(store, calendar);

    const reply = await router.handleCallback({
      callbackId: "cb2",
      data: "luado:reject:79775",
      chatId: "12345",
      messageId: 2,
      fromId: 99,
    });

    expect(reply).toBe("Avvist ❌");
    expect(calendar.createdOrderIds).toHaveLength(0);
  });

  it("Duplicate mail -> no duplicate job", async () => {
    const store = new MemoryStore();
    const telegram = new FakeTelegramPort();
    const gmail = new FakeGmailPort([
      { id: "m1", threadId: "t1", body: SAMPLE_MAIL },
      { id: "m2", threadId: "t1", body: SAMPLE_MAIL_DUPLICATE },
    ]);

    const poller = new LuadoGmailPoller({ gmail, store, telegram });
    await poller.pollOnce();

    expect(store.size()).toBe(1);
    expect(telegram.approvals).toHaveLength(1);
  });

  it("Restart -> no double creation on repeated approve callback", async () => {
    const store = seedStoreWithOneJob();
    const calendar = new FakeCalendarPort();
    const router = new LuadoTelegramRouter(store, calendar);

    await router.handleCallback({
      callbackId: "cb3",
      data: "luado:approve:79775",
      chatId: "12345",
      messageId: 3,
      fromId: 99,
    });

    await router.handleCallback({
      callbackId: "cb4",
      data: "luado:approve:79775",
      chatId: "12345",
      messageId: 4,
      fromId: 99,
    });

    expect(calendar.createdOrderIds).toHaveLength(1);
  });
});
