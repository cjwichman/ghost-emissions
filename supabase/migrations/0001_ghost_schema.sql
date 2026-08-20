-- Ghost Emissions schema. Everything lives in schema "ghost" so the project can
-- share a Supabase instance with other apps. Run in the SQL editor or via
-- `supabase db push`.

create schema if not exists ghost;
grant usage on schema ghost to anon, authenticated, service_role;

-- ---------- classes and people ----------
create table ghost.classes (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,           -- join code students type at sign-up
  name         text not null,
  term         text,
  instructor_id uuid references auth.users(id),
  params       jsonb not null default '{}',    -- overrides for model DEFAULT_PARAMS
  created_at   timestamptz default now()
);

create table ghost.teams (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references ghost.classes(id) on delete cascade,
  borough_key text not null,                   -- matches DEFAULT_BOROUGHS.key
  name        text not null,
  params      jsonb not null,                  -- borough card
  discount_rate numeric,                       -- chosen in the discounting round
  unique (class_id, borough_key)
);

create table ghost.students (
  id             uuid primary key references auth.users(id) on delete cascade,
  class_id       uuid not null references ghost.classes(id) on delete cascade,
  display_name   text not null,
  team_id        uuid references ghost.teams(id) on delete set null,
  firm_name      text,
  firm_type      int check (firm_type between 1 and 5),
  minister_order int,                          -- 1..n within team
  active         boolean not null default true,
  created_at     timestamptz default now()
);

-- ---------- rounds ----------
create table ghost.rounds (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references ghost.classes(id) on delete cascade,
  number      int not null,                    -- 0 = practice
  title       text not null,
  opens_at    timestamptz,
  closes_at   timestamptz,
  status      text not null default 'draft' check (status in ('draft','open','closed','resolved')),
  config      jsonb not null default '{}',     -- decision types, events, briefing, tips, examples
  unique (class_id, number)
);

-- ---------- decisions ----------
create table ghost.firm_decisions (
  round_id     uuid not null references ghost.rounds(id) on delete cascade,
  student_id   uuid not null references ghost.students(id) on delete cascade,
  q            numeric not null default 100,
  a            numeric not null default 0,
  extra        jsonb not null default '{}',    -- rd, relocate, lobby, etc.
  note         text,
  forecast     numeric,                        -- Ether forecast for next round
  submitted_at timestamptz default now(),
  primary key (round_id, student_id)
);

create table ghost.borough_decisions (
  round_id     uuid not null references ghost.rounds(id) on delete cascade,
  team_id      uuid not null references ghost.teams(id) on delete cascade,
  payload      jsonb not null,                 -- { policy:{kind,tau,capTons,aMin}, budget:{...}, vote:..., discountRate:... }
  is_draft     boolean not null default false,
  submitted_by uuid references ghost.students(id),
  submitted_at timestamptz default now(),
  primary key (round_id, team_id)
);

-- ---------- outcomes ----------
create table ghost.round_outcomes (
  round_id      uuid primary key references ghost.rounds(id) on delete cascade,
  totals        jsonb not null,                -- emitted, concentration, ether, hauntings, ...
  state_after   jsonb not null,                -- world state carried to next round
  summary_md    text,                          -- deterministic instructor summary
  resolved_at   timestamptz default now()
);

create table ghost.borough_outcomes (
  round_id   uuid not null references ghost.rounds(id) on delete cascade,
  team_id    uuid not null references ghost.teams(id) on delete cascade,
  data       jsonb not null,                   -- boroughOutcome minus firms
  primary key (round_id, team_id)
);

create table ghost.firm_outcomes (
  round_id   uuid not null references ghost.rounds(id) on delete cascade,
  student_id uuid not null references ghost.students(id) on delete cascade,
  data       jsonb not null,
  primary key (round_id, student_id)
);

-- ---------- helpers ----------
create or replace function ghost.my_class() returns uuid language sql stable security definer as $$
  select class_id from ghost.students where id = auth.uid()
$$;
create or replace function ghost.my_team() returns uuid language sql stable security definer as $$
  select team_id from ghost.students where id = auth.uid()
$$;
create or replace function ghost.is_instructor(c uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from ghost.classes where id = c and instructor_id = auth.uid())
$$;

-- Current minister for a team in a round: rotate by minister_order using round number.
create or replace function ghost.minister_for(p_team uuid, p_round uuid) returns uuid language sql stable security definer as $$
  with r as (select number from ghost.rounds where id = p_round),
       m as (select id, minister_order, row_number() over (order by minister_order) as rn, count(*) over () as n
             from ghost.students where team_id = p_team and active)
  select m.id from m, r where m.rn = ((r.number % m.n) + 1)
$$;

-- Sign-up: attach an auth user to a class by code.
create or replace function ghost.join_class(p_code text, p_name text) returns uuid language plpgsql security definer as $$
declare c uuid;
begin
  select id into c from ghost.classes where code = p_code;
  if c is null then raise exception 'Unknown class code'; end if;
  insert into ghost.students (id, class_id, display_name) values (auth.uid(), c, p_name)
    on conflict (id) do update set display_name = excluded.display_name;
  return c;
