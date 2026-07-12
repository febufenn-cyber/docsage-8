create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  current_version text not null default 'current',
  created_at timestamptz not null default now()
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type text not null check (source_type in ('sitemap','url','github')),
  canonical_root text not null,
  authority_level smallint not null check (authority_level between 1 and 9),
  runtime_scope text not null default 'all',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(project_id, canonical_root)
);

create table if not exists public.source_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  external_revision text,
  content_manifest_hash text not null,
  active boolean not null default true,
  discovered_at timestamptz not null default now(),
  unique(source_id, content_manifest_hash)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  canonical_locator text not null,
  unique(source_id, canonical_locator)
);

create table if not exists public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  source_revision_id uuid not null references public.source_revisions(id) on delete cascade,
  content_hash text not null,
  title text not null,
  product_version text,
  runtime_scope text not null default 'all',
  authority_level smallint not null,
  normalized jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(document_id, source_revision_id, content_hash)
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_revision_id uuid not null references public.source_revisions(id) on delete cascade,
  document_revision_id uuid not null references public.document_revisions(id) on delete cascade,
  chunk_key text not null,
  heading_path text[] not null default '{}',
  search_text text not null,
  display_text text not null,
  citation_anchor text,
  product_version text,
  runtime_scope text not null default 'all',
  authority_level smallint not null,
  embedding vector,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(document_revision_id, chunk_key)
);

create index if not exists document_chunks_project_active_idx on public.document_chunks(project_id, active);
create index if not exists document_chunks_search_idx on public.document_chunks using gin(to_tsvector('english', search_text));

create table if not exists public.retrieval_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  question text not null,
  requested_version text,
  requested_runtime text,
  configuration jsonb not null,
  ranked_chunk_ids uuid[] not null default '{}',
  latency_ms numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  retrieval_run_id uuid references public.retrieval_runs(id) on delete set null,
  answer_state text not null,
  answer_text text not null,
  assumptions jsonb not null default '{}',
  claims jsonb not null default '[]',
  failures text[] not null default '{}',
  provider text not null,
  latency_ms numeric,
  variable_cost_usd numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.citations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  answer_id uuid not null references public.answers(id) on delete cascade,
  chunk_id uuid not null references public.document_chunks(id) on delete restrict,
  claim_index integer,
  validation jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.sources enable row level security;
alter table public.source_revisions enable row level security;
alter table public.documents enable row level security;
alter table public.document_revisions enable row level security;
alter table public.document_chunks enable row level security;
alter table public.retrieval_runs enable row level security;
alter table public.answers enable row level security;
alter table public.citations enable row level security;

create policy projects_owner_all on public.projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.owns_project(target_project uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.projects p where p.id = target_project and p.owner_id = auth.uid()) $$;

create policy sources_project_owner on public.sources for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy source_revisions_project_owner on public.source_revisions for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy documents_project_owner on public.documents for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy document_revisions_project_owner on public.document_revisions for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy document_chunks_project_owner on public.document_chunks for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy retrieval_runs_project_owner on public.retrieval_runs for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy answers_project_owner on public.answers for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy citations_project_owner on public.citations for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create or replace function public.match_document_chunks(
  target_project uuid,
  query_embedding vector,
  target_version text default null,
  target_runtime text default 'all',
  result_limit integer default 20
)
returns table (
  id uuid,
  document_revision_id uuid,
  similarity double precision,
  heading_path text[],
  display_text text,
  citation_anchor text,
  authority_level smallint
)
language sql stable security invoker set search_path = public
as $$
  select c.id, c.document_revision_id, 1 - (c.embedding <=> query_embedding) as similarity,
         c.heading_path, c.display_text, c.citation_anchor, c.authority_level
  from public.document_chunks c
  where c.project_id = target_project
    and c.active
    and c.embedding is not null
    and (target_version is null or c.product_version = target_version or c.product_version is null)
    and (target_runtime = 'all' or c.runtime_scope = 'all' or c.runtime_scope = target_runtime)
  order by c.embedding <=> query_embedding
  limit greatest(1, least(result_limit, 100));
$$;
