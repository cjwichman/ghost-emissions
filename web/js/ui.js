// Small SVG helpers. No dependencies.

export const GHOST_PATH = "M13.2 2C9.1 2 6 5.4 6 9.7v3.5c0 1.6-.6 2.7-2 3.6-1 .7-2.4 1.5-2.7 3-.2 1 .8 1.8 1.7 1.4 1.7-.7 3.3-1.9 5-2 .7 0 1.3.5 1.7 1.1.5.8 1.3 1.3 2.4 1.3 1.2 0 2-.6 2.5-1.5.4-.6 1.1-.9 1.8-.6 1 .5 2 1.2 3.2 1.1.9-.1 1.3-1.1.7-1.8-.6-.7-1.1-1.5-1.1-2.6V9.7C20.4 5.4 17.3 2 13.2 2z";
export const GHOST_SVG = (size = 18, fill = "#6CC24A") => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${GHOST_PATH}" fill="${fill}"/><ellipse cx="10.7" cy="9.7" rx="1.1" ry="1.5" fill="#1B2233"/><ellipse cx="15.2" cy="9.7" rx="1.1" ry="1.5" fill="#1B2233"/><ellipse cx="13" cy="13.8" rx="1.3" ry="2.1" fill="#1B2233"/></svg>`;
const marker = (x, y, fill) => `<g transform="translate(${x},${y}) scale(0.6) translate(-12,-12)"><path d="${GHOST_PATH}" fill="${fill}"/><ellipse cx="10.7" cy="9.7" rx="1.1" ry="1.5" fill="#1B2233"/><ellipse cx="15.2" cy="9.7" rx="1.1" ry="1.5" fill="#1B2233"/><ellipse cx="13" cy="13.8" rx="1.3" ry="2.1" fill="#1B2233"/></g>`;

export const TRADES = {
  1: { trade: "Bakery", unit: "batches", blurb: "You run the borough's bakery. Ovens vent gently, so traps clip right on. Cheapest containment in the borough." },
  2: { trade: "Laundry", unit: "loads", blurb: "You run the borough's laundry. Ghosts ride the steam, and filters catch most of them. Cheap containment." },
  3: { trade: "Brewery", unit: "barrels", blurb: "You run the borough's brewery. Fermentation leaks, but traps fit the vents. Mid-priced containment." },
  4: { trade: "Freight depot", unit: "truckloads", blurb: "You run the borough's freight depot. Ghosts escape on the road, where traps can't reach. Expensive containment." },
  5: { trade: "Foundry", unit: "castings", blurb: "You run the borough's foundry. Ghosts pour off white-hot metal. Most expensive containment in the borough." },
};

export const KEY_ROWS = [
  ["Ghost emissions", "greenhouse gas emissions"],
  ["Ghost concentration", "the stock of GHGs in the atmosphere"],
  ["The Ether", "global temperature"],
  ["Hauntings", "climate damages"],
  ["Containment", "abatement"],
  ["Trap technology", "abatement technology"],
  ["The Institute", "your Monday briefing"],
];
const mono = 'font-family="IBM Plex Mono" font-size="10" fill="#5A6272"';

