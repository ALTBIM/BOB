-- Supabase schema for BOB (projects, members, files, ifc_models, chat, checks, tasks, kapplister)
-- Enable UUID generation
create extension if not exists "pgcrypto";
-- Enable pgvector
create extension if not exists "vector";

-- Platform admins
create table if not exists public.app_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists organizations_name_idx on public.organizations(name);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  org_role text not null default 'member',
  created_at timestamptz not null default now()
);
create index if not exists organization_members_org_idx on public.organization_members(org_id);
create unique index if not exists organization_members_unique on public.organization_members(org_id, user_id);

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text default 'active',
  client text,
  location text,
  type text default 'commercial',
  progress int default 0,
  org_id uuid references public.organizations(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.projects add column if not exists client text;
alter table public.projects add column if not exists location text;
alter table public.projects add column if not exists type text;
alter table public.projects add column if not exists progress int default 0;
alter table public.projects add column if not exists org_id uuid references public.organizations(id) on delete set null;

-- Project members
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'byggherre',
  access_level text not null default 'read',
  company text,
  responsibility_area text,
  permissions text[] default '{}',
  created_at timestamptz not null default now()
);
alter table public.project_members add column if not exists access_level text default 'read';
update public.project_members set access_level = 'read' where access_level is null;
create index if not exists project_members_project_idx on public.project_members(project_id);
create unique index if not exists project_members_unique on public.project_members(project_id, user_id);

-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists teams_project_idx on public.teams(project_id);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  role_in_team text,
  created_at timestamptz not null default now()
);
create index if not exists team_members_team_idx on public.team_members(team_id);
create unique index if not exists team_members_unique on public.team_members(team_id, user_id);

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
  project_id uuid references public.projects(id) on delete cascade,
  check_id uuid not null references public.checks(id) on delete cascade,
  severity text not null default 'info',
  title text not null,
  description text,
  recommended_action text,
  related_file_id uuid references public.files(id) on delete set null,
  related_ifc_element text,
  created_at timestamptz not null default now()
);
alter table public.check_findings
  add column if not exists project_id uuid references public.projects(id) on delete cascade;
update public.check_findings cf
set project_id = c.project_id
from public.checks c
where cf.check_id = c.id and cf.project_id is null;
create index if not exists check_findings_check_idx on public.check_findings(check_id);
create index if not exists check_findings_project_idx on public.check_findings(project_id);

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
  -- Storage path in bucket (project-files)
  storage_path text,
  filename text,
  mime_type text,
  version int default 1,
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
  citations jsonb default '[]'::jsonb,
  used_chunk_ids uuid[] default '{}',
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_v2_thread_idx on public.chat_messages_v2(thread_id);
create index if not exists chat_messages_v2_project_idx on public.chat_messages_v2(project_id);

-- Ingest jobs/warnings
create table if not exists public.ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  job_type text,
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
  severity text,
  code text,
  message text,
  meta jsonb default '{}'::jsonb,
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
alter table public.app_admins enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
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

-- Admin helper functions
create or replace function public.is_app_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins aa where aa.user_id = uid
  );
$$;

create or replace function public.is_org_admin(uid uuid, org uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = org and om.user_id = uid and om.org_role = 'org_admin'
  );
$$;

create or replace function public.can_project_read(uid uuid, pid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_app_admin(uid)
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = pid and pm.user_id = uid
    )
    or exists (
      select 1
      from public.organization_members om
      join public.projects p on p.org_id = om.org_id
      where p.id = pid and om.user_id = uid and om.org_role = 'org_admin'
    )
    or exists (
      select 1 from public.projects p
      where p.id = pid and p.created_by = uid
    );
$$;

