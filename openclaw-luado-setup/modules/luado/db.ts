import { Pool, type PoolClient } from "pg";
import {
  LUADO_SOURCE,
  type ApproveJobResult,
  type JobRecord,
  type JobStatus,
  type LuadoStore,
  type RejectJobResult,
  type UpsertJobInput,
  type UpsertJobResult,
} from "./types.js";

type DbRow = {
  id: number;
  source: string;
  order_id: string | null;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  status: JobStatus;
  customer_name: string | null;
  address_raw: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  job_type: string | null;
  description: string | null;
  start_local: string | null;
  end_local: string | null;
  payment_nok: string | number | null;
  payout_nok: string | number | null;
  calendar_event_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  inserted?: boolean;
};

function mapRow(row: DbRow): JobRecord {
  return {
    id: row.id,
    source: LUADO_SOURCE,
    orderId: row.order_id ?? "",
    gmailMessageId: row.gmail_message_id,
    gmailThreadId: row.gmail_thread_id,
    status: row.status,
    customerName: row.customer_name,
    addressRaw: row.address_raw,
    addressStreet: row.address_street,
    addressPostalCode: row.address_postal_code,
    addressCity: row.address_city,
    jobType: row.job_type,
    description: row.description,
    startLocal: row.start_local,
    endLocal: row.end_local,
    paymentNok:
      row.payment_nok === null ? null : Number.parseFloat(String(row.payment_nok)),
    payoutNok:
      row.payout_nok === null ? null : Number.parseFloat(String(row.payout_nok)),
    calendarEventId: row.calendar_event_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true" || value === "t" || value === "1";
  }
  if (typeof value === "number") {
    return value === 1;
  }
  return false;
}

export class PostgresLuadoStore implements LuadoStore {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  static fromEnv(): PostgresLuadoStore {
    const connectionString =
      process.env.LUADO_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Missing LUADO_DATABASE_URL or DATABASE_URL");
    }
    return new PostgresLuadoStore(connectionString);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async ensureSchema(): Promise<void> {
    const sql = `
      create table if not exists jobs (
        id bigserial primary key,
        source text not null default 'luado',
        order_id text,
        gmail_message_id text not null,
        gmail_thread_id text,
        status text not null default 'new',
        customer_name text,
        address_raw text,
        address_street text,
        address_postal_code text,
        address_city text,
        job_type text,
        description text,
        start_local text,
        end_local text,
        payment_nok numeric,
        payout_nok numeric,
        calendar_event_id text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );

      create unique index if not exists jobs_order_uq
      on jobs(source, order_id)
      where order_id is not null;
    `;
    await this.pool.query(sql);
  }

  async upsertJob(input: UpsertJobInput): Promise<UpsertJobResult> {
    const result = await this.pool.query<DbRow>(
      `
      insert into jobs (
        source,
        order_id,
        gmail_message_id,
        gmail_thread_id,
        status,
        customer_name,
        address_raw,
        address_street,
        address_postal_code,
        address_city,
        job_type,
        description,
        start_local,
        end_local,
        payment_nok,
        payout_nok
      ) values (
        $1,$2,$3,$4,'new',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      )
      on conflict (source, order_id) where order_id is not null
      do update set
        gmail_message_id = excluded.gmail_message_id,
        gmail_thread_id = excluded.gmail_thread_id,
        customer_name = excluded.customer_name,
        address_raw = excluded.address_raw,
        address_street = excluded.address_street,
        address_postal_code = excluded.address_postal_code,
        address_city = excluded.address_city,
        job_type = excluded.job_type,
        description = excluded.description,
        start_local = excluded.start_local,
        end_local = excluded.end_local,
        payment_nok = excluded.payment_nok,
        payout_nok = excluded.payout_nok,
        updated_at = now()
      returning *, (xmax = 0) as inserted
      `,
      [
        LUADO_SOURCE,
        input.orderId,
        input.gmailMessageId,
        input.gmailThreadId,
        input.customerName,
        input.addressRaw,
        input.addressStreet,
        input.addressPostalCode,
        input.addressCity,
        input.jobType,
        input.description,
        input.startLocal,
        input.endLocal,
        input.paymentNok,
        input.payoutNok,
      ],
    );

    const row = result.rows[0];
    return {
      job: mapRow(row),
      inserted: toBool(row.inserted),
    };
  }

  async approveJobWithCalendarEvent(
    orderId: string,
    createCalendarEvent: (job: JobRecord) => Promise<string>,
  ): Promise<ApproveJobResult> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");

      const selected = await client.query<DbRow>(
        `
        select *
        from jobs
        where source = $1 and order_id = $2
        for update
        `,
        [LUADO_SOURCE, orderId],
      );

      if (selected.rowCount === 0) {
        await client.query("rollback");
        return { kind: "not_found" };
      }

      const existing = selected.rows[0];
      if (existing.calendar_event_id) {
        await client.query("commit");
        return {
          kind: "already_approved",
          job: mapRow(existing),
          calendarEventId: existing.calendar_event_id,
        };
      }

      const job = mapRow(existing);
      const eventId = await createCalendarEvent(job);
      const updated = await client.query<DbRow>(
        `
        update jobs
        set status = 'approved',
            calendar_event_id = $2,
            updated_at = now()
        where id = $1
        returning *
        `,
        [existing.id, eventId],
      );

      await client.query("commit");
      return {
        kind: "approved",
        job: mapRow(updated.rows[0]),
        calendarEventId: eventId,
      };
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async rejectJob(orderId: string): Promise<RejectJobResult> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");

      const selected = await client.query<DbRow>(
        `
        select *
        from jobs
        where source = $1 and order_id = $2
        for update
        `,
        [LUADO_SOURCE, orderId],
      );

      if (selected.rowCount === 0) {
        await client.query("rollback");
        return { kind: "not_found" };
      }

      const existing = selected.rows[0];
      if (existing.status === "rejected") {
        await client.query("commit");
        return { kind: "already_rejected", job: mapRow(existing) };
      }

      const updated = await client.query<DbRow>(
        `
        update jobs
        set status = 'rejected',
            updated_at = now()
        where id = $1
        returning *
        `,
        [existing.id],
      );
      await client.query("commit");
      return { kind: "rejected", job: mapRow(updated.rows[0]) };
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function safeRollback(client: PoolClient): Promise<void> {
  try {
    await client.query("rollback");
  } catch {
    // Ignore rollback failures.
  }
}
