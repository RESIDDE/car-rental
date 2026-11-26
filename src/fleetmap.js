// Live fleet map: a procedural city with every fleet car driving its route.
const cv = document.getElementById('fleetMap');
const ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const CITIES = ['Lagos', 'Abuja', 'Ibadan', 'Port Harcourt', 'Kano', 'Enugu', 'Benin City', 'Kaduna', 'Calabar', 'Owerri', 'Abeokuta', 'Jos'];
const COL = { out: '#c8f169', overdue: '#ff6b5e', due: '#ffc75a', free: '#8a8f98', booked: '#8a8f98' };
const DEMO = Array.from({ length: 6 }, (_, i) => ({ id: 'demo' + i, name: 'Demo car ' + (i + 1), plate: 'DEMO-0' + (i + 1), k: 'out', label: 'Demo', customer: 'Sample customer', driver: 'Self-drive', end: '', rev: '₦0' }));

let W = 0, H = 0, dpr = 1, nodes = [], adj = [], edges = [], base, cars = [], sel = 0, filt = 'all';
let showRoutes = true, showNames = true, last = performance.now(), uiT = 0;

const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const hash = str => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1;

function buildCity() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = cv.clientWidth; H = cv.clientHeight;
  if (!W || !H) return;
  cv.width = W * dpr; cv.height = H * dpr;
  const r = seeded(42), gap = Math.max(64, Math.min(W, H) / 6.5);
  const cols = Math.ceil(W / gap) + 2, rows = Math.ceil(H / gap) + 2;
  nodes = []; adj = []; edges = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++)
    nodes.push({ x: (i - .5) * gap + (r() - .5) * gap * .4, y: (j - .5) * gap + (r() - .5) * gap * .4 });
  nodes.forEach(() => adj.push([]));
  const link = (a, b, major) => { adj[a].push(b); adj[b].push(a); edges.push([a, b, major]); };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const id = j * cols + i;
    if (i < cols - 1 && (j % 3 === 1 || r() > .14)) link(id, id + 1, j % 3 === 1);
    if (j < rows - 1 && (i % 4 === 2 || r() > .14)) link(id, id + cols, i % 4 === 2);
    if (i < cols - 1 && j < rows - 1 && r() > .9) link(id, id + cols + 1, false);
  }
  // static layer: ground, blocks, parks, water, roads
  base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height;
  const b = base.getContext('2d'); b.scale(dpr, dpr);
  b.fillStyle = '#0d0e0f'; b.fillRect(0, 0, W, H);
  for (let k = 0; k < cols * rows * 1.6; k++) {
    const x = r() * W, y = r() * H, w = 10 + r() * 34, h = 10 + r() * 30;
    b.fillStyle = r() > .93 ? '#122016' : r() > .5 ? '#16171a' : '#131416';
    b.beginPath(); b.roundRect(x, y, w, h, 3); b.fill();
  }
  b.fillStyle = '#0f1a22'; b.beginPath();
  b.moveTo(W * .72, H); b.bezierCurveTo(W * .78, H * .7, W * .95, H * .75, W, H * .55); b.lineTo(W, H); b.fill();
  const road = (w, c, dash) => {
    b.strokeStyle = c; b.lineWidth = w; b.lineCap = 'round'; b.setLineDash(dash || []);
    for (const [a, z, m] of edges) { if (dash && !m) continue; b.lineWidth = m ? w * 1.6 : w; b.beginPath(); b.moveTo(nodes[a].x, nodes[a].y); b.lineTo(nodes[z].x, nodes[z].y); b.stroke(); }
  };
  road(9, '#1c1d20'); road(6.5, '#26282c'); road(1, '#3a3c41', [6, 8]);
  b.setLineDash([]);
  spawn();
}

