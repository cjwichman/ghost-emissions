-- Assign a borough and a business type when a student joins, instead of waiting
-- for the instructor to run auto-assign. With ~45 students registering in a
-- scatter over several days, batch assignment leaves everyone who signs up early
-- looking at a holding screen, and everyone who signs up late unable to play the
-- round that is already open.
--
-- Rules:
--   * borough  = picked at random among the boroughs tied for fewest active
--                members, so boroughs stay balanced without seating friends who
--                register together on the same team
--   * type     = the business type least represented in that borough, ties broken
--                by the borough's position so a sixth member is not always a
--                second bakery
--   * order    = appended to the end of the mayor rotation
--
-- Only students with no team are assigned, so re-joining never reshuffles anyone
-- and any manual reassignment on the instructor page survives. The instructor's
-- auto-assign button still works and is the fallback for anyone left unplaced.

create or replace function ghost.join_class(p_code text, p_name text) returns uuid language plpgsql security definer as $$
declare
  c            uuid;
  v_team       uuid;
  v_type       int;
  v_order      int;
  v_offset     int;
  v_has_team   boolean;
begin
  select id into c from ghost.classes where code = p_code;
  if c is null then raise exception 'Unknown class code'; end if;

  insert into ghost.students (id, class_id, display_name) values (auth.uid(), c, p_name)
    on conflict (id) do update set display_name = excluded.display_name;

  select team_id is not null into v_has_team from ghost.students where id = auth.uid();
  if v_has_team then return c; end if;

  -- Serialize assignment per class. Without this, students registering at the
  -- same time all read the same "fewest members" count and pile into one borough.
  perform pg_advisory_xact_lock(hashtext(c::text));

  select t.id into v_team
  from ghost.teams t
  left join ghost.students s on s.team_id = t.id and s.active
  where t.class_id = c
  group by t.id
  order by count(s.id), random()
  limit 1;

  -- No teams seeded yet: leave the student unassigned rather than failing the
  -- signup. The instructor's auto-assign button picks them up later.
  if v_team is null then return c; end if;

  select count(*) into v_order from ghost.students where team_id = v_team and active;

  -- Rotate which type repeats when a borough has six members, so the extra
  -- student is not always a bakery. The offset is the borough's alphabetical
  -- position within the class.
  select count(*) into v_offset
    from ghost.teams t2
   where t2.class_id = c
     and t2.borough_key < (select borough_key from ghost.teams where id = v_team);

  select gs.ty into v_type
    from generate_series(1, 5) as gs(ty)
    left join ghost.students s
      on s.team_id = v_team and s.active and s.firm_type = gs.ty
   group by gs.ty
   order by count(s.id), (gs.ty - 1 + v_offset) % 5, gs.ty
   limit 1;

  update ghost.students
     set team_id = v_team, firm_type = v_type, minister_order = v_order + 1
   where id = auth.uid();

  return c;
end $$;
