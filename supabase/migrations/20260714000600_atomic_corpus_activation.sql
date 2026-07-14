create table if not exists public.corpus_activation_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  version text not null,
  runtime_scope text not null,
  action text not null check (action in ('activate','rollback')),
  from_revision_id uuid references public.corpus_revisions(id) on delete restrict,
  to_revision_id uuid not null references public.corpus_revisions(id) on delete restrict,
  actor text not null check (char_length(actor) between 1 and 160),
  occurred_at timestamptz not null default now()
);

create or replace function public.reject_corpus_activation_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'corpus_activation_events is append-only';
end;
$$;

drop trigger if exists corpus_activation_events_append_only on public.corpus_activation_events;
create trigger corpus_activation_events_append_only
before update or delete on public.corpus_activation_events
for each row execute function public.reject_corpus_activation_event_mutation();

create or replace function public.activate_corpus_revision(
  target_project uuid,
  target_revision uuid,
  expected_active_revision uuid,
  activation_actor text
)
returns table(previous_revision_id uuid, active_revision_id uuid)
language plpgsql security invoker set search_path = public
as $$
declare
  candidate public.corpus_revisions%rowtype;
  previous public.corpus_revisions%rowtype;
  membership_count integer;
begin
  if not public.owns_project(target_project) then
    raise exception 'project access denied';
  end if;
  if activation_actor is null or char_length(trim(activation_actor)) not between 1 and 160 then
    raise exception 'invalid activation actor';
  end if;

  select * into candidate
  from public.corpus_revisions
  where id = target_revision and project_id = target_project
  for update;
  if not found then raise exception 'candidate revision not found'; end if;
  if candidate.state <> 'staged' then raise exception 'candidate revision is not staged'; end if;

  select * into previous
  from public.corpus_revisions
  where project_id = candidate.project_id
    and source_id = candidate.source_id
    and version = candidate.version
    and runtime_scope = candidate.runtime_scope
    and state = 'active'
  for update;

  if expected_active_revision is distinct from previous.id then
    raise exception 'active revision conflict';
  end if;
  if candidate.previous_revision_id is not null and candidate.previous_revision_id is distinct from previous.id then
    raise exception 'candidate was staged from a stale revision';
  end if;

  select count(*) into membership_count
  from public.corpus_revision_documents d
  where d.corpus_revision_id = candidate.id and d.project_id = candidate.project_id and d.source_id = candidate.source_id;
  if membership_count <> candidate.item_count then
    raise exception 'candidate document membership is incomplete';
  end if;
  if exists (
    select 1 from public.corpus_revision_documents d
    where d.corpus_revision_id = candidate.id and d.quarantined
  ) then
    raise exception 'quarantined documents cannot activate';
  end if;

  if previous.id is not null then
    update public.corpus_revisions
    set state = 'retired', retired_at = now()
    where id = previous.id;
  end if;

  update public.corpus_revisions
  set state = 'active', activated_at = now(), retired_at = null
  where id = candidate.id;

  insert into public.corpus_activation_events(
    project_id, source_id, version, runtime_scope, action,
    from_revision_id, to_revision_id, actor
  ) values (
    candidate.project_id, candidate.source_id, candidate.version, candidate.runtime_scope, 'activate',
    previous.id, candidate.id, trim(activation_actor)
  );

  return query select previous.id, candidate.id;
end;
$$;

create or replace function public.rollback_corpus_revision(
  target_project uuid,
  target_revision uuid,
  expected_active_revision uuid,
  rollback_actor text
)
returns table(previous_revision_id uuid, active_revision_id uuid)
language plpgsql security invoker set search_path = public
as $$
declare
  target public.corpus_revisions%rowtype;
  current public.corpus_revisions%rowtype;
  membership_count integer;
begin
  if not public.owns_project(target_project) then
    raise exception 'project access denied';
  end if;
  if rollback_actor is null or char_length(trim(rollback_actor)) not between 1 and 160 then
    raise exception 'invalid rollback actor';
  end if;

  select * into target
  from public.corpus_revisions
  where id = target_revision and project_id = target_project
  for update;
  if not found then raise exception 'rollback target not found'; end if;
  if target.state not in ('retired','rolled_back') then raise exception 'rollback target was not previously active'; end if;

  select * into current
  from public.corpus_revisions
  where project_id = target.project_id
    and source_id = target.source_id
    and version = target.version
    and runtime_scope = target.runtime_scope
    and state = 'active'
  for update;
  if not found then raise exception 'active revision not found'; end if;
  if current.id is distinct from expected_active_revision then raise exception 'active revision conflict'; end if;

  select count(*) into membership_count
  from public.corpus_revision_documents d
  where d.corpus_revision_id = target.id and d.project_id = target.project_id and d.source_id = target.source_id;
  if membership_count <> target.item_count then raise exception 'rollback target document membership is incomplete'; end if;
  if exists (
    select 1 from public.corpus_revision_documents d
    where d.corpus_revision_id = target.id and d.quarantined
  ) then raise exception 'quarantined documents cannot activate'; end if;

  update public.corpus_revisions
  set state = 'rolled_back', retired_at = now()
  where id = current.id;

  update public.corpus_revisions
  set state = 'active', activated_at = now(), retired_at = null
  where id = target.id;

  insert into public.corpus_activation_events(
    project_id, source_id, version, runtime_scope, action,
    from_revision_id, to_revision_id, actor
  ) values (
    target.project_id, target.source_id, target.version, target.runtime_scope, 'rollback',
    current.id, target.id, trim(rollback_actor)
  );

  return query select current.id, target.id;
end;
$$;

alter table public.corpus_activation_events enable row level security;
create policy corpus_activation_events_project_owner on public.corpus_activation_events
  for select using (public.owns_project(project_id));
revoke update, delete on public.corpus_activation_events from anon, authenticated;
