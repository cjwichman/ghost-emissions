-- Reset helpers and a class-code check for sign-up. Run after 0001.

-- Anyone can ask whether a class code exists (no other data returned).
create or replace function ghost.class_exists(p_code text) returns boolean language sql stable security definer as $$
  select exists (select 1 from ghost.classes where code = p_code)
$$;
grant execute on function ghost.class_exists(text) to anon, authenticated;

-- Reset one round: delete its decisions and outcomes, reopen it, and put every later round back to draft.
create or replace function ghost.reset_round(p_round uuid) returns void language plpgsql security definer as $$
declare c uuid; n int;
begin
  select class_id, number into c, n from ghost.rounds where id = p_round;
  if c is null or not ghost.is_instructor(c) then raise exception 'instructor only'; end if;
  delete from ghost.firm_outcomes where round_id = p_round;
  delete from ghost.borough_outcomes where round_id = p_round;
  delete from ghost.round_outcomes where round_id = p_round;
  delete from ghost.firm_decisions where round_id = p_round;
  delete from ghost.borough_decisions where round_id = p_round;
  update ghost.rounds set status = 'open' where id = p_round;
  -- later rounds cannot stay resolved if this one is reopened
  update ghost.rounds set status = 'draft' where class_id = c and number > n;
  delete from ghost.firm_outcomes where round_id in (select id from ghost.rounds where class_id = c and number > n);
  delete from ghost.borough_outcomes where round_id in (select id from ghost.rounds where class_id = c and number > n);
  delete from ghost.round_outcomes where round_id in (select id from ghost.rounds where class_id = c and number > n);
  delete from ghost.firm_decisions where round_id in (select id from ghost.rounds where class_id = c and number > n);
  delete from ghost.borough_decisions where round_id in (select id from ghost.rounds where class_id = c and number > n);
end $$;

-- Reset the whole class: all play data gone, rounds back to start. Students and teams stay unless p_clear_teams.
create or replace function ghost.reset_class(p_class uuid, p_code text, p_clear_teams boolean default false) returns void language plpgsql security definer as $$
begin
  if not ghost.is_instructor(p_class) then raise exception 'instructor only'; end if;
  if not exists (select 1 from ghost.classes where id = p_class and code = p_code) then raise exception 'class code does not match'; end if;
  delete from ghost.firm_outcomes where round_id in (select id from ghost.rounds where class_id = p_class);
  delete from ghost.borough_outcomes where round_id in (select id from ghost.rounds where class_id = p_class);
  delete from ghost.round_outcomes where round_id in (select id from ghost.rounds where class_id = p_class);
  delete from ghost.firm_decisions where round_id in (select id from ghost.rounds where class_id = p_class);
  delete from ghost.borough_decisions where round_id in (select id from ghost.rounds where class_id = p_class);
  update ghost.rounds set status = case when number = 0 then 'open' else 'draft' end where class_id = p_class;
  update ghost.teams set discount_rate = null where class_id = p_class;
  if p_clear_teams then update ghost.students set team_id = null, firm_type = null, minister_order = null where class_id = p_class; end if;
end $$;
grant execute on function ghost.reset_round(uuid), ghost.reset_class(uuid, text, boolean) to authenticated;
