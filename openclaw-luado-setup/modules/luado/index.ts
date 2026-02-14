import path from "node:path";
import { homedir } from "node:os";
import { config as loadEnv } from "dotenv";
import { GoogleCalendarPort, DEFAULT_CALENDAR_ID } from "./calendar.js";
import { PostgresLuadoStore } from "./db.js";
import {
  GoogleGmailPort,
  LUADO_GMAIL_LABEL,
  LUADO_GMAIL_QUERY,
  LuadoGmailPoller,
} from "./gmail_poll.js";
import { buildGoogleOAuthClient } from "./google_auth.js";
import { LuadoTelegramRouter } from "./router.js";
import { TelegramPollingPort } from "./telegram.js";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

async function main(): Promise<void> {
  loadEnv();
  loadEnv({ path: path.join(homedir(), ".openclaw", ".env") });

  const store = PostgresLuadoStore.fromEnv();
  await store.ensureSchema();

  const auth = buildGoogleOAuthClient();
  const gmail = new GoogleGmailPort(auth, process.env.LUADO_GMAIL_USER?.trim() || "me");
  const calendar = new GoogleCalendarPort(
    auth,
    process.env.LUADO_CALENDAR_ID?.trim() || DEFAULT_CALENDAR_ID,
  );
  const telegram = new TelegramPollingPort(
    requireEnv("TELEGRAM_BOT_TOKEN"),
    requireEnv("LUADO_TELEGRAM_CHAT_ID"),
  );

  const router = new LuadoTelegramRouter(store, calendar);
  const gmailPoller = new LuadoGmailPoller({
    gmail,
    store,
    telegram,
    query: process.env.LUADO_GMAIL_QUERY?.trim() || LUADO_GMAIL_QUERY,
    labelName: process.env.LUADO_GMAIL_LABEL?.trim() || LUADO_GMAIL_LABEL,
  });

  let pollInProgress = false;
  const runGmailPoll = async () => {
    if (pollInProgress) {
      return;
    }
    pollInProgress = true;
    try {
      await gmailPoller.pollOnce();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[luado][gmail] poll failed: ${message}`);
    } finally {
      pollInProgress = false;
    }
  };

  await telegram.startCallbackPolling(async (payload) => {
    const replyText = await router.handleCallback(payload);
    await telegram.answerCallbackQuery(payload.callbackId, replyText);
    await telegram.sendMessage(payload.chatId, replyText);
  });

  await runGmailPoll();
  const interval = setInterval(() => {
    void runGmailPoll();
  }, Number(process.env.LUADO_GMAIL_POLL_MS ?? FIVE_MINUTES_MS));

  const shutdown = async () => {
    clearInterval(interval);
    await telegram.stopCallbackPolling();
    await store.close();
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[luado] fatal: ${message}`);
  process.exitCode = 1;
});
