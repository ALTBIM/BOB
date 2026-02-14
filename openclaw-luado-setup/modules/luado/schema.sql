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