function nextHop(prev, cur, rnd) {
  const n = adj[cur].filter(x => x !== prev);
  const opts = n.length ? n : adj[cur];
  return opts[Math.floor(rnd() * opts.length)];
}
function spawn() {
  const fleet = (window.__fleet && window.__fleet.length) ? window.__fleet : DEMO;
  const anyMoving = fleet.some(f => f.k === 'out' || f.k === 'overdue');
  const old = new Map(cars.map(c => [c.f.id, c]));
  cars = fleet.map((f, i) => {
    const r = seeded(hash(f.id));
    const prev = old.get(f.id);
    const moving = !anyMoving || f.k === 'out' || f.k === 'overdue';
    if (prev && prev.a < nodes.length && prev.b < nodes.length) return { ...prev, f, moving };
    let a = Math.floor(r() * nodes.length); while (!adj[a].length) a = (a + 1) % nodes.length;
    const b = nextHop(-1, a, r), q = [];
    const c = { f, a, b, t: r(), q, r, moving, spd: 0, target: 40 + r() * 30, fuel: 45 + r() * 50, from: CITIES[Math.floor(r() * CITIES.length)], to: CITIES[Math.floor(r() * CITIES.length)], prog: r() * .6 };
    if (c.to === c.from) c.to = CITIES[(CITIES.indexOf(c.from) + 3) % CITIES.length];
    fill(c); return c;
  });
  if (sel >= cars.length) sel = 0;
  chips();
}
function fill(c) {
  while (c.q.length < 8) { const p = c.q.length > 1 ? c.q[c.q.length - 2] : c.a, cur = c.q.length ? c.q[c.q.length - 1] : c.b; c.q.push(nextHop(p, cur, c.r)); }
}
const pos = c => { const A = nodes[c.a], B = nodes[c.b]; return { x: A.x + (B.x - A.x) * c.t, y: A.y + (B.y - A.y) * c.t, ang: Math.atan2(B.y - A.y, B.x - A.x) }; };
const visible = c => filt === 'all' || (filt === 'moving' ? c.moving : filt === 'parked' ? !c.moving : c.f.k === filt);

function step(dt) {
  for (const c of cars) {
    if (!c.moving) { c.spd *= .9; continue; }
    const A = nodes[c.a], B = nodes[c.b], len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    const slow = (1 - c.t) * len < 18 ? .55 : 1;
    c.spd += (c.target * slow - c.spd) * Math.min(1, dt * 2);
    c.t += c.spd * dt / len;
    c.prog = (c.prog + dt * .004) % 1;
    c.fuel = Math.max(8, c.fuel - dt * .05);
    if (c.t >= 1) { c.t -= 1; c.a = c.b; c.b = c.q.shift(); fill(c); if (c.r() > .7) c.target = 30 + c.r() * 45; }
  }
}

