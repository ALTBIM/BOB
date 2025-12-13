-- Supabase schema for BOB (projects, members, files, ifc_models, chat, checks, tasks, kapplister)
-- Enable UUID generation
create extension if not exists "pgcrypto";

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
  role text not null default 'member',
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

-- Policy helper: project membership
create or replace view public.user_project_memberships as
select pm.project_id, pm.user_id
from public.project_members pm;

-- Project policies
create policy "projects_select" on public.projects for select
using (exists (select 1 from public.project_members pm where pm.project_id = id and pm.user_id = auth.uid()) or auth.uid() = created_by);
create policy "projects_insert" on public.projects for insert with check (auth.uid() is not null);
create policy "projects_update" on public.projects for update using (auth.uid() = created_by or exists (select 1 from public.project_members pm where pm.project_id = id and pm.user_id = auth.uid() and pm.role in ('admin','project_manager')));
create policy "projects_delete" on public.projects for delete using (auth.uid() = created_by);

-- Generic policy template for project-scoped tables
do $$
declare
  tbl text;
begin
  foreach tbl in array ['project_members','files','ifc_models','chats','chat_messages','checks','check_findings','tasks','kapplister','meeting_suggestions']
  loop
    execute format('
      create policy %I_select on public.%I for select
      using (exists (select 1 from public.project_members pm where pm.project_id = %I.project_id and pm.user_id = auth.uid()));
    ', tbl||'_select', tbl, tbl);

    execute format('
      create policy %I_insert on public.%I for insert
      with check (exists (select 1 from public.project_members pm where pm.project_id = %I.project_id and pm.user_id = auth.uid()));
    ', tbl||'_insert', tbl, tbl);

    execute format('
      create policy %I_update on public.%I for update
      using (exists (select 1 from public.project_members pm where pm.project_id = %I.project_id and pm.user_id = auth.uid() and pm.role in (''admin'',''project_manager'',''manager'')));
    ', tbl||'_update', tbl, tbl);

    execute format('
      create policy %I_delete on public.%I for delete
      using (exists (select 1 from public.project_members pm where pm.project_id = %I.project_id and pm.user_id = auth.uid() and pm.role in (''admin'',''project_manager'')));
    ', tbl||'_delete', tbl, tbl);
  end loop;
end$$;

