-- Suggestion-only rows (a teammate sent the mayor a suggestion without submitting
-- their own mission) should not count as participation.
create or replace view ghost.participation as
  select s.class_id, s.id as student_id, s.display_name, t.name as borough, r.number as round,
         (fd.student_id is not null and coalesce((fd.extra->>'suggestion_only')::boolean, false) = false) as firm_submitted,
         (ghost.minister_for(s.team_id, r.id) = s.id) as was_minister,
         (bd.team_id is not null and not bd.is_draft) as borough_submitted
  from ghost.students s
  join ghost.rounds r on r.class_id = s.class_id and r.status in ('closed','resolved')
  left join ghost.teams t on t.id = s.team_id
  left join ghost.firm_decisions fd on fd.round_id = r.id and fd.student_id = s.id
  left join ghost.borough_decisions bd on bd.round_id = r.id and bd.team_id = s.team_id;
