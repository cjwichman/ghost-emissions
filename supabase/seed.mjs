// Seed a class: boroughs and rounds. Run once per term.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/seed.mjs --code ECON4210F26 --name "ECON 4210 Fall 2026" --instructor <auth user id> [--start 2026-08-31] [--skip 2026-09-21,2026-11-09]
// --start is the Monday the practice round opens. --skip lists Mondays with no round (exam weeks); later rounds shift.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { DEFAULT_BOROUGHS } from '../model/model.js';

const arg = k => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : null; };
const code = arg('code'), name = arg('name'), instructor = arg('instructor'), start = arg('start');
const skips = new Set((arg('skip') ?? '').split(',').filter(Boolean));
if (!code || !name || !instructor) { console.error('need --code --name --instructor'); process.exit(1); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'ghost' } });

const { data: cls, error } = await sb.from('classes').upsert({ code, name, instructor_id: instructor }, { onConflict: 'code' }).select().single();
if (error) throw error;
for (const b of DEFAULT_BOROUGHS) await sb.from('teams').upsert({ class_id: cls.id, borough_key: b.key, name: b.name, params: b }, { onConflict: 'class_id,borough_key' });
const rounds = JSON.parse(readFileSync(new URL('../content/rounds.json', import.meta.url)));
// Round n opens Monday of week n after `start` (a Monday), closes the following Sunday 23:59 local.
const t0 = start ? new Date(start + 'T15:30:00') : null;
let week = 0;
for (const r of rounds) {
  const row = { class_id: cls.id, number: r.number, title: r.title, config: r.config, status: r.number === 0 ? 'open' : 'draft' };
  if (t0) {
    let o = new Date(t0.getTime() + week * 7 * 864e5);
    while (skips.has(o.toISOString().slice(0, 10))) { week++; o = new Date(t0.getTime() + week * 7 * 864e5); }
    const c = new Date(o.getTime()); c.setDate(c.getDate() + 6); c.setHours(23, 59, 0, 0);
    row.opens_at = o.toISOString(); row.closes_at = c.toISOString(); week++;
    console.log(`round ${r.number} opens ${o.toDateString()}`);
  }
  await sb.from('rounds').upsert(row, { onConflict: 'class_id,number' });
}
console.log('seeded class', cls.id, 'code', code);
