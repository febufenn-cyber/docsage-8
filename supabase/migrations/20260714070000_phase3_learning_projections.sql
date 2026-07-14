create table if not exists public.learning_daily_metrics (
  project_id uuid not null references public.projects(id) on delete cascade,
  metric_day date not null,
  total_events integer not null check (total_events >= 0),
  actionable_events integer not null check (actionable_events >= 0),
  by_type jsonb not null default '{}'::jsonb,
  by_category jsonb not null default '{}'::jsonb,
  feedback jsonb not null default '{}'::jsonb,
  rebuilt_at timestamptz not null default now(),
  primary key (project_id, metric_day)
);

create table if not exists public.learning_clusters (
  project_id uuid not null references public.projects(id) on delete cascade,
  cluster_key text not null,
  category text not null,
  severity text not null,
  actionable boolean not null,
  event_count integer not null check (event_count >= 0),
  negative_feedback_count integer not null check (negative_feedback_count >= 0),
  first_seen_at timestamptz not null,
  latest_seen_at timestamptz not null,
  question_fingerprint text,
  question_excerpt text,
  answer_states jsonb not null default '{}'::jsonb,
  event_types jsonb not null default '{}'::jsonb,
  failure_codes jsonb not null default '{}'::jsonb,
  rebuilt_at timestamptz not null default now(),
  primary key (project_id, cluster_key)
);

create table if not exists public.learning_source_health (
  project_id uuid not null references public.projects(id) on delete cascade,
  source_key text not null,
  health_status text not null check (health_status in ('healthy', 'degraded', 'failed', 'unknown')),
  failure_code text,
  occurred_at timestamptz not null,
  source_event_id uuid not null,
  rebuilt_at timestamptz not null default now(),
  primary key (project_id, source_key)
);

create index if not exists learning_clusters_project_priority_idx
  on public.learning_clusters(project_id, actionable desc, negative_feedback_count desc, event_count desc);
create index if not exists learning_source_health_project_status_idx
  on public.learning_source_health(project_id, health_status);

alter table public.learning_daily_metrics enable row level security;
alter table public.learning_clusters enable row level security;
alter table public.learning_source_health enable row level security;

create policy learning_daily_metrics_project_owner on public.learning_daily_metrics
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy learning_clusters_project_owner on public.learning_clusters
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy learning_source_health_project_owner on public.learning_source_health
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));

comment on table public.learning_daily_metrics is 'Rebuildable projection derived only from append-only learning_events.';
comment on table public.learning_clusters is 'Deterministic project-scoped learning clusters; safe to drop and rebuild.';
comment on table public.learning_source_health is 'Latest deterministic source-health projection per project and source key.';
