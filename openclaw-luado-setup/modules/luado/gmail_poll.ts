import { google, type Auth, type gmail_v1 } from "googleapis";
import { parseLuadoEmail } from "./parser.js";
import {
  type GmailMessageSummary,
  type GmailPort,
  type LuadoStore,
  type TelegramPort,
} from "./types.js";

const DEFAULT_QUERY = "from:hei@luado.no newer_than:30d -label:ops/processed";
const DEFAULT_LABEL_NAME = "ops/processed";

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function extractPart(
  payload: gmail_v1.Schema$MessagePart | undefined,
  mimeType: string,
): string | null {
  if (!payload) {
    return null;
  }
  if (payload.mimeType === mimeType && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const nested = extractPart(part, mimeType);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class GoogleGmailPort implements GmailPort {
  private readonly api: gmail_v1.Gmail;
  private readonly userId: string;

  constructor(auth: Auth.OAuth2Client, userId: string = "me") {
    this.api = google.gmail({ version: "v1", auth });
    this.userId = userId;
  }

  async ensureProcessedLabel(labelName: string): Promise<string> {
    const listed = await this.api.users.labels.list({ userId: this.userId });
    const existing = listed.data.labels?.find((label) => label.name === labelName);
    if (existing?.id) {
      return existing.id;
    }

    const created = await this.api.users.labels.create({
      userId: this.userId,
      requestBody: {
        name: labelName,
        messageListVisibility: "show",
        labelListVisibility: "labelShow",
      },
    });

    if (!created.data.id) {
      throw new Error(`Could not create Gmail label: ${labelName}`);
    }
    return created.data.id;
  }

  async searchMessages(query: string): Promise<GmailMessageSummary[]> {
    const response = await this.api.users.messages.list({
      userId: this.userId,
      q: query,
      maxResults: 100,
    });
    return (response.data.messages ?? []).map((m) => ({
      id: m.id ?? "",
      threadId: m.threadId ?? null,
    }));
  }

  async getMessagePlainText(messageId: string): Promise<string | null> {
    const response = await this.api.users.messages.get({
      userId: this.userId,
      id: messageId,
      format: "full",
    });
    const payload = response.data.payload;
    const plain = extractPart(payload, "text/plain");
    if (plain) {
      return plain;
    }
    const html = extractPart(payload, "text/html");
    if (html) {
      return stripHtml(html);
    }
    return null;
  }

  async addLabel(messageId: string, labelId: string): Promise<void> {
    await this.api.users.messages.modify({
      userId: this.userId,
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
  }
}

export class LuadoGmailPoller {
  private readonly gmail: GmailPort;
  private readonly store: LuadoStore;
  private readonly telegram: TelegramPort;
  private readonly query: string;
  private readonly labelName: string;
  private labelId: string | null = null;

  constructor(params: {
    gmail: GmailPort;
    store: LuadoStore;
    telegram: TelegramPort;
    query?: string;
    labelName?: string;
  }) {
    this.gmail = params.gmail;
    this.store = params.store;
    this.telegram = params.telegram;
    this.query = params.query ?? DEFAULT_QUERY;
    this.labelName = params.labelName ?? DEFAULT_LABEL_NAME;
  }

  async pollOnce(): Promise<void> {
    if (!this.labelId) {
      this.labelId = await this.gmail.ensureProcessedLabel(this.labelName);
    }

    const messages = await this.gmail.searchMessages(this.query);
    for (const message of messages) {
      if (!message.id) {
        continue;
      }
      await this.processMessage(message);
    }
  }

  private async processMessage(message: GmailMessageSummary): Promise<void> {
    const rawText = await this.gmail.getMessagePlainText(message.id);
    if (!rawText) {
      if (this.labelId) {
        await this.gmail.addLabel(message.id, this.labelId);
      }
      return;
    }

    const parsed = parseLuadoEmail(rawText);
    if (parsed?.orderId) {
      const upserted = await this.store.upsertJob({
        ...parsed,
        gmailMessageId: message.id,
        gmailThreadId: message.threadId ?? null,
      });

      if (upserted.inserted) {
        await this.telegram.sendApprovalMessage(upserted.job);
      }
    }

    if (this.labelId) {
      await this.gmail.addLabel(message.id, this.labelId);
    }
  }
}

export const LUADO_GMAIL_QUERY = DEFAULT_QUERY;
export const LUADO_GMAIL_LABEL = DEFAULT_LABEL_NAME;
