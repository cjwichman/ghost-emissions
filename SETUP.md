# Setup

## 1. Supabase
1. Create a project (or reuse one). In SQL editor run `supabase/migrations/0001_ghost_schema.sql`.
2. Settings > API > Exposed schemas: add `ghost`.
3. Auth > Providers: email/password on. Auth > URL Configuration: add the game's URL to Redirect URLs (Site URL can stay as is if the project is shared with another app). Password-reset links open the game's "Set a new password" screen.
4. Deploy the edge functions (Supabase CLI):

       supabase functions deploy preview --no-verify-jwt
       supabase functions deploy resolve_round --no-verify-jwt

   Both functions read the caller's JWT themselves. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are available to functions by default.
5. Sign yourself up as an ordinary user once (any email), then copy your auth user id from Auth > Users.

## 2. Seed the class

    npm install
    SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
      npm run seed -- --code ECON4210F26 --name "ECON 4210 Fall 2026" --instructor <your auth user id> --start 2026-08-31

`--start` is the Monday of the practice week. Rounds open on Mondays and close Sundays 23:59. Add `--skip 2026-09-21,2026-11-09` (comma-separated Mondays) to leave exam weeks empty. Later rounds shift. Re-running the seed is safe and overwrites dates. Edit individual dates on the instructor page.

## 3. Front end
1. Put your project URL and anon key in `web/js/config.js`.
2. Publish `web/` on GitHub Pages (or copy it into a `game/` folder of an existing Pages site).
3. Public dashboard: `https://your.site/game/?class=ECON4210F26#board`.

## 4. Term workflow
- Students create accounts with the class code. After add/drop, assign boroughs on the instructor page (Teams and students), then click Auto-assign to set business types and mayor order. Late adds: same sign-up, then assign.
- Weekly: round closes Sunday night by date. Monday, open the instructor page, click Resolve, project the dashboard. Resolving opens the next round.
- Events: round 4 needs two team ids in `events.damageRevision.teamIds` (edit the round config). Rounds 7, 10, 11, 12 are pre-wired.
- Exports: participation CSV (one row per student per round: business submitted, was mayor, borough submitted) and outcome CSVs.

## Model changes
Edit `model/model.js`, run `npm test`, then `npm run sync-model` and redeploy the two functions. The browser never receives the model.

## Resetting
- Instructor page > Reset round N: deletes that round's decisions and outcomes (and any later rounds'), reopens it. Conbusiness by typing the round number.
- Instructor page > Danger zone > Reset whole class: deletes all play data, round 0 back to open, others to draft. Requires typing the class code and two conbusinessations. Use after testing, before the term.
- Run `supabase/migrations/0002_reset_and_join.sql` once to add these functions and the sign-up code check.
