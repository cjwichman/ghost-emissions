// Builds web/demo.html by inlining the current model and a trimmed copy of the
// round content into tools/demo.template.html. The output is a single file with
// no imports, so it works both on the published site and opened straight from
// disk.
//
// Run after any change to model/model.js or content/rounds.json:
//     npm run build-demo
//
// The demo is published, so only student-facing round content goes into it. The
// Monday teaching tips and worked examples in content/rounds.json are for the
// instructor page and are dropped here.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');

// Strip the module syntax so the model can run inside a plain <script> tag.
const model = read('model/model.js').replace(/^export /gm, '').trimEnd();

const rounds = JSON.parse(read('content/rounds.json')).map(r => ({
  number: r.number,
  title: r.title,
  config: {
    briefing: { student: r.config.briefing?.student ?? '' },
    borough: { type: r.config.borough?.type ?? 'target', title: r.config.borough?.title ?? '' },
    ...(r.config.events ? { events: r.config.events } : {}),
    ...(r.config.mechanic ? { mechanic: r.config.mechanic } : {}),
  },
}));

const html = read('tools/demo.template.html')
  .replace('/* MODEL */', '// Inlined from model/model.js by tools/build_demo.mjs. Do not edit here.\n' + model)
  .replace('/* ROUNDS */', '// Inlined from content/rounds.json by tools/build_demo.mjs, instructor notes\n// removed. Do not edit here.\nconst ROUNDS = ' + JSON.stringify(rounds, null, 1) + ';');

if (html.includes('/* MODEL */') || html.includes('/* ROUNDS */')) throw new Error('template markers not replaced');
for (const leak of ['"tips"', '"example"', '"howto"']) {
  if (html.includes(leak)) throw new Error('instructor content leaked into the demo: ' + leak);
}
writeFileSync(new URL('web/demo.html', root), html);
console.log('wrote web/demo.html (' + Math.round(html.length / 1024) + ' KB)');