// MAC chart. Firm: linear MAC = slope * a. Borough: aggregate MAC (piecewise, drawn as curve).
export function drawMAC({ a = 0, price = null, slope = 600, label = "tax", borough = false, md = null, techMult = 1, contained = 0 }) {
  const W = 340, H = 190, x0 = 40, y0 = 160, xw = 290, yh = 150;
  const ymax = borough ? 260 : Math.max(slope, price ?? 0) * 1.05;   // dollars per ton at the top
  const Y = v => y0 - yh * Math.min(1, v / ymax);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%"><line x1="${x0}" y1="${y0}" x2="${x0 + xw}" y2="${y0}" stroke="#D8DCE2"/><line x1="${x0}" y1="10" x2="${x0}" y2="${y0}" stroke="#D8DCE2"/>`;
  if (!borough) {
    s += `<line x1="${x0}" y1="${y0}" x2="${x0 + xw}" y2="${Y(slope)}" stroke="#1B2233" stroke-width="2"/>`;
    if (price != null) {
      const py = Y(price), px = x0 + xw * Math.min(1, price / slope);
      s += `<line x1="${x0}" y1="${py}" x2="${x0 + xw}" y2="${py}" stroke="#E0713C" stroke-width="2" stroke-dasharray="5 4"/><text x="${x0 + xw - 4}" y="${py - 6}" font-size="11" fill="#E0713C" text-anchor="end" font-family="IBM Plex Mono">${label} $${Math.round(price)}</text>`;
      s += `<polygon points="${x0},${y0} ${px},${y0} ${px},${py}" fill="#6CC24A" opacity=".3"/>`;
    }
    const ax = x0 + xw * a, ay = Y(slope * a);
    s += marker(ax, ay, "#3F8A29");
    s += `<text x="${x0}" y="178" ${mono}>0%</text><text x="${x0 + xw}" y="178" ${mono} text-anchor="end">100% contained</text><text x="8" y="14" ${mono}>$/t</text>`;
  } else {
    // aggregate MAC across five types with slopes 200*c*techMult: piecewise-linear in tons; drawn against share contained
    const pts = []; for (let i = 0; i <= 40; i++) { const p = ymax * i / 40; const share = [1, 2, 3, 4, 5].reduce((t, c) => t + Math.min(1, p / (200 * c * techMult)), 0) / 5; pts.push([x0 + xw * share, Y(p)]); }
    s += `<path d="M${pts.map(p => p.join(",")).join(" L")}" fill="none" stroke="#1B2233" stroke-width="2"/>`;
    if (md != null) s += `<line x1="${x0}" y1="${Y(md)}" x2="${x0 + xw}" y2="${Y(md)}" stroke="#6E5A9E" stroke-width="2" stroke-dasharray="5 4"/><text x="${x0 + xw - 4}" y="${Y(md) - 6}" font-size="11" fill="#6E5A9E" text-anchor="end" font-family="IBM Plex Mono">one more ghost costs the city ≈ $${md}</text>`;
    if (price != null) { s += `<line x1="${x0}" y1="${Y(price)}" x2="${x0 + xw}" y2="${Y(price)}" stroke="#E0713C" stroke-width="2" stroke-dasharray="5 4"/><text x="${x0 + xw - 4}" y="${Y(price) - 6}" font-size="11" fill="#E0713C" text-anchor="end" font-family="IBM Plex Mono">${label} $${Math.round(price)}</text>`; }
    const cx = x0 + xw * contained; const cy = pts.reduce((best, p) => Math.abs(p[0] - cx) < Math.abs(best[0] - cx) ? p : best, pts[0])[1];
    s += marker(cx, cy, "#E0713C");
    s += `<text x="${x0}" y="178" ${mono}>borough containment →</text><text x="8" y="14" ${mono}>$/t</text>`;
  }
  return s + `</svg>`;
}

// Ether path: actual so far, projection at current pace, cooperative reference.
export function drawEther(series, coopEmissions, lastEmitted, totalRounds = 12) {
  const W = 520, H = 210, x0 = 40, y0 = 180, xw = 460, yh = 160, ymax = 4;
  const X = n => x0 + xw * n / totalRounds, Y = v => y0 - yh * Math.min(1, v / ymax);
  const k = 0.000231, base = 0.5;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%"><line x1="${x0}" y1="${y0}" x2="${x0 + xw}" y2="${y0}" stroke="#D8DCE2"/><line x1="${x0}" y1="20" x2="${x0}" y2="${y0}" stroke="#D8DCE2"/>`;
  s += `<line x1="${x0}" y1="${Y(2)}" x2="${x0 + xw}" y2="${Y(2)}" stroke="#E0713C" stroke-dasharray="3 4"/><text x="${x0 + xw - 4}" y="${Y(2) - 6}" font-size="11" fill="#E0713C" text-anchor="end" font-family="IBM Plex Mono">2.0</text>`;
  // cooperative reference from round 0
  if (coopEmissions) { const cp = []; for (let n = 0; n <= totalRounds; n++) cp.push([X(n), Y(base + k * coopEmissions * n)]); s += `<path d="M${cp.map(p => p.join(",")).join(" L")}" fill="none" stroke="#1B2233" stroke-width="2" stroke-dasharray="6 5"/>`; }
  const pts = [[X(0), Y(base)], ...series.map(p => [X(p.n), Y(p.ether)])];
  s += `<path d="M${pts.map(p => p.join(",")).join(" L")}" fill="none" stroke="#6CC24A" stroke-width="3"/>`;
  const lastN = series.at(-1)?.n ?? 0, lastE = series.at(-1)?.ether ?? base;
  if (lastEmitted && lastN < totalRounds) { const pp = []; for (let n = lastN; n <= totalRounds; n++) pp.push([X(n), Y(lastE + k * lastEmitted * (n - lastN))]); s += `<path d="M${pp.map(p => p.join(",")).join(" L")}" fill="none" stroke="#6CC24A" stroke-width="2" stroke-dasharray="2 5" opacity=".7"/><text x="${X(lastN) + 12}" y="${Y(lastE) - 14}" font-size="11" fill="#5A6272" font-family="IBM Plex Sans">at this pace →</text>`; }
  s += marker(X(lastN), Y(lastE), "#3F8A29") + `<text x="${X(lastN) + 12}" y="${Y(lastE) + 4}" font-size="12" fill="#3F8A29" font-family="IBM Plex Mono">${lastE.toFixed(2)}</text>`;
  s += `<text x="${x0}" y="198" ${mono}>R0</text><text x="${x0 + xw}" y="198" ${mono} text-anchor="end">R${totalRounds}</text>`;
  return s + `</svg>`;
}