create or replace function public.can_project_write(uid uuid, pid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_app_admin(uid)
    or exists (
      select 1
      from public.organization_members om
      join public.projects p on p.org_id = om.org_id
      where p.id = pid and om.user_id = uid and om.org_role = 'org_admin'
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = pid
        and pm.user_id = uid
        and pm.access_level in ('write','admin')
    )
    or exists (
      select 1 from public.projects p
      where p.id = pid and p.created_by = uid
    );
$$;

create or replace function public.can_project_admin(uid uuid, pid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_app_admin(uid)
    or exists (
      select 1
      from public.organization_members om
      join public.projects p on p.org_id = om.org_id
      where p.id = pid and om.user_id = uid and om.org_role = 'org_admin'
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = pid
        and pm.user_id = uid
        and pm.access_level = 'admin'
    )
    or exists (
      select 1 from public.projects p
      where p.id = pid and p.created_by = uid
    );
$$;

-- Admin policies
drop policy if exists "app_admins_select_self" on public.app_admins;
drop policy if exists "app_admins_select_admin" on public.app_admins;
drop policy if exists "app_admins_insert" on public.app_admins;
drop policy if exists "app_admins_delete" on public.app_admins;
create policy "app_admins_select_self" on public.app_admins for select
using (user_id = auth.uid());
create policy "app_admins_select_admin" on public.app_admins for select
using (public.is_app_admin(auth.uid()));
create policy "app_admins_insert" on public.app_admins for insert
with check (public.is_app_admin(auth.uid()));
create policy "app_admins_delete" on public.app_admins for delete
using (public.is_app_admin(auth.uid()));

drop policy if exists "organizations_select" on public.organizations;
drop policy if exists "organizations_insert" on public.organizations;
drop policy if exists "organizations_update" on public.organizations;
drop policy if exists "organizations_delete" on public.organizations;
create policy "organizations_select" on public.organizations for select
using (
  public.is_app_admin(auth.uid())
  or exists (
    select 1 from public.organization_members om
    where om.org_id = organizations.id and om.user_id = auth.uid()
  )
);
create policy "organizations_insert" on public.organizations for insert
with check (public.is_app_admin(auth.uid()));
create policy "organizations_update" on public.organizations for update
using (public.is_app_admin(auth.uid()) or public.is_org_admin(auth.uid(), organizations.id));
create policy "organizations_delete" on public.organizations for delete
using (public.is_app_admin(auth.uid()));

drop policy if exists "organization_members_select_self" on public.organization_members;
drop policy if exists "organization_members_select_admin" on public.organization_members;
drop policy if exists "organization_members_insert" on public.organization_members;
drop policy if exists "organization_members_update" on public.organization_members;
drop policy if exists "organization_members_delete" on public.organization_members;
create policy "organization_members_select_self" on public.organization_members for select
using (user_id = auth.uid());
create policy "organization_members_select_admin" on public.organization_members for select
using (public.is_app_admin(auth.uid()) or public.is_org_admin(auth.uid(), organization_members.org_id));
create policy "organization_members_insert" on public.organization_members for insert
with check (public.is_app_admin(auth.uid()) or public.is_org_admin(auth.uid(), organization_members.org_id));
create policy "organization_members_update" on public.organization_members for update
using (public.is_app_admin(auth.uid()) or public.is_org_admin(auth.uid(), organization_members.org_id));
create policy "organization_members_delete" on public.organization_members for delete
using (public.is_app_admin(auth.uid()) or public.is_org_admin(auth.uid(), organization_members.org_id));

-- Project policies
drop policy if exists "projects_select" on public.projects;
drop policy if exists "projects_insert" on public.projects;
drop policy if exists "projects_update" on public.projects;
drop policy if exists "projects_delete" on public.projects;
create policy "projects_select" on public.projects for select
using (public.can_project_read(auth.uid(), id));
create policy "projects_insert" on public.projects for insert
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and (
    org_id is null
    or public.is_app_admin(auth.uid())
    or public.is_org_admin(auth.uid(), org_id)
  )
);
create policy "projects_update" on public.projects for update
using (public.can_project_admin(auth.uid(), id));
create policy "projects_delete" on public.projects for delete
using (public.can_project_admin(auth.uid(), id));

-- Generic policy template for project-scoped tables (explicit to avoid PL/pgSQL issues)
drop policy if exists "project_members_select" on public.project_members;
drop policy if exists "project_members_insert" on public.project_members;
drop policy if exists "project_members_update" on public.project_members;
drop policy if exists "project_members_delete" on public.project_members;
create policy "project_members_select" on public.project_members for select
using (public.can_project_read(auth.uid(), project_members.project_id));
create policy "project_members_insert" on public.project_members for insert
with check (public.can_project_admin(auth.uid(), project_members.project_id));
create policy "project_members_update" on public.project_members for update
using (public.can_project_admin(auth.uid(), project_members.project_id));
create policy "project_members_delete" on public.project_members for delete
using (public.can_project_admin(auth.uid(), project_members.project_id));

drop policy if exists "teams_select" on public.teams;
drop policy if exists "teams_insert" on public.teams;
drop policy if exists "teams_update" on public.teams;
drop policy if exists "teams_delete" on public.teams;
create policy "teams_select" on public.teams for select
using (public.can_project_read(auth.uid(), teams.project_id));
create policy "teams_insert" on public.teams for insert
with check (public.can_project_admin(auth.uid(), teams.project_id));
create policy "teams_update" on public.teams for update
using (public.can_project_admin(auth.uid(), teams.project_id));
create policy "teams_delete" on public.teams for delete
using (public.can_project_admin(auth.uid(), teams.project_id));

drop policy if exists "team_members_select" on public.team_members;
drop policy if exists "team_members_insert" on public.team_members;
drop policy if exists "team_members_update" on public.team_members;
drop policy if exists "team_members_delete" on public.team_members;
create policy "team_members_select" on public.team_members for select
using (
  public.can_project_read(
    auth.uid(),
    (select t.project_id from public.teams t where t.id = team_members.team_id)
  )
);
create policy "team_members_insert" on public.team_members for insert
with check (
  public.can_project_admin(
    auth.uid(),
    (select t.project_id from public.teams t where t.id = team_members.team_id)
  )
);
create policy "team_members_update" on public.team_members for update
using (
  public.can_project_admin(
    auth.uid(),
    (select t.project_id from public.teams t where t.id = team_members.team_id)
  )
);
create policy "team_members_delete" on public.team_members for delete
using (
  public.can_project_admin(
    auth.uid(),
    (select t.project_id from public.teams t where t.id = team_members.team_id)
  )
);

drop policy if exists "files_select" on public.files;
drop policy if exists "files_insert" on public.files;
drop policy if exists "files_update" on public.files;
drop policy if exists "files_delete" on public.files;
create policy "files_select" on public.files for select
using (public.can_project_read(auth.uid(), files.project_id));
create policy "files_insert" on public.files for insert
with check (public.can_project_write(auth.uid(), files.project_id));
create policy "files_update" on public.files for update
using (public.can_project_write(auth.uid(), files.project_id));
create policy "files_delete" on public.files for delete
using (public.can_project_write(auth.uid(), files.project_id));

drop policy if exists "ifc_models_select" on public.ifc_models;
drop policy if exists "ifc_models_insert" on public.ifc_models;
drop policy if exists "ifc_models_update" on public.ifc_models;
drop policy if exists "ifc_models_delete" on public.ifc_models;
create policy "ifc_models_select" on public.ifc_models for select
using (public.can_project_read(auth.uid(), ifc_models.project_id));
create policy "ifc_models_insert" on public.ifc_models for insert
with check (public.can_project_write(auth.uid(), ifc_models.project_id));
create policy "ifc_models_update" on public.ifc_models for update
using (public.can_project_write(auth.uid(), ifc_models.project_id));
create policy "ifc_models_delete" on public.ifc_models for delete
using (public.can_project_write(auth.uid(), ifc_models.project_id));

drop policy if exists "chats_select" on public.chats;
drop policy if exists "chats_insert" on public.chats;
drop policy if exists "chats_update" on public.chats;
drop policy if exists "chats_delete" on public.chats;
create policy "chats_select" on public.chats for select
using (public.can_project_read(auth.uid(), chats.project_id));
create policy "chats_insert" on public.chats for insert
with check (public.can_project_write(auth.uid(), chats.project_id));
create policy "chats_update" on public.chats for update
using (public.can_project_write(auth.uid(), chats.project_id));
create policy "chats_delete" on public.chats for delete
using (public.can_project_write(auth.uid(), chats.project_id));

drop policy if exists "chat_messages_select" on public.chat_messages;
drop policy if exists "chat_messages_insert" on public.chat_messages;
drop policy if exists "chat_messages_update" on public.chat_messages;
drop policy if exists "chat_messages_delete" on public.chat_messages;
create policy "chat_messages_select" on public.chat_messages for select
using (public.can_project_read(auth.uid(), chat_messages.project_id));
create policy "chat_messages_insert" on public.chat_messages for insert
with check (public.can_project_write(auth.uid(), chat_messages.project_id));
create policy "chat_messages_update" on public.chat_messages for update
using (public.can_project_write(auth.uid(), chat_messages.project_id));
create policy "chat_messages_delete" on public.chat_messages for delete
using (public.can_project_write(auth.uid(), chat_messages.project_id));

drop policy if exists "checks_select" on public.checks;
drop policy if exists "checks_insert" on public.checks;
drop policy if exists "checks_update" on public.checks;
drop policy if exists "checks_delete" on public.checks;
create policy "checks_select" on public.checks for select
using (public.can_project_read(auth.uid(), checks.project_id));
create policy "checks_insert" on public.checks for insert
with check (public.can_project_write(auth.uid(), checks.project_id));
create policy "checks_update" on public.checks for update
using (public.can_project_write(auth.uid(), checks.project_id));
create policy "checks_delete" on public.checks for delete
using (public.can_project_write(auth.uid(), checks.project_id));

drop policy if exists "check_findings_select" on public.check_findings;
drop policy if exists "check_findings_insert" on public.check_findings;
drop policy if exists "check_findings_update" on public.check_findings;
drop policy if exists "check_findings_delete" on public.check_findings;
create policy "check_findings_select" on public.check_findings for select
using (public.can_project_read(auth.uid(), check_findings.project_id));
create policy "check_findings_insert" on public.check_findings for insert
with check (public.can_project_write(auth.uid(), check_findings.project_id));
create policy "check_findings_update" on public.check_findings for update
using (public.can_project_write(auth.uid(), check_findings.project_id));
create policy "check_findings_delete" on public.check_findings for delete
using (public.can_project_write(auth.uid(), check_findings.project_id));

drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_select" on public.tasks for select
using (public.can_project_read(auth.uid(), tasks.project_id));
create policy "tasks_insert" on public.tasks for insert
with check (public.can_project_write(auth.uid(), tasks.project_id));
create policy "tasks_update" on public.tasks for update
using (public.can_project_write(auth.uid(), tasks.project_id));
create policy "tasks_delete" on public.tasks for delete
using (public.can_project_write(auth.uid(), tasks.project_id));

drop policy if exists "kapplister_select" on public.kapplister;
drop policy if exists "kapplister_insert" on public.kapplister;
drop policy if exists "kapplister_update" on public.kapplister;
drop policy if exists "kapplister_delete" on public.kapplister;
create policy "kapplister_select" on public.kapplister for select
using (public.can_project_read(auth.uid(), kapplister.project_id));
create policy "kapplister_insert" on public.kapplister for insert
with check (public.can_project_write(auth.uid(), kapplister.project_id));
create policy "kapplister_update" on public.kapplister for update
using (public.can_project_write(auth.uid(), kapplister.project_id));
create policy "kapplister_delete" on public.kapplister for delete
using (public.can_project_write(auth.uid(), kapplister.project_id));

drop policy if exists "meeting_suggestions_select" on public.meeting_suggestions;
drop policy if exists "meeting_suggestions_insert" on public.meeting_suggestions;
drop policy if exists "meeting_suggestions_update" on public.meeting_suggestions;
drop policy if exists "meeting_suggestions_delete" on public.meeting_suggestions;
create policy "meeting_suggestions_select" on public.meeting_suggestions for select
using (public.can_project_read(auth.uid(), meeting_suggestions.project_id));
create policy "meeting_suggestions_insert" on public.meeting_suggestions for insert
with check (public.can_project_write(auth.uid(), meeting_suggestions.project_id));
create policy "meeting_suggestions_update" on public.meeting_suggestions for update
using (public.can_project_write(auth.uid(), meeting_suggestions.project_id));
create policy "meeting_suggestions_delete" on public.meeting_suggestions for delete
using (public.can_project_write(auth.uid(), meeting_suggestions.project_id));

drop policy if exists "file_texts_select" on public.file_texts;
drop policy if exists "file_texts_insert" on public.file_texts;
drop policy if exists "file_texts_update" on public.file_texts;
drop policy if exists "file_texts_delete" on public.file_texts;
create policy "file_texts_select" on public.file_texts for select
using (public.can_project_read(auth.uid(), file_texts.project_id));
create policy "file_texts_insert" on public.file_texts for insert
with check (public.can_project_write(auth.uid(), file_texts.project_id));
create policy "file_texts_update" on public.file_texts for update
using (public.can_project_write(auth.uid(), file_texts.project_id));
create policy "file_texts_delete" on public.file_texts for delete
using (public.can_project_write(auth.uid(), file_texts.project_id));

drop policy if exists "file_requirements_select" on public.file_requirements;
drop policy if exists "file_requirements_insert" on public.file_requirements;
drop policy if exists "file_requirements_update" on public.file_requirements;
drop policy if exists "file_requirements_delete" on public.file_requirements;
create policy "file_requirements_select" on public.file_requirements for select
using (public.can_project_read(auth.uid(), file_requirements.project_id));
create policy "file_requirements_insert" on public.file_requirements for insert
with check (public.can_project_write(auth.uid(), file_requirements.project_id));
create policy "file_requirements_update" on public.file_requirements for update
using (public.can_project_write(auth.uid(), file_requirements.project_id));
create policy "file_requirements_delete" on public.file_requirements for delete
using (public.can_project_write(auth.uid(), file_requirements.project_id));

drop policy if exists "documents_select" on public.documents;
drop policy if exists "documents_insert" on public.documents;
drop policy if exists "documents_update" on public.documents;
drop policy if exists "documents_delete" on public.documents;
create policy "documents_select" on public.documents for select
using (public.can_project_read(auth.uid(), documents.project_id));
create policy "documents_insert" on public.documents for insert
with check (public.can_project_write(auth.uid(), documents.project_id));
create policy "documents_update" on public.documents for update
using (public.can_project_write(auth.uid(), documents.project_id));
create policy "documents_delete" on public.documents for delete
using (public.can_project_write(auth.uid(), documents.project_id));

drop policy if exists "document_chunks_select" on public.document_chunks;
drop policy if exists "document_chunks_insert" on public.document_chunks;
drop policy if exists "document_chunks_update" on public.document_chunks;
drop policy if exists "document_chunks_delete" on public.document_chunks;
create policy "document_chunks_select" on public.document_chunks for select
using (public.can_project_read(auth.uid(), document_chunks.project_id));
create policy "document_chunks_insert" on public.document_chunks for insert
with check (public.can_project_write(auth.uid(), document_chunks.project_id));
create policy "document_chunks_update" on public.document_chunks for update
using (public.can_project_write(auth.uid(), document_chunks.project_id));
create policy "document_chunks_delete" on public.document_chunks for delete
using (public.can_project_write(auth.uid(), document_chunks.project_id));

drop policy if exists "sources_select" on public.sources;
drop policy if exists "sources_insert" on public.sources;
drop policy if exists "sources_update" on public.sources;
drop policy if exists "sources_delete" on public.sources;
create policy "sources_select" on public.sources for select
using (public.can_project_read(auth.uid(), sources.project_id));
create policy "sources_insert" on public.sources for insert
with check (public.can_project_write(auth.uid(), sources.project_id));
create policy "sources_update" on public.sources for update
using (public.can_project_write(auth.uid(), sources.project_id));
create policy "sources_delete" on public.sources for delete
using (public.can_project_write(auth.uid(), sources.project_id));

drop policy if exists "chat_threads_select" on public.chat_threads;
drop policy if exists "chat_threads_insert" on public.chat_threads;
drop policy if exists "chat_threads_update" on public.chat_threads;
drop policy if exists "chat_threads_delete" on public.chat_threads;
create policy "chat_threads_select" on public.chat_threads for select
using (public.can_project_read(auth.uid(), chat_threads.project_id));
create policy "chat_threads_insert" on public.chat_threads for insert
with check (public.can_project_write(auth.uid(), chat_threads.project_id));
create policy "chat_threads_update" on public.chat_threads for update
using (public.can_project_write(auth.uid(), chat_threads.project_id));
create policy "chat_threads_delete" on public.chat_threads for delete
using (public.can_project_write(auth.uid(), chat_threads.project_id));

drop policy if exists "chat_messages_v2_select" on public.chat_messages_v2;
drop policy if exists "chat_messages_v2_insert" on public.chat_messages_v2;
drop policy if exists "chat_messages_v2_update" on public.chat_messages_v2;
drop policy if exists "chat_messages_v2_delete" on public.chat_messages_v2;
create policy "chat_messages_v2_select" on public.chat_messages_v2 for select
using (public.can_project_read(auth.uid(), chat_messages_v2.project_id));
create policy "chat_messages_v2_insert" on public.chat_messages_v2 for insert
with check (public.can_project_write(auth.uid(), chat_messages_v2.project_id));
create policy "chat_messages_v2_update" on public.chat_messages_v2 for update
using (public.can_project_write(auth.uid(), chat_messages_v2.project_id));
create policy "chat_messages_v2_delete" on public.chat_messages_v2 for delete
using (public.can_project_write(auth.uid(), chat_messages_v2.project_id));

drop policy if exists "ingest_jobs_select" on public.ingest_jobs;
drop policy if exists "ingest_jobs_insert" on public.ingest_jobs;
drop policy if exists "ingest_jobs_update" on public.ingest_jobs;
drop policy if exists "ingest_jobs_delete" on public.ingest_jobs;
create policy "ingest_jobs_select" on public.ingest_jobs for select
using (public.can_project_read(auth.uid(), ingest_jobs.project_id));
create policy "ingest_jobs_insert" on public.ingest_jobs for insert
with check (public.can_project_write(auth.uid(), ingest_jobs.project_id));
create policy "ingest_jobs_update" on public.ingest_jobs for update
using (public.can_project_write(auth.uid(), ingest_jobs.project_id));
create policy "ingest_jobs_delete" on public.ingest_jobs for delete
using (public.can_project_write(auth.uid(), ingest_jobs.project_id));

drop policy if exists "ingest_warnings_select" on public.ingest_warnings;
drop policy if exists "ingest_warnings_insert" on public.ingest_warnings;
drop policy if exists "ingest_warnings_update" on public.ingest_warnings;
drop policy if exists "ingest_warnings_delete" on public.ingest_warnings;
create policy "ingest_warnings_select" on public.ingest_warnings for select
using (public.can_project_read(auth.uid(), ingest_warnings.project_id));
create policy "ingest_warnings_insert" on public.ingest_warnings for insert
with check (public.can_project_write(auth.uid(), ingest_warnings.project_id));
create policy "ingest_warnings_update" on public.ingest_warnings for update
using (public.can_project_write(auth.uid(), ingest_warnings.project_id));
create policy "ingest_warnings_delete" on public.ingest_warnings for delete
using (public.can_project_write(auth.uid(), ingest_warnings.project_id));

drop policy if exists "project_schedule_tasks_select" on public.project_schedule_tasks;
drop policy if exists "project_schedule_tasks_insert" on public.project_schedule_tasks;
drop policy if exists "project_schedule_tasks_update" on public.project_schedule_tasks;
drop policy if exists "project_schedule_tasks_delete" on public.project_schedule_tasks;
create policy "project_schedule_tasks_select" on public.project_schedule_tasks for select
using (public.can_project_read(auth.uid(), project_schedule_tasks.project_id));
create policy "project_schedule_tasks_insert" on public.project_schedule_tasks for insert
with check (public.can_project_write(auth.uid(), project_schedule_tasks.project_id));
create policy "project_schedule_tasks_update" on public.project_schedule_tasks for update
using (public.can_project_write(auth.uid(), project_schedule_tasks.project_id));
create policy "project_schedule_tasks_delete" on public.project_schedule_tasks for delete
using (public.can_project_write(auth.uid(), project_schedule_tasks.project_id));


