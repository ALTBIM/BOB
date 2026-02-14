import { LUADO_SOURCE, type ParsedLuadoJob } from "./types.js";

const ORDER_ID_RE = /Luado-jobb\s*Nr\.?\s*(\d+)/i;
const CUSTOMER_RE = /Kjøper:\s*([^\r\n]+)/i;
const JOB_TYPE_RE = /Type jobb:\s*([^\r\n]+)/i;
const ADDRESS_RE = /Adresse:\s*([^\r\n]+)/i;
const START_RE = /Starttid:\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*kl\.?\s*(\d{1,2}:\d{2})/i;
const END_RE = /Avsluttes:\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*kl\.?\s*(\d{1,2}:\d{2})/i;
const DURATION_RE = /Varighet:\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:time|timer)/i;
const PAYMENT_RE = /Betaling:\s*Kr\s*([0-9\s.,]+)/i;
const PAYOUT_RE = /Utbetaling:\s*Kr\s*([0-9\s.,]+)/i;
const DESCRIPTION_RE = /Beskrivelse:\s*([^\r\n]+)/i;

function capture(text: string, regex: RegExp): string | null {
  const match = text.match(regex);
  if (!match || !match[1]) {
    return null;
  }
  return match[1].trim().replace(/\s+/g, " ");
}

function normalizeTime(timeText: string): string {
  const [hoursRaw, minutesRaw] = timeText.split(":");
  const hours = hoursRaw.padStart(2, "0");
  return `${hours}:${minutesRaw}`;
}

function toLocalIso(dateText: string, timeText: string): string {
  const [dayRaw, monthRaw, yearRaw] = dateText.split(".");
  const day = dayRaw.padStart(2, "0");
  const month = monthRaw.padStart(2, "0");
  return `${yearRaw}-${month}-${day}T${normalizeTime(timeText)}:00`;
}

function addHoursToLocalIso(localIso: string, hours: number): string {
  const match = localIso.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) {
    return localIso;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  const baseUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const totalMinutes = Math.round(hours * 60);
  const next = new Date(baseUtc + totalMinutes * 60_000);

  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  const h = String(next.getUTCHours()).padStart(2, "0");
  const min = String(next.getUTCMinutes()).padStart(2, "0");
  const sec = String(next.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}:${sec}`;
}

function parseNorwegianNumber(raw: string | null): number | null {
  if (!raw) {
    return null;
  }
  let normalized = raw.replace(/\s+/g, "");
  if (!normalized) {
    return null;
  }

  const hasDot = normalized.includes(".");
  const hasComma = normalized.includes(",");

  if (hasDot && hasComma) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = normalized.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else {
    normalized = normalized.replace(/\./g, "");
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseDurationHours(text: string): number | null {
  const raw = capture(text, DURATION_RE);
  if (!raw) {
    return null;
  }
  const value = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function splitAddress(rawAddress: string | null): {
  addressStreet: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
} {
  if (!rawAddress) {
    return {
      addressStreet: null,
      addressPostalCode: null,
      addressCity: null,
    };
  }

  const normalized = rawAddress.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.*?)(?:,\s*)?(\d{4})\s+(.+)$/);
  if (!match) {
    return {
      addressStreet: normalized,
      addressPostalCode: null,
      addressCity: null,
    };
  }

  const street = match[1].replace(/[,\s]+$/g, "").trim() || null;
  const postalCode = match[2].trim();
  const city = match[3].trim() || null;
  return {
    addressStreet: street,
    addressPostalCode: postalCode,
    addressCity: city,
  };
}

export function parseLuadoEmail(body: string): ParsedLuadoJob | null {
  const text = body.replace(/\r/g, "");
  const orderId = capture(text, ORDER_ID_RE);
  if (!orderId) {
    return null;
  }

  const customerName = capture(text, CUSTOMER_RE);
  const jobType = capture(text, JOB_TYPE_RE);
  const addressRaw = capture(text, ADDRESS_RE);
  const description = capture(text, DESCRIPTION_RE);

  const startMatch = text.match(START_RE);
  const endMatch = text.match(END_RE);

  const startLocal = startMatch
    ? toLocalIso(startMatch[1], startMatch[2])
    : null;

  let endLocal = endMatch ? toLocalIso(endMatch[1], endMatch[2]) : null;
  if (!endLocal && startLocal) {
    const durationHours = parseDurationHours(text);
    if (durationHours !== null) {
      endLocal = addHoursToLocalIso(startLocal, durationHours);
    }
  }

  const paymentNok = parseNorwegianNumber(capture(text, PAYMENT_RE));
  const payoutNok = parseNorwegianNumber(capture(text, PAYOUT_RE));
  const split = splitAddress(addressRaw);

  return {
    source: LUADO_SOURCE,
    orderId,
    customerName,
    addressRaw,
    addressStreet: split.addressStreet,
    addressPostalCode: split.addressPostalCode,
    addressCity: split.addressCity,
    jobType,
    description,
    startLocal,
    endLocal,
    paymentNok,
    payoutNok,
  };
}