function draw(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(base, 0, 0, W, H);
  const pulse = (Math.sin(now / 300) + 1) / 2;
  if (showRoutes) cars.forEach((c, i) => {
    if (!c.moving || !visible(c)) return;
    const p = pos(c), on = i === sel;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nodes[c.b].x, nodes[c.b].y);
    for (const n of c.q.slice(0, on ? 8 : 3)) ctx.lineTo(nodes[n].x, nodes[n].y);
    ctx.strokeStyle = on ? '#c8f169' : 'rgba(255,255,255,.12)'; ctx.lineWidth = on ? 3 : 2; ctx.lineJoin = 'round';
    if (on) { ctx.shadowColor = '#c8f169'; ctx.shadowBlur = 12; }
    ctx.stroke(); ctx.shadowBlur = 0;
    if (on) { const e = nodes[c.q[7]]; ctx.fillStyle = '#c8f169'; ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, 7); ctx.fill(); }
  });
  cars.forEach((c, i) => {
    if (!visible(c)) return;
    const p = pos(c), on = i === sel, col = COL[c.f.k] || COL.free;
    if (on) { ctx.strokeStyle = `rgba(200,241,105,${.5 - pulse * .4})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 14 + pulse * 10, 0, 7); ctx.stroke(); }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
    const s = on ? 1.35 : 1;
    ctx.shadowColor = col; ctx.shadowBlur = on ? 14 : 6;
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-9 * s, -4.5 * s, 18 * s, 9 * s, 3 * s); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(1 * s, -3.2 * s, 4 * s, 6.4 * s);
    if (c.moving) { ctx.fillStyle = '#fffbe0'; ctx.fillRect(8 * s, -3.5 * s, 1.6, 2); ctx.fillRect(8 * s, 1.5 * s, 1.6, 2); }
    ctx.restore();
    if (showNames) {
      ctx.font = '600 11px "Plus Jakarta Sans",sans-serif';
      const t = c.f.plate, w = ctx.measureText(t).width + 12;
      ctx.fillStyle = on ? '#c8f169' : 'rgba(20,21,23,.85)'; ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - 30, w, 18, 9); ctx.fill();
      ctx.fillStyle = on ? '#111' : '#cfd2d8'; ctx.textAlign = 'center'; ctx.fillText(t, p.x, p.y - 17);
    }
  });
}

const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
function ui() {
  const c = cars[sel]; if (!c) return;
  const f = c.f, p = pos(c), kmh = Math.round(c.spd * 1.6);
  $('vPlate').textContent = f.plate; $('vName').textContent = f.name;
  const st = $('vState'); st.textContent = c.moving ? (f.k === 'overdue' ? 'Overdue' : 'On trip') : f.label; st.className = 'pill p-' + f.k;
  $('vFrom').textContent = c.from; $('vTo').textContent = c.to;
  $('vProg').style.width = (c.prog * 100).toFixed(1) + '%';
  $('vEta').textContent = c.moving ? Math.max(4, Math.round((1 - c.prog) * 180)) + ' min' : 'Parked';
  $('vWho').textContent = [f.driver, f.customer].filter(Boolean).join(' · ');
  $('vSpd').textContent = kmh;
  $('gSpd').style.strokeDasharray = `${Math.min(100, kmh / 1.2)} 100`;
  $('gNeedle').style.transform = `rotate(${-135 + Math.min(270, kmh * 2.25)}deg)`;
  $('gFuel').style.strokeDasharray = `${c.fuel} 100`; $('vFuel').textContent = Math.round(c.fuel) + '%';
  $('vRev').textContent = f.rev + ' earned';
  const al = $('vAlert');
  al.hidden = !(f.k === 'overdue' || f.k === 'due' || c.fuel < 20);
  al.querySelector('span').textContent = f.k === 'overdue' ? `Overdue — was due back ${f.end}` : f.k === 'due' ? `Pick-up due · ${f.customer}` : 'Low fuel — refuel soon';
  $('vIdx').textContent = `${sel + 1} / ${cars.length}`;
  const deg = (p.ang * 180 / Math.PI + 360) % 360;
  $('dial').style.transform = `rotate(${-deg - 90}deg)`;
  $('hdg').textContent = DIRS[Math.round(deg / 45) % 8];
}

function chips() {
  const n = k => cars.filter(c => k === 'all' || (k === 'moving' ? c.moving : !c.moving)).length;
  $('mapChips').innerHTML = [['all', 'All vehicles'], ['moving', 'On the road'], ['parked', 'Parked'], ['overdue', 'Overdue']]
    .map(([k, l]) => `<button class="chip" data-map="${k}" aria-pressed="${filt === k}">${l} <b>${k === 'overdue' ? cars.filter(c => c.f.k === 'overdue').length : n(k)}</b></button>`).join(' ');
}
function select(i) { sel = (i + cars.length) % cars.length; dispatchEvent(new CustomEvent('stagecar', { detail: { i: sel } })); ui(); }

$('mapChips').addEventListener('click', e => { const b = e.target.closest('[data-map]'); if (b) { filt = b.dataset.map; chips(); } });
$('tRoutes').onchange = e => showRoutes = e.target.checked;
$('tNames').onchange = e => showNames = e.target.checked;
$('vPrev').onclick = () => select(sel - 1);
$('vNext').onclick = () => select(sel + 1);
cv.addEventListener('click', e => {
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  let best = -1, bd = 28;
  cars.forEach((c, i) => { if (!visible(c)) return; const p = pos(c), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
  if (best >= 0) select(best);
});
addEventListener('fleet', () => { if (nodes.length) spawn(); });
new ResizeObserver(() => { if (cv.clientWidth !== W || cv.clientHeight !== H) buildCity(); }).observe(cv);

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (W && !document.getElementById('overview').hidden) {
    if (!still) step(dt);
    draw(now);
    if ((uiT += dt) > .2) { uiT = 0; ui(); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
