create table if not exists public.ingestion_jobs (
  id text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 160),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  requested_version text not null,
  requested_runtime text not null default 'all',
  trigger_kind text not null check (trigger_kind in ('manual','schedule','webhook','recovery','system')),
  external_revision text,
  configuration_hash text not null check (configuration_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in (
    'queued','discovering','fetching','normalizing','staging','staged',
    'activating','succeeded','retry_wait','failed','cancelled','rolled_back'
  )),
  record_version bigint not null default 1 check (record_version > 0),
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  staged_revision_id uuid references public.source_revisions(id) on delete restrict,
  active_revision_before uuid references public.source_revisions(id) on delete restrict,
  activated_revision_id uuid references public.source_revisions(id) on delete restrict,
  failure_code text,
  failure_message text check (failure_message is null or char_length(failure_message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, source_id, idempotency_key),
  check ((lease_owner is null) = (lease_expires_at is null)),
  check ((failure_code is null) = (failure_message is null))
);

create index if not exists ingestion_jobs_due_idx
  on public.ingestion_jobs(project_id, state, available_at)
  where state in ('queued','retry_wait');
create index if not exists ingestion_jobs_source_idx
  on public.ingestion_jobs(project_id, source_id, created_at desc);
create index if not exists ingestion_jobs_lease_idx
  on public.ingestion_jobs(lease_expires_at)
  where lease_expires_at is not null;

create table if not exists public.ingestion_job_transitions (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  job_id text not null references public.ingestion_jobs(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  from_state text,
  to_state text not null,
  actor text not null check (char_length(actor) between 1 and 160),
  record_version bigint not null check (record_version > 0),
  failure_code text,
  failure_message text check (failure_message is null or char_length(failure_message) <= 500),
  occurred_at timestamptz not null default now(),
  unique(job_id, sequence),
  check ((failure_code is null) = (failure_message is null))
);

create or replace function public.reject_ingestion_transition_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ingestion_job_transitions is append-only';
end;
$$;

drop trigger if exists ingestion_job_transitions_append_only on public.ingestion_job_transitions;
create trigger ingestion_job_transitions_append_only
before update or delete on public.ingestion_job_transitions
for each row execute function public.reject_ingestion_transition_mutation();

alter table public.ingestion_jobs enable row level security;
alter table public.ingestion_job_transitions enable row level security;

create policy ingestion_jobs_project_owner on public.ingestion_jobs
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy ingestion_job_transitions_project_owner on public.ingestion_job_transitions
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));

revoke update, delete on public.ingestion_job_transitions from anon, authenticated;
