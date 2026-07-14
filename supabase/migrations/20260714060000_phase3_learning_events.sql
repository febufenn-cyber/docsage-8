create table if not exists public.learning_events (
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null,
  schema_version smallint not null default 1 check (schema_version = 1),
  event_type text not null check (event_type in (
    'answer.completed', 'answer.refused', 'feedback.recorded', 'source.health', 'evaluation.failed'
  )),
  event_source text not null check (event_source in (
    'answer', 'widget', 'feedback', 'ingestion', 'evaluation', 'system'
  )),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  trace_id text,
  answer_state text,
  feedback_rating text check (feedback_rating is null or feedback_rating in ('useful', 'not_useful')),
  feedback_reason text,
  source_status text check (source_status is null or source_status in ('healthy', 'degraded', 'failed', 'unknown')),
  failure_code text,
  citation_count integer check (citation_count is null or citation_count between 0 and 100),
  latency_ms numeric check (latency_ms is null or latency_ms between 0 and 300000),
  question_fingerprint text check (question_fingerprint is null or question_fingerprint ~ '^[0-9a-f]{64}$'),
  question_excerpt text check (question_excerpt is null or char_length(question_excerpt) <= 241),
  redaction_count integer not null default 0 check (redaction_count >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  payload_hash text not null,
  primary key (project_id, event_id)
);

create index if not exists learning_events_project_occurred_idx
  on public.learning_events(project_id, occurred_at desc, event_id);
create index if not exists learning_events_project_type_idx
  on public.learning_events(project_id, event_type, occurred_at desc);
create index if not exists learning_events_project_fingerprint_idx
  on public.learning_events(project_id, question_fingerprint)
  where question_fingerprint is not null;
create index if not exists learning_events_project_trace_idx
  on public.learning_events(project_id, trace_id)
  where trace_id is not null;

alter table public.learning_events enable row level security;

create policy learning_events_project_owner_select
  on public.learning_events for select
  using (public.owns_project(project_id));

create policy learning_events_project_owner_insert
  on public.learning_events for insert
  with check (public.owns_project(project_id));

revoke update, delete on public.learning_events from authenticated, anon;

comment on table public.learning_events is
  'Append-only, privacy-bounded Phase 3 learning events. Raw questions and answers are not stored by default.';
comment on column public.learning_events.question_fingerprint is
  'Project-salted SHA-256 digest of normalized redacted question text.';
comment on column public.learning_events.question_excerpt is
  'Bounded redacted excerpt for operator triage; never an unfiltered raw prompt.';
