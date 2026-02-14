import { google, type Auth, type calendar_v3 } from "googleapis";
import { OSLO_TIMEZONE, type CalendarPort, type JobRecord } from "./types.js";

export const DEFAULT_CALENDAR_ID =
  "5a3a14a40b4a30af2438bb4a41338047f8e42201208ceaf23e2bad4222a69107@group.calendar.google.com";

function addOneHour(localIso: string): string {
  const dt = new Date(`${localIso}Z`);
  if (Number.isNaN(dt.getTime())) {
    return localIso;
  }
  dt.setUTCMinutes(dt.getUTCMinutes() + 60);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  const h = String(dt.getUTCHours()).padStart(2, "0");
  const min = String(dt.getUTCMinutes()).padStart(2, "0");
  const sec = String(dt.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}:${sec}`;
}

export class GoogleCalendarPort implements CalendarPort {
  private readonly api: calendar_v3.Calendar;
  private readonly calendarId: string;

  constructor(auth: Auth.OAuth2Client, calendarId: string = DEFAULT_CALENDAR_ID) {
    this.api = google.calendar({ version: "v3", auth });
    this.calendarId = calendarId;
  }

  async createLuadoEvent(job: JobRecord): Promise<string> {
    if (!job.startLocal) {
      throw new Error(`Job ${job.orderId} is missing start_local`);
    }

    const endLocal = job.endLocal ?? addOneHour(job.startLocal);
    const summary = `[AUTO] Luado – ${job.customerName ?? "Ukjent"} (#${job.orderId})`;

    const response = await this.api.events.insert({
      calendarId: this.calendarId,
      requestBody: {
        summary,
        location: job.addressRaw ?? undefined,
        transparency: "opaque",
        colorId: "11",
        start: {
          dateTime: job.startLocal,
          timeZone: OSLO_TIMEZONE,
        },
        end: {
          dateTime: endLocal,
          timeZone: OSLO_TIMEZONE,
        },
      },
    });

    const eventId = response.data.id;
    if (!eventId) {
      throw new Error(`Calendar event insert returned no event id for order ${job.orderId}`);
    }
    return eventId;
  }
}
