export const LUADO_SOURCE = "luado";
export const OSLO_TIMEZONE = "Europe/Oslo";

export type JobStatus = "new" | "approved" | "rejected" | "paid";

export interface ParsedLuadoJob {
  source: typeof LUADO_SOURCE;
  orderId: string;
  customerName: string | null;
  addressRaw: string | null;
  addressStreet: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  jobType: string | null;
  description: string | null;
  startLocal: string | null;
  endLocal: string | null;
  paymentNok: number | null;
  payoutNok: number | null;
}

export interface UpsertJobInput extends ParsedLuadoJob {
  gmailMessageId: string;
  gmailThreadId: string | null;
}

export interface JobRecord extends UpsertJobInput {
  id: number;
  status: JobStatus;
  calendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertJobResult {
  job: JobRecord;
  inserted: boolean;
}

export interface ApproveJobResult {
  kind: "not_found" | "already_approved" | "approved";
  job?: JobRecord;
  calendarEventId?: string;
}

export interface RejectJobResult {
  kind: "not_found" | "already_rejected" | "rejected";
  job?: JobRecord;
}

export interface LuadoStore {
  ensureSchema(): Promise<void>;
  close(): Promise<void>;
  upsertJob(input: UpsertJobInput): Promise<UpsertJobResult>;
  approveJobWithCalendarEvent(
    orderId: string,
    createCalendarEvent: (job: JobRecord) => Promise<string>,
  ): Promise<ApproveJobResult>;
  rejectJob(orderId: string): Promise<RejectJobResult>;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string | null;
}

export interface GmailPort {
  ensureProcessedLabel(labelName: string): Promise<string>;
  searchMessages(query: string): Promise<GmailMessageSummary[]>;
  getMessagePlainText(messageId: string): Promise<string | null>;
  addLabel(messageId: string, labelId: string): Promise<void>;
}

export interface TelegramCallbackPayload {
  callbackId: string;
  data: string;
  chatId: string;
  messageId: number | null;
  fromId: number | null;
}

export interface TelegramPort {
  sendApprovalMessage(job: JobRecord): Promise<void>;
  sendMessage(chatId: string, text: string): Promise<void>;
  answerCallbackQuery(callbackId: string, text: string): Promise<void>;
  startCallbackPolling(handler: (payload: TelegramCallbackPayload) => Promise<void>): Promise<void>;
  stopCallbackPolling(): Promise<void>;
}

export interface CalendarPort {
  createLuadoEvent(job: JobRecord): Promise<string>;
}
