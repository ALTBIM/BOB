-- Supabase schema for BOB (projects, members, files, ifc_models, chat, checks, tasks, kapplister)
-- Enable UUID generation
create extension if not exists "pgcrypto";
-- Enable pgvector
create extension if not exists "vector";

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text default 'active',
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Project members
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'byggherre',
  company text,
  responsibility_area text,
  permissions text[] default '{}',
  created_at timestamptz not null default now()
);
create index if not exists project_members_project_idx on public.project_members(project_id);
create unique index if not exists project_members_unique on public.project_members(project_id, user_id);

-- Files (generic storage metadata)
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  path text not null unique,
  type text default 'application/octet-stream',
  size bigint default 0,
  description text,
  storage_url text,
  source_provider text,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  tags jsonb default '[]'::jsonb,
  version int default 1,
  metadata jsonb default '{}'::jsonb
);
create index if not exists files_project_idx on public.files(project_id);

-- IFC models (linked to files)
create table if not exists public.ifc_models (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  name text,
  filename text,
  size bigint default 0,
  version int default 1,
  status text default 'completed',
  storage_url text,
  objects int,
  zones int,
  materials int,
  uploaded_at timestamptz not null default now(),
  uploaded_by text,
  description text
);
create unique index if not exists ifc_models_file_unique on public.ifc_models(file_id);
create index if not exists ifc_models_project_idx on public.ifc_models(project_id);

-- Chats
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists chats_project_idx on public.chats(project_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_chat_idx on public.chat_messages(chat_id);
create index if not exists chat_messages_project_idx on public.chat_messages(project_id);

-- Checks and findings
create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  status text default 'completed',
  created_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists checks_project_idx on public.checks(project_id);

create table if not exists public.check_findings (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks(id) on delete cascade,
  severity text not null default 'info',
  title text not null,
  description text,
  recommended_action text,
  related_file_id uuid references public.files(id) on delete set null,
  related_ifc_element text,
  created_at timestamptz not null default now()
);
create index if not exists check_findings_check_idx on public.check_findings(check_id);

-- Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid,
  due_date date,
  status text default 'open',
  created_from_finding_id uuid references public.check_findings(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tasks_project_idx on public.tasks(project_id);

-- Kapplister (production lists)
create table if not exists public.kapplister (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  model_id uuid references public.ifc_models(id) on delete set null,
  zone text,
  filter jsonb,
  generated_by uuid,
  generated_at timestamptz not null default now(),
  export_url text,
  data jsonb
);
create index if not exists kapplister_project_idx on public.kapplister(project_id);

-- Meeting suggestions
create table if not exists public.meeting_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  check_id uuid references public.checks(id) on delete set null,
  agenda jsonb,
  participants jsonb,
  created_at timestamptz not null default now()
);
create index if not exists meeting_suggestions_project_idx on public.meeting_suggestions(project_id);

-- Extracted file text (for chat/krav)
create table if not exists public.file_texts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  content text,
  content_type text,
  source_path text,
  word_count int,
  page_count int,
  created_at timestamptz not null default now()
);
create index if not exists file_texts_project_idx on public.file_texts(project_id);
create index if not exists file_texts_file_idx on public.file_texts(file_id);

-- Parsed requirements (lightweight extraction from text docs)
create table if not exists public.file_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  text text not null,
  source_path text,
  source_page int,
  created_at timestamptz not null default now()
);
create index if not exists file_requirements_project_idx on public.file_requirements(project_id);
create index if not exists file_requirements_file_idx on public.file_requirements(file_id);
create unique index if not exists file_requirements_unique on public.file_requirements(file_id, text);

-- Documents for RAG ingestion
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  title text not null,
  discipline text,
  reference text,
  source_path text,
  source_type text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists documents_project_idx on public.documents(project_id);
create index if not exists documents_file_idx on public.documents(file_id);

-- Chunked content + embeddings
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  token_count int,
  embedding vector(1536),
  source_page int,
  source_section text,
  created_at timestamptz not null default now()
);
create index if not exists document_chunks_project_idx on public.document_chunks(project_id);
create index if not exists document_chunks_document_idx on public.document_chunks(document_id);
create index if not exists document_chunks_embedding_idx on public.document_chunks using ivfflat (embedding vector_cosine_ops);

-- Sources (for audit and UI)
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  chunk_id uuid references public.document_chunks(id) on delete set null,
  title text,
  reference text,
  discipline text,
  zone text,
  snippet text,
  source_path text,
  source_page int,
  created_at timestamptz not null default now()
);
create index if not exists sources_project_idx on public.sources(project_id);

