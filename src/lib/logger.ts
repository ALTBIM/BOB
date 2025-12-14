import { RetrievedSource } from "./rag";
import { promises as fs } from "fs";
import path from "path";

export type InteractionLog = {
  id: string;
  projectId: string;
  userId?: string;
  role?: string;
  prompt: string;
  retrievedSources: RetrievedSource[];
  answer: string;
  timestamp: string;
  feedback?: {
    rating: "up" | "down";
    note?: string;
  };
};

const logs: InteractionLog[] = [];
const dataDir = path.join(process.cwd(), "data");
const logFile = path.join(dataDir, "logs.json");

async function ensureDataFile() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(logFile);
  } catch {
    await fs.writeFile(logFile, "[]", "utf-8");
  }
}

async function loadLogsFromDisk() {
  try {
    await ensureDataFile();
    const raw = await fs.readFile(logFile, "utf-8");
    const parsed = JSON.parse(raw) as InteractionLog[];
    logs.push(...parsed);
  } catch {
    // ignore disk errors; stay in-memory
  }
}

async function persistLogs() {
  try {
    await ensureDataFile();
    await fs.writeFile(logFile, JSON.stringify(logs, null, 2), "utf-8");
  } catch {
    // best-effort only
  }
}

// Lazy load once per process
loadLogsFromDisk();

export function logInteraction(entry: Omit<InteractionLog, "id" | "timestamp">) {
  const record: InteractionLog = {
    ...entry,
    id: `log-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
  };
  logs.push(record);
  // fire and forget persist
  persistLogs();
  return record;
}

export function getLogs(projectId?: string) {
  if (!projectId) return [...logs];
  return logs.filter((log) => log.projectId === projectId);
}
