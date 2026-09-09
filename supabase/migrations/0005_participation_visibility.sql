-- ghost.participation is a view, so it runs with its owner's permissions and
-- ignores row level security on the tables underneath. Combined with the blanket
-- `grant select ... to authenticated` in 0001, that let any signed-in student
-- query the view and read every classmate's name, borough and per-round
-- submission record.
--
-- Switching the view to security_invoker would push the check down to the RLS
-- policies on firm_decisions and borough_decisions, but those are written around
-- a student reading their own row or a teammate's, so the instructor's export
-- would come back empty. Filtering inside the view keeps the export working and
-- closes the leak in one place.
--
-- Rows are now visible to the instructor of the class, and to a student for
-- their own record.

create or replace view ghost.participation as
  select s.class_id, s.id as student_id, s.display_name, t.name as borough, r.number as round,
         (fd.student_id is not null and coalesce((fd.extra->>'suggestion_only')::boolean, false) = false) as firm_submitted,
         (ghost.minister_for(s.team_id, r.id) = s.id) as was_minister,
         (bd.team_id is not null and not bd.is_draft) as borough_submitted
  from ghost.students s
  join ghost.rounds r on r.class_id = s.class_id and r.status in ('closed','resolved')
  left join ghost.teams t on t.id = s.team_id
  left join ghost.firm_decisions fd on fd.round_id = r.id and fd.student_id = s.id
  left join ghost.borough_decisions bd on bd.round_id = r.id and bd.team_id = s.team_id
  where ghost.is_instructor(s.class_id) or s.id = auth.uid();