-- Chat threads/messages (new structure)
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists chat_threads_project_idx on public.chat_threads(project_id);

create table if not exists public.chat_messages_v2 (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid,
  role text not null,
  content text not null,
  sources jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_v2_thread_idx on public.chat_messages_v2(thread_id);
create index if not exists chat_messages_v2_project_idx on public.chat_messages_v2(project_id);

-- Ingest jobs/warnings
create table if not exists public.ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  status text default 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists ingest_jobs_project_idx on public.ingest_jobs(project_id);

create table if not exists public.ingest_warnings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  ingest_job_id uuid references public.ingest_jobs(id) on delete set null,
  code text,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists ingest_warnings_project_idx on public.ingest_warnings(project_id);

-- Schedule tasks (from XLSX/CSV)
create table if not exists public.project_schedule_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  task_id text,
  name text not null,
  discipline text,
  owner text,
  zone text,
  room text,
  start_date date,
  end_date date,
  duration_days int,
  status text,
  dependencies text[],
  milestone boolean default false,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists schedule_tasks_project_idx on public.project_schedule_tasks(project_id);

-- RLS
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.files enable row level security;
alter table public.ifc_models enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.checks enable row level security;
alter table public.check_findings enable row level security;
alter table public.tasks enable row level security;
alter table public.kapplister enable row level security;
alter table public.meeting_suggestions enable row level security;
alter table public.file_texts enable row level security;
alter table public.file_requirements enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.sources enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages_v2 enable row level security;
alter table public.ingest_jobs enable row level security;
alter table public.ingest_warnings enable row level security;
alter table public.project_schedule_tasks enable row level security;

-- Policy helper: project membership
create or replace view public.user_project_memberships as
select pm.project_id, pm.user_id
from public.project_members pm;

-- Project policies
drop policy if exists "projects_select" on public.projects;
drop policy if exists "projects_insert" on public.projects;
drop policy if exists "projects_update" on public.projects;
drop policy if exists "projects_delete" on public.projects;
create policy "projects_select" on public.projects for select
using (exists (select 1 from public.project_members pm where pm.project_id = id and pm.user_id = auth.uid()) or auth.uid() = created_by);
create policy "projects_insert" on public.projects for insert with check (auth.uid() is not null);
create policy "projects_update" on public.projects for update using (auth.uid() = created_by or exists (select 1 from public.project_members pm where pm.project_id = id and pm.user_id = auth.uid() and pm.role in ('prosjektleder','byggherre')));
create policy "projects_delete" on public.projects for delete using (auth.uid() = created_by or exists (select 1 from public.project_members pm where pm.project_id = id and pm.user_id = auth.uid() and pm.role in ('prosjektleder','byggherre')));

-- Generic policy template for project-scoped tables
do $$
declare
  tbl text;
begin
  foreach tbl in ARRAY[
    'project_members','files','ifc_models','chats','chat_messages','checks','check_findings','tasks','kapplister',
    'meeting_suggestions','file_texts','file_requirements','documents','document_chunks','sources','chat_threads',
    'chat_messages_v2','ingest_jobs','ingest_warnings','project_schedule_tasks'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', tbl||'_select', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl||'_insert', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl||'_update', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl||'_delete', tbl);

    execute format($f$
      create policy %I_select on public.%I for select
      using (exists (select 1 from public.project_members pm where pm.project_id = %I.project_id and pm.user_id = auth.uid()));
    $f$, tbl||'_select', tbl, tbl);

    execute format($f$
      create policy %I_insert on public.%I for insert
      with check (exists (select 1 from public.project_members pm where pm.project_id = %I.project_id and pm.user_id = auth.uid()));
    $f$, tbl||'_insert', tbl, tbl);

    execute format($f$
      create policy %I_update on public.%I for update
      using (exists (select 1 from public.project_members pm where pm.project_id = %I.project_id and pm.user_id = auth.uid() and pm.role in ('prosjektleder','byggherre')));
    $f$, tbl||'_update', tbl, tbl);

    execute format($f$
      create policy %I_delete on public.%I for delete
      using (exists (select 1 from public.project_members pm where pm.project_id = %I.project_id and pm.user_id = auth.uid() and pm.role in ('prosjektleder','byggherre')));
    $f$, tbl||'_delete', tbl, tbl);
  end loop;
end$$;