// Figurative city map. Polygons keyed by borough_key.
const SHAPES = {
  northgate: "14,14 150,8 156,84 34,96", lumen: "150,8 256,12 254,84 156,84", exchange: "268,12 386,18 384,96 264,92",
  stacks: "34,96 156,84 160,164 44,176", midtown: "156,84 254,84 252,166 160,164", coalbrook: "264,92 384,96 380,172 262,170",
  marshend: "44,176 160,164 164,236 48,242", harborline: "160,164 252,166 254,238 164,236", fenwick: "292,268 344,258 362,286 320,300 288,290",
};
const SCALES = {
  haunt: ["#EDE9F5", "#6E5A9E", "Light", "Heavy hauntings", v => "$" + Math.round(v / 1000) + "k"],
  tax: ["#FBE7DD", "#E0713C", "$0", "$200 on ghosts", v => "$" + Math.round(v)],
  ghosts: ["#E6F5DF", "#3F8A29", "Few", "Many ghosts", v => Math.round(v) + " t"],
  contain: ["#F0F0F0", "#1B2233", "0%", "100% contained", v => Math.round(v * 100) + "%"],
};
function lerp(a, b, t) { const p = x => parseInt(x, 16), A = [1, 3, 5].map(i => p(a.slice(i, i + 2))), B = [1, 3, 5].map(i => p(b.slice(i, i + 2))); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * Math.min(1, Math.max(0, t))).toString(16).padStart(2, "0")).join(""); }
export function drawMap(data, metric) {
  const [c0, c1, l0, l1, fmt] = SCALES[metric];
  const vals = data.map(d => d[metric]); const max = metric === "contain" ? 1 : metric === "tax" ? 200 : Math.max(1, ...vals);
  let s = `<svg class="map" viewBox="0 0 400 310" width="100%"><path d="M0,232 C50,222 90,246 130,238 C180,228 200,246 240,240 C290,232 330,262 400,248 L400,310 L0,310z" fill="#DCE7F0"/><path d="M262,0 C255,60 268,110 258,160 C250,200 262,225 262,240" fill="none" stroke="#DCE7F0" stroke-width="10"/>`;
  for (const d of data) {
    const pts = SHAPES[d.key]; if (!pts) continue;
    const arr = pts.split(" ").map(p => p.split(",").map(Number)); const cx = arr.reduce((t, p) => t + p[0], 0) / arr.length, cy = arr.reduce((t, p) => t + p[1], 0) / arr.length;
    s += `<polygon class="b" points="${pts}" fill="${lerp(c0, c1, d[metric] / max)}"><title>${d.name}: ${fmt(d[metric])}</title></polygon><text x="${cx}" y="${cy - 3}" text-anchor="middle">${d.name}</text><text class="v" x="${cx}" y="${cy + 10}" text-anchor="middle">${fmt(d[metric])}</text>`;
  }
  return { svg: s + "</svg>", legend: `<span><i style="background:${c0}"></i>${l0}</span><span><i style="background:${c1}"></i>${l1}</span>` };
}

export function drawLeaderboard(rows) {
  const max = Math.max(1, ...rows.map(r => r.score));
  return rows.map((r, i) => `<div class="r"><span class="rank">${i + 1}</span><span>${r.name}</span><div class="bars"><div class="b1" style="width:${100 * r.score / max}%"></div><div class="b2" style="width:${100 * (r.share ?? 0)}%"></div></div><span class="d ${r.delta > 0 ? "up" : r.delta < 0 ? "dn" : ""}">${r.delta > 0 ? "▲ " + r.delta : r.delta < 0 ? "▼ " + (-r.delta) : "—"}</span></div>`).join("");
}
