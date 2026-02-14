import {
  type JobRecord,
  type TelegramCallbackPayload,
  type TelegramPort,
} from "./types.js";

type TelegramUpdate = {
  update_id: number;
  callback_query?: {
    id: string;
    data?: string;
    from?: { id?: number };
    message?: { message_id?: number; chat?: { id?: number | string } };
  };
};

type TelegramEnvelope<T> = {
  ok: boolean;
  result: T;
  description?: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localIsoToTime(localIso: string | null): string {
  if (!localIso) {
    return "--:--";
  }
  const match = localIso.match(/T(\d{2}):(\d{2})/);
  if (!match) {
    return "--:--";
  }
  return `${match[1]}:${match[2]}`;
}

function formatNok(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(value);
}

function toChatId(value: string): string {
  return value.trim();
}

export class TelegramPollingPort implements TelegramPort {
  private readonly token: string;
  private readonly targetChatId: string;
  private readonly baseUrl: string;
  private abortController: AbortController | null = null;
  private loopPromise: Promise<void> | null = null;
  private offset = 0;

  constructor(botToken: string, targetChatId: string) {
    this.token = botToken;
    this.targetChatId = toChatId(targetChatId);
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  async sendApprovalMessage(job: JobRecord): Promise<void> {
    const text = [
      `🛠 Luado - Jobb #${job.orderId}`,
      "",
      `Kunde: ${job.customerName ?? "-"}`,
      `Adresse: ${job.addressRaw ?? "-"}`,
      `Tid: ${localIsoToTime(job.startLocal)}-${localIsoToTime(job.endLocal)}`,
      `Betaling: ${formatNok(job.paymentNok)} kr`,
    ].join("\n");

    await this.call("sendMessage", {
      chat_id: this.targetChatId,
      text,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Godkjenn",
              callback_data: `luado:approve:${job.orderId}`,
            },
            {
              text: "❌ Avvis",
              callback_data: `luado:reject:${job.orderId}`,
            },
          ],
        ],
      },
    });
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.call("sendMessage", {
      chat_id: chatId,
      text,
    });
  }

  async answerCallbackQuery(callbackId: string, text: string): Promise<void> {
    await this.call("answerCallbackQuery", {
      callback_query_id: callbackId,
      text,
      show_alert: false,
    });
  }

  async startCallbackPolling(
    handler: (payload: TelegramCallbackPayload) => Promise<void>,
  ): Promise<void> {
    if (this.loopPromise) {
      return;
    }
    this.abortController = new AbortController();
    await this.call("deleteWebhook", { drop_pending_updates: false });
    this.loopPromise = this.pollLoop(handler, this.abortController.signal);
  }

  async stopCallbackPolling(): Promise<void> {
    if (!this.abortController) {
      return;
    }
    this.abortController.abort();
    if (this.loopPromise) {
      try {
        await this.loopPromise;
      } catch {
        // Ignore shutdown errors.
      }
    }
    this.abortController = null;
    this.loopPromise = null;
  }

  private async pollLoop(
    handler: (payload: TelegramCallbackPayload) => Promise<void>,
    signal: AbortSignal,
  ): Promise<void> {
    while (!signal.aborted) {
      try {
        const updates = await this.call<TelegramUpdate[]>("getUpdates", {
          offset: this.offset,
          timeout: 25,
          allowed_updates: ["callback_query"],
        });

        for (const update of updates) {
          if (signal.aborted) {
            return;
          }
          this.offset = Math.max(this.offset, update.update_id + 1);

          const callback = update.callback_query;
          if (!callback?.id || !callback.data || !callback.message?.chat?.id) {
            continue;
          }

          const payload: TelegramCallbackPayload = {
            callbackId: callback.id,
            data: callback.data,
            chatId: String(callback.message.chat.id),
            messageId: callback.message.message_id ?? null,
            fromId: callback.from?.id ?? null,
          };

          await handler(payload);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[luado][telegram] polling error: ${message}`);
        await sleep(3_000);
      }
    }
  }

  private async call<T = unknown>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as TelegramEnvelope<T>;
    if (!response.ok || !data.ok) {
      const details = data.description ? `: ${data.description}` : "";
      throw new Error(`Telegram API ${method} failed${details}`);
    }
    return data.result;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