end $$;

-- Participation export: one row per student per round.
create or replace view ghost.participation as
  select s.class_id, s.id as student_id, s.display_name, t.name as borough, r.number as round,
         (fd.student_id is not null) as firm_submitted,
         (ghost.minister_for(s.team_id, r.id) = s.id) as was_minister,
         (bd.team_id is not null and not bd.is_draft) as borough_submitted
  from ghost.students s
  join ghost.rounds r on r.class_id = s.class_id and r.status in ('closed','resolved')
  left join ghost.teams t on t.id = s.team_id
  left join ghost.firm_decisions fd on fd.round_id = r.id and fd.student_id = s.id
  left join ghost.borough_decisions bd on bd.round_id = r.id and bd.team_id = s.team_id;

-- ---------- RLS ----------
alter table ghost.classes enable row level security;
alter table ghost.teams enable row level security;
alter table ghost.students enable row level security;
alter table ghost.rounds enable row level security;
alter table ghost.firm_decisions enable row level security;
alter table ghost.borough_decisions enable row level security;
alter table ghost.round_outcomes enable row level security;
alter table ghost.borough_outcomes enable row level security;
alter table ghost.firm_outcomes enable row level security;

-- classes: members and instructor read; instructor writes
create policy classes_read on ghost.classes for select using (id = ghost.my_class() or instructor_id = auth.uid());
create policy classes_write on ghost.classes for all using (instructor_id = auth.uid()) with check (instructor_id = auth.uid());

-- teams: class members read; instructor writes
create policy teams_read on ghost.teams for select using (class_id = ghost.my_class() or ghost.is_instructor(class_id));
create policy teams_write on ghost.teams for all using (ghost.is_instructor(class_id)) with check (ghost.is_instructor(class_id));

-- students: see own row and teammates (name, firm) ; instructor sees all
create policy students_read on ghost.students for select using (id = auth.uid() or team_id = ghost.my_team() or ghost.is_instructor(class_id));
create policy students_self on ghost.students for update using (id = auth.uid()) with check (id = auth.uid());
create policy students_admin on ghost.students for all using (ghost.is_instructor(class_id)) with check (ghost.is_instructor(class_id));

-- rounds: class members read non-draft; instructor all
create policy rounds_read on ghost.rounds for select using ((class_id = ghost.my_class() and status <> 'draft') or ghost.is_instructor(class_id));
create policy rounds_write on ghost.rounds for all using (ghost.is_instructor(class_id)) with check (ghost.is_instructor(class_id));

-- firm decisions: own rows while round open; teammates read after round closes; instructor all
create policy fd_own on ghost.firm_decisions for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and exists (select 1 from ghost.rounds r where r.id = round_id and r.status = 'open'));
create policy fd_team_read on ghost.firm_decisions for select
  using (exists (select 1 from ghost.students s join ghost.rounds r on r.id = round_id
                 where s.id = firm_decisions.student_id and s.team_id = ghost.my_team() and r.status in ('closed','resolved')));
create policy fd_admin on ghost.firm_decisions for all
  using (exists (select 1 from ghost.rounds r where r.id = round_id and ghost.is_instructor(r.class_id)));

-- borough decisions: team reads; anyone on team saves drafts; only minister submits
create policy bd_team_read on ghost.borough_decisions for select using (team_id = ghost.my_team());
create policy bd_draft on ghost.borough_decisions for insert with check (team_id = ghost.my_team() and (is_draft or ghost.minister_for(team_id, round_id) = auth.uid()) and exists (select 1 from ghost.rounds r where r.id = round_id and r.status = 'open'));
create policy bd_update on ghost.borough_decisions for update using (team_id = ghost.my_team()) with check (team_id = ghost.my_team() and (is_draft or ghost.minister_for(team_id, round_id) = auth.uid()) and exists (select 1 from ghost.rounds r where r.id = round_id and r.status = 'open'));
create policy bd_admin on ghost.borough_decisions for all using (exists (select 1 from ghost.rounds r where r.id = round_id and ghost.is_instructor(r.class_id)));

-- outcomes: round and borough outcomes are public (dashboard); firm outcomes to own team and instructor
create policy ro_public on ghost.round_outcomes for select using (true);
create policy bo_public on ghost.borough_outcomes for select using (true);
create policy fo_read on ghost.firm_outcomes for select
  using (student_id = auth.uid()
      or exists (select 1 from ghost.students s where s.id = firm_outcomes.student_id and s.team_id = ghost.my_team())
      or exists (select 1 from ghost.rounds r where r.id = round_id and ghost.is_instructor(r.class_id)));
-- writes to outcomes happen with the service role in the resolver only

grant select on ghost.round_outcomes, ghost.borough_outcomes to anon;
grant select, insert, update, delete on all tables in schema ghost to authenticated;
grant all on all tables in schema ghost to service_role;
grant execute on all functions in schema ghost to authenticated, anon;

-- Public dashboard needs the round list and team names without login.
create policy rounds_public on ghost.rounds for select using (status = 'resolved');
create policy teams_public on ghost.teams for select using (true);
grant select on ghost.rounds, ghost.teams to anon;
