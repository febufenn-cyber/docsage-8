create table if not exists public.corpus_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  ingestion_job_id text references public.ingestion_jobs(id) on delete set null,
  version text not null,
  runtime_scope text not null default 'all',
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  item_count integer not null check (item_count >= 0),
  total_bytes bigint not null default 0 check (total_bytes >= 0),
  state text not null default 'staged' check (state in ('staged','active','retired','failed','rolled_back')),
  previous_revision_id uuid references public.corpus_revisions(id) on delete restrict,
  staged_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz,
  unique(project_id, source_id, manifest_hash)
);

create table if not exists public.corpus_revision_documents (
  corpus_revision_id uuid not null references public.corpus_revisions(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  canonical_locator text not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  metadata_hash text not null check (metadata_hash ~ '^[0-9a-f]{64}$'),
  document_revision_id uuid not null references public.document_revisions(id) on delete restrict,
  position integer not null check (position >= 0),
  reused boolean not null default false,
  quarantined boolean not null default false,
  primary key(corpus_revision_id, canonical_locator),
  unique(corpus_revision_id, position)
);

create table if not exists public.corpus_revision_tombstones (
  corpus_revision_id uuid not null references public.corpus_revisions(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  canonical_locator text not null,
  prior_document_revision_id uuid references public.document_revisions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(corpus_revision_id, canonical_locator)
);

create index if not exists corpus_revisions_scope_idx
  on public.corpus_revisions(project_id, source_id, version, runtime_scope, staged_at desc);
create unique index if not exists corpus_revisions_one_active_idx
  on public.corpus_revisions(project_id, source_id, version, runtime_scope)
  where state = 'active';
create index if not exists corpus_revision_documents_revision_idx
  on public.corpus_revision_documents(document_revision_id);

alter table public.corpus_revisions enable row level security;
alter table public.corpus_revision_documents enable row level security;
alter table public.corpus_revision_tombstones enable row level security;

create policy corpus_revisions_project_owner on public.corpus_revisions
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy corpus_revision_documents_project_owner on public.corpus_revision_documents
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy corpus_revision_tombstones_project_owner on public.corpus_revision_tombstones
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
