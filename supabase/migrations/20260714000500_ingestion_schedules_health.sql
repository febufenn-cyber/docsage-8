create table if not exists public.ingestion_schedules (
  id text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  interval_ms bigint not null check (interval_ms between 60000 and 2678400000),
  enabled boolean not null default true,
  next_run_at timestamptz not null,
  requested_version text not null default 'current',
  requested_runtime text not null default 'all',
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  configuration jsonb not null default '{}',
  configuration_hash text not null check (configuration_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, source_id, name)
);

create index if not exists ingestion_schedules_due_idx
  on public.ingestion_schedules(project_id, next_run_at)
  where enabled;

create table if not exists public.source_health (
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  status text not null check (status in ('healthy','degraded','failed','unknown')),
  ingestion_job_id text references public.ingestion_jobs(id) on delete set null,
  job_state text,
  attempt integer not null default 0 check (attempt >= 0),
  failure_code text,
  checked_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key(project_id, source_id)
);

alter table public.ingestion_schedules enable row level security;
alter table public.source_health enable row level security;

create policy ingestion_schedules_project_owner on public.ingestion_schedules
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy source_health_project_owner on public.source_health
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
