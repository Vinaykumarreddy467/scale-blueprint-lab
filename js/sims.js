/* Live simulations. Each takes a host element and appends a self-running panel. */
(function () {
  const BP = window.BP;
  const { h, s } = BP;
  const sims = (BP.sims = {});
  const COLORS = ['var(--l2)', 'var(--l4)', 'var(--l1)', 'var(--l3)', 'var(--l5)', '#13A3A3', '#D0569B', '#8A9A2E'];

  function hash(str) {
    let x = 2166136261;
    for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
    x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995); x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  }
  BP.hash = hash;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const circle = (parent, x, y, r, attrs) => { const c = s('circle', Object.assign({ cx: x, cy: y, r }, attrs || {})); parent.appendChild(c); return c; };
  const text = (parent, x, y, t, cls, attrs) => { const el = s('text', Object.assign({ x, y, class: cls || 'n-sub', text: t }, attrs || {})); parent.appendChild(el); return el; };
  const userDot = (parent, p, label, color) => {
    circle(parent, p[0], p[1], 17, { style: 'fill:' + color });
    text(parent, p[0], p[1] + 4, label, 'n-tag', { 'text-anchor': 'middle', style: 'fill:#fff' });
  };

  /* ---------- 1. A request end to end ---------- */
  sims.requestFlow = function (host) {
    const F = BP.simFrame(host, { title: 'One request, end to end', hint: 'Press “Send request”', viewBox: '0 0 760 240' });
    const W = F.layer(), P = F.layer(), N = F.layer();
    const pos = { b: [95, 160], d: [300, 55], s: [480, 160], db: [670, 160] };
    BP.line(W, pos.b, pos.d, 'dash'); BP.line(W, pos.b, pos.s); BP.line(W, pos.s, pos.db);
    BP.node(N, { x: pos.b[0], y: pos.b[1], w: 140, h: 58, label: 'Your phone', tag: 'CLIENT', sub: 'food app' });
    const nD = BP.node(N, { x: pos.d[0], y: pos.d[1], w: 150, h: 58, label: 'DNS resolver', tag: 'DNS', sub: 'name → IP' });
    const nS = BP.node(N, { x: pos.s[0], y: pos.s[1], w: 140, h: 58, label: 'Web server', tag: 'SERVER', sub: '13.235.x.x' });
    const nDb = BP.node(N, { x: pos.db[0], y: pos.db[1], w: 140, h: 58, label: 'Database', tag: 'DB', sub: 'menus, orders' });
    const pk = BP.packetLayer(P);
    let dnsCached = false, keepAlive = false, running = false, total = 0, count = 0;
    F.stat('total', 'Total time'); F.stat('dns', 'DNS'); F.stat('hs', 'Handshake'); F.stat('n', 'Requests');
    F.add(BP.button('Send request', run, 'primary'),
      BP.ctl('DNS answer', BP.seg([[false, 'Not cached'], [true, 'Cached']], false, (v) => (dnsCached = v))),
      BP.ctl('Connection', BP.seg([[false, 'New'], [true, 'Reused']], false, (v) => (keepAlive = v))));
    F.log('Press <b>Send request</b> to watch your phone fetch a restaurant menu. Every hop costs time.');
    async function hop(a, b, cls, ms, msg) {
      F.log(msg); total += ms; F.set('total', total + ' ms');
      await pk.send([a, b], { cls, dur: 0.35 + ms / 110 });
    }
    async function run() {
      if (running) return;
      running = true; total = 0; count++; F.set('n', count);
      let dns = 0, hs = 0;
      if (!dnsCached) {
        nD.setCls('hot');
        await hop(pos.b, pos.d, 'blue', 20, '<b>1 · DNS:</b> “Where does api.foodapp.com live?”');
        await hop(pos.d, pos.b, 'ok', 20, '<b>1 · DNS:</b> “At 13.235.x.x.” The phone keeps this answer for a while (TTL).');
        dns = 40; nD.setCls('');
      } else F.log('<b>1 · DNS:</b> the phone already knows the IP. Skipped.');
      F.set('dns', dns + ' ms');
      nS.setCls('hot');
      if (!keepAlive) {
        await hop(pos.b, pos.s, 'ink', 30, '<b>2 · TCP + TLS handshake:</b> phone and server agree to talk securely…');
        await hop(pos.s, pos.b, 'ink', 30, '<b>2 · Handshake done.</b> That cost a full round trip before any real data moved.');
        hs = 60;
      } else F.log('<b>2 · Handshake:</b> reusing an open connection. Skipped.');
      F.set('hs', hs + ' ms');
      await hop(pos.b, pos.s, 'blue', 25, '<b>3 · HTTP request:</b> GET /restaurants/123/menu');
      nDb.setCls('hot');
      await hop(pos.s, pos.db, 'blue', 5, '<b>4 · Query:</b> SELECT * FROM dishes WHERE restaurant_id = 123');
      await hop(pos.db, pos.s, 'ok', 10, '<b>4 · Rows back:</b> 42 dishes with prices and photo links');
      nDb.setCls('');
      await hop(pos.s, pos.b, 'ok', 25, '<b>5 · Response:</b> 200 OK with JSON. The app draws the menu.');
      nS.setCls('');
      F.log(`<b>Done in ${total} ms.</b> ${dns || hs ? 'Now cache the DNS answer and reuse the connection, then send again.' : 'Fastest path: no DNS lookup, no handshake.'}`);
      running = false;
    }
  };

  /* ---------- 2. Latency numbers ---------- */
  sims.latency = function (host) {
    const rows = [
      ['L1 CPU cache read', 0.5], ['L2 CPU cache read', 7], ['Main memory (RAM) read', 100],
      ['Compress 1 KB with a fast codec', 2000], ['Send 2 KB over a 1 Gbps network', 20000],
      ['Random 4 KB read from SSD', 150000], ['Read 1 MB from RAM', 250000], ['Round trip inside one datacenter', 500000],
      ['Read 1 MB from SSD', 1000000], ['Hard disk seek', 10000000], ['Read 1 MB from hard disk', 20000000],
      ['Round trip Mumbai → US East → Mumbai', 200000000],
    ];
    let human = false;
    const list = h('div', { style: { display: 'grid', gap: '6px', padding: '14px' } });
    const log = h('div', { class: 'sim-log' });
    const real = (ns) => ns < 1000 ? ns + ' ns' : ns < 1e6 ? ns / 1000 + ' µs' : ns < 1e9 ? ns / 1e6 + ' ms' : ns / 1e9 + ' s';
    const hum = (ns) => {
      let sec = ns * 2;
      const u = [[31536000, 'years'], [86400, 'days'], [3600, 'hours'], [60, 'min'], [1, 's']];
      for (const [d, n] of u) if (sec >= d) return (Math.round((sec / d) * 10) / 10).toLocaleString() + ' ' + n;
      return sec + ' s';
    };
    function draw() {
      list.innerHTML = '';
      rows.forEach(([name, ns]) => {
        const pct = ((Math.log10(ns) + 1) / 10) * 100;
        list.append(h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) 92px', gap: '12px', alignItems: 'center', fontSize: '14.5px' } },
          h('span', { style: { minWidth: 0 } }, name),
          h('span', { style: { height: '10px', background: 'var(--line)', borderRadius: '5px', overflow: 'hidden' } },
            h('i', { style: { display: 'block', height: '100%', width: pct + '%', borderRadius: '5px', background: ns >= 1e6 ? 'var(--bad)' : ns >= 1e4 ? 'var(--amber)' : 'var(--ok)', transition: 'width .4s' } })),
          h('b', { class: 'mono', style: { textAlign: 'right', fontSize: '13px' } }, human ? hum(ns) : real(ns))));
      });
      log.innerHTML = human
        ? 'If reading the CPU cache took <b>1 second</b>, a trip to RAM takes 3 minutes, an SSD read takes 3.5 days, and one Mumbai–US round trip takes <b>12.7 years</b>.'
        : 'Bars use a log scale. Green is memory, amber is SSD and local network, red is disk and the wide internet. Switch to human scale to feel the gap.';
    }
    const panel = h('div', { class: 'sim' },
      h('div', { class: 'sim-head' }, h('i', { class: 'live' }), 'Live · Latency numbers every engineer should know'),
      h('div', { class: 'sim-controls', style: { borderTop: '0', borderBottom: '1px solid var(--line)' } },
        BP.ctl('Show as', BP.seg([[false, 'Real time'], [true, 'Human scale (L1 = 1 s)']], false, (v) => { human = v; draw(); }))),
      list, log);
    host.appendChild(panel);
    draw();
  };

  /* ---------- 3. Scale up vs scale out ---------- */
  sims.scaling = function (host) {
    const F = BP.simFrame(host, { title: 'Scale up vs scale out', hint: 'Drag traffic, then crash a server', viewBox: '0 0 760 300' });
    const W = F.layer(), P = F.layer(), N = F.layer();
    const pk = BP.packetLayer(P);
    let mode = 'v', traffic = 1500, killed = false;
    const tiers = [{ n: '2 vCPU · 4 GB', cap: 1000, cost: 60 }, { n: '8 vCPU · 32 GB', cap: 4000, cost: 280 }, { n: '32 vCPU · 128 GB', cap: 12000, cost: 1300 }, { n: '96 vCPU · 384 GB', cap: 24000, cost: 4800 }];
    const users = [70, 150];
    let targets = [], over = 0, lbPos = null;
    F.stat('cap', 'Capacity'); F.stat('load', 'Load'); F.stat('cost', 'Cost / month'); F.stat('spof', 'One crash =');
    function draw() {
      W.innerHTML = ''; N.innerHTML = '';
      userDot(N, users, 'USERS', 'var(--accent)');
      let cap, cost;
      if (mode === 'v') {
        let ti = tiers.findIndex((t) => t.cap >= traffic); if (ti < 0) ti = tiers.length - 1;
        const t = tiers[ti];
        cap = killed ? 0 : t.cap; cost = t.cost;
        const w = 120 + ti * 40, hh = 60 + ti * 34;
        BP.line(W, users, [470, 150]);
        BP.node(N, { x: 470, y: 150, w, h: hh, label: 'One big server', tag: 'SERVER', sub: t.n, cls: killed ? 'dead' : traffic > t.cap ? 'warn' : '' });
        targets = killed ? [] : [[470 - w / 2, 150]];
        lbPos = null;
        F.set('spof', killed ? 'OUTAGE' : 'Total outage', 'bad');
      } else {
        const n = Math.max(1, Math.ceil(traffic / 1000));
        lbPos = [250, 150];
        BP.line(W, users, lbPos);
        BP.node(N, { x: 250, y: 150, w: 92, h: 50, label: 'LB', tag: 'BALANCER' });
        targets = [];
        for (let i = 0; i < n; i++) {
          const c = i % 6, r = Math.floor(i / 6);
          const x = 400 + c * 58, y = 60 + r * 58 + (n <= 6 ? 90 : n <= 12 ? 60 : n <= 18 ? 30 : 0);
          const dead = killed && i === n - 1;
          BP.line(W, lbPos, [x - 23, y], 'dash');
          BP.node(N, { x, y, w: 46, h: 40, label: '' + (i + 1), cls: dead ? 'dead' : '' });
          if (!dead) targets.push([x - 23, y]);
        }
        cap = (n - (killed ? 1 : 0)) * 1000; cost = n * 60 + 25;
        text(N, 570, 290, n + ' small servers × 2 vCPU', 'n-sub', { 'text-anchor': 'middle' });
        F.set('spof', killed ? `−${Math.round(100 / n)}% capacity` : `−${Math.round(100 / n)}% capacity`, n > 1 ? 'good' : 'bad');
      }
      const load = cap ? traffic / cap : Infinity;
      over = cap ? Math.max(0, 1 - cap / traffic) : 1;
      F.set('cap', BP.fmtNum(cap) + ' req/s');
      F.set('load', cap ? Math.round(load * 100) + '%' : '∞', load > 1 ? 'bad' : load > 0.8 ? 'warn' : 'good');
      F.set('cost', '$' + cost.toLocaleString());
      if (mode === 'v') {
        F.log(killed ? '<b>The only server crashed.</b> Every user sees an error until it restarts. This is a single point of failure.'
          : traffic > tiers[tiers.length - 1].cap ? '<b>There is no bigger machine to buy.</b> Vertical scaling has a ceiling.'
            : `Traffic fits on <b>${tiers.find((t) => t.cap >= traffic).n}</b>. Simple: no code changes. Push traffic higher and watch the price jump.`);
      } else {
        F.log(killed ? '<b>One server crashed</b> and the load balancer stopped sending it traffic. Users barely notice.'
          : 'Many cheap, identical servers behind a load balancer. Add one when traffic grows. Your app must be <b>stateless</b> for this to work.');
      }
    }
    let acc = 0;
    BP.raf((dt) => {
      acc += dt * Math.min(14, 2 + traffic / 1500);
      while (acc >= 1) {
        acc--;
        const bad = !targets.length || Math.random() < over;
        const tgt = targets.length ? BP.pick(targets) : [470 - 60, 150];
        const path = lbPos ? [users, lbPos, tgt] : [users, tgt];
        pk.send(path, { cls: bad ? 'bad' : 'blue', r: 4, dur: 0.9 });
      }
    });
    F.add(
      BP.ctl('Strategy', BP.seg([['v', 'Scale up (bigger box)'], ['h', 'Scale out (more boxes)']], 'v', (v) => { mode = v; killed = false; killBtn.textContent = 'Crash a server'; draw(); })),
      BP.slider('Traffic', { min: 200, max: 30000, step: 100, value: traffic, fmt: (v) => BP.fmtNum(v) + ' req/s' }, (v) => { traffic = v; draw(); }));
    const killBtn = BP.button('Crash a server', () => { killed = !killed; killBtn.textContent = killed ? 'Restart it' : 'Crash a server'; draw(); }, 'danger');
    F.add(killBtn);
    draw();
  };

  /* ---------- 4. Load balancer ---------- */
  sims.loadBalancer = function (host) {
    const F = BP.simFrame(host, { title: 'Load balancer', hint: 'Click a server to crash or revive it', viewBox: '0 0 760 340' });
    const W = F.layer(), P = F.layer(), N = F.layer();
    const pk = BP.packetLayer(P);
    const CAP = 6;
    const users = [0, 1, 2, 3, 4].map((i) => [60, 50 + i * 60]);
    const lb = [300, 170];
    let algo = 'rr', rate = 4, rr = 0, sent = 0, served = 0, dropped = 0;
    users.forEach((u, i) => { BP.line(W, u, lb, 'dash'); userDot(N, u, 'U' + (i + 1), COLORS[i]); });
    const lbNode = BP.node(N, { x: lb[0], y: lb[1], w: 140, h: 60, label: 'Load balancer', tag: 'LB', sub: 'round robin' });
    const servers = [0, 1, 2, 3].map((i) => {
      const sv = { pos: [590, 50 + i * 80], alive: true, active: 0, total: 0, epoch: 0 };
      sv.port = [sv.pos[0] - 85, sv.pos[1]];
      BP.line(W, [lb[0] + 70, lb[1]], sv.port);
      const g = s('g', { class: 'clickable', transform: `translate(${sv.pos[0] - 85},${sv.pos[1] - 30})`, tabindex: 0, role: 'button', 'aria-label': 'Crash or revive server ' + (i + 1) });
      sv.rect = s('rect', { width: 170, height: 60, rx: 9, class: 'n-box' });
      sv.tag = s('text', { x: 10, y: 15, class: 'n-tag', text: 'SERVER ' + (i + 1) });
      sv.txt = s('text', { x: 10, y: 34, class: 'n-label', text: '' });
      sv.barBg = s('rect', { x: 10, y: 42, width: 150, height: 8, rx: 4, class: 'fill-line' });
      sv.bar = s('rect', { x: 10, y: 42, width: 0, height: 8, rx: 4, class: 'fill-ok' });
      g.append(sv.rect, sv.tag, sv.txt, sv.barBg, sv.bar);
      g.addEventListener('click', () => toggle(i));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i); } });
      N.append(g);
      return sv;
    });
    function paint() {
      servers.forEach((sv, i) => {
        sv.rect.setAttribute('class', 'n-box ' + (!sv.alive ? 'dead' : sv.active >= CAP ? 'warn' : ''));
        sv.txt.textContent = sv.alive ? `${sv.active}/${CAP} busy · ${sv.total} done` : 'DOWN · LB skips it';
        sv.bar.setAttribute('width', sv.alive ? (150 * sv.active) / CAP : 0);
        sv.bar.setAttribute('class', sv.active >= CAP ? 'fill-bad' : sv.active >= CAP - 2 ? 'fill-amber' : 'fill-ok');
      });
      F.set('sent', sent); F.set('served', served, 'good'); F.set('dropped', dropped, dropped ? 'bad' : '');
      const alive = servers.filter((x) => x.alive);
      const tot = alive.map((x) => x.total);
      F.set('spread', alive.length ? `${Math.min(...tot)} – ${Math.max(...tot)}` : '—');
    }
    function toggle(i) {
      const sv = servers[i];
      sv.alive = !sv.alive; sv.epoch++;
      if (!sv.alive) { dropped += sv.active; sv.active = 0; F.log(`<b>Server ${i + 1} crashed.</b> Its in-flight requests failed. The LB's health check marks it down and stops sending it traffic.`); }
      else F.log(`<b>Server ${i + 1} is back.</b> Health checks pass, so it rejoins the pool.${algo === 'ip' ? ' With IP hash, some users just got moved to a new server, and lost their sticky session.' : ''}`);
      paint();
    }
    function choose(u) {
      const alive = servers.map((x, i) => (x.alive ? i : -1)).filter((i) => i >= 0);
      if (!alive.length) return -1;
      if (algo === 'rr') { for (let k = 0; k < 4; k++) { rr = (rr + 1) % 4; if (servers[rr].alive) return rr; } }
      if (algo === 'least') { let best = alive[0]; alive.forEach((i) => { if (servers[i].active < servers[best].active || (servers[i].active === servers[best].active && Math.random() < 0.5)) best = i; }); return best; }
      if (algo === 'random') return BP.pick(alive);
      return alive[(u * 7 + 3) % alive.length];
    }
    async function request() {
      const u = Math.floor(Math.random() * users.length);
      const heavy = Math.random() < 0.25;
      const dur = heavy ? BP.rand(5, 8) : BP.rand(0.8, 2);
      sent++;
      await pk.send([users[u], lb], { color: COLORS[u], r: heavy ? 6.5 : 4.5, dur: 0.6 });
      const idx = choose(u);
      if (idx < 0) { dropped++; F.log('<b>No healthy servers.</b> The LB returns 503 Service Unavailable.'); paint(); return; }
      const sv = servers[idx], ep = sv.epoch;
      await pk.send([[lb[0] + 70, lb[1]], sv.port], { color: COLORS[u], r: heavy ? 6.5 : 4.5, dur: 0.5 });
      if (!sv.alive || sv.epoch !== ep) { dropped++; paint(); return; }
      if (sv.active >= CAP) { dropped++; F.log(`<b>Server ${idx + 1} is full</b> (${CAP} at once) and rejected a request. ${algo === 'least' ? '' : 'Try “Least connections”: it avoids busy servers.'}`); paint(); return; }
      sv.active++; paint();
      BP.after(dur * 1000, () => { if (sv.epoch === ep && sv.active > 0) { sv.active--; sv.total++; served++; paint(); } });
    }
    let acc = 0;
    BP.raf((dt) => { acc += dt * rate; while (acc >= 1) { acc--; request(); } });
    F.stat('sent', 'Sent'); F.stat('served', 'Served'); F.stat('dropped', 'Failed'); F.stat('spread', 'Done per server');
    const names = { rr: 'round robin', least: 'least connections', random: 'random', ip: 'IP hash (sticky)' };
    const tips = {
      rr: '<b>Round robin:</b> server 1, 2, 3, 4, repeat. Fair count, but it ignores that big dots (heavy requests) take longer.',
      least: '<b>Least connections:</b> send to whoever is least busy right now. Handles mixed request sizes well.',
      random: '<b>Random:</b> simple, no state. Evens out over time but can pile up by bad luck.',
      ip: '<b>IP hash:</b> each user always lands on the same server (watch the colors). Good for sessions, but uneven if one user is heavy.',
    };
    F.add(BP.ctl('Algorithm', BP.seg([['rr', 'Round robin'], ['least', 'Least conn.'], ['random', 'Random'], ['ip', 'IP hash']], 'rr', (v) => { algo = v; lbNode.setSub(names[v]); F.log(tips[v]); })),
      BP.slider('Traffic', { min: 0, max: 12, value: rate, fmt: (v) => v + ' req/s' }, (v) => (rate = v)));
    F.log(tips.rr + ' Big dots are heavy requests. Click a server to crash it.');
    paint();
  };

  /* ---------- 5. Cache (LRU / FIFO) ---------- */
  sims.cache = function (host) {
    const F = BP.simFrame(host, { title: 'Cache in front of a database', hint: 'Order dishes, watch hits and misses', viewBox: '0 0 760 280' });
    const W = F.layer(), P = F.layer(), N = F.layer(), S = F.layer();
    const pk = BP.packetLayer(P);
    const keys = ['biryani', 'dosa', 'paneer', 'pizza', 'idli', 'momos', 'thali', 'vada'];
    const weights = keys.map((_, i) => 1 / Math.pow(i + 1, 1.1));
    const wsum = weights.reduce((a, b) => a + b, 0);
    let cap = 3, policy = 'lru', auto = false, order = [], hits = 0, misses = 0, latSum = 0;
    const app = [80, 150], db = [690, 150];
    W.append(s('rect', { x: 196, y: 70, width: 420, height: 160, rx: 12, class: 'n-box', 'stroke-dasharray': '6 5', style: 'fill:transparent' }));
    text(W, 210, 90, 'CACHE · in memory · ~1 ms', 'n-tag');
    BP.line(W, [135, 150], [196, 150]); BP.line(W, [616, 150], [635, 150]);
    BP.node(N, { x: app[0], y: app[1], w: 110, h: 56, label: 'App server', tag: 'SERVICE' });
    const dbN = BP.node(N, { x: db[0], y: db[1], w: 110, h: 56, label: 'Database', tag: 'DB', sub: '~80 ms' });
    const slotPos = (i) => [232 + i * 66, 150];
    function drawSlots(flash, evicted) {
      S.innerHTML = '';
      for (let i = 0; i < cap; i++) {
        const [x, y] = slotPos(i);
        const k = order[i];
        S.append(s('rect', { x: x - 29, y: y - 29, width: 58, height: 58, rx: 8, class: 'n-box ' + (k && k === flash ? 'okay' : '') }));
        text(S, x, y + 4, k || 'empty', k ? 'n-sub' : 'n-tag', { 'text-anchor': 'middle', style: k ? 'fill:var(--ink);font-weight:600' : '' });
      }
      text(S, 232, 212, policy === 'lru' ? '← most recently used' : '← newest', 'n-tag');
      text(S, 232 + (cap - 1) * 66, 212, policy === 'lru' ? 'evicted next →' : 'oldest, evicted next →', 'n-tag', { 'text-anchor': 'end' });
      if (evicted) text(S, 406, 250, `evicted: ${evicted}`, 'n-sub', { 'text-anchor': 'middle', style: 'fill:var(--bad)' });
    }
    function paint() {
      const total = hits + misses;
      F.set('hits', hits, 'good'); F.set('misses', misses, misses ? 'bad' : '');
      F.set('ratio', total ? Math.round((hits / total) * 100) + '%' : '—', total && hits / total > 0.7 ? 'good' : '');
      F.set('lat', total ? Math.round(latSum / total) + ' ms' : '—');
    }
    function request(key) {
      const i = order.indexOf(key);
      if (i >= 0) {
        hits++; latSum += 1;
        if (policy === 'lru') { order.splice(i, 1); order.unshift(key); }
        const at = slotPos(order.indexOf(key));
        drawSlots(key);
        pk.send([app, at, app], { cls: 'ok', dur: 0.6 });
        F.log(`<b>HIT</b> “${key}” was in the cache. Answered in about 1 ms.${policy === 'lru' ? ' Moved to the front as most recently used.' : ''}`);
      } else {
        misses++; latSum += 81;
        order.unshift(key);
        const ev = order.length > cap ? order.pop() : null;
        dbN.setCls('hot'); BP.after(900, () => dbN.setCls(''));
        drawSlots(key, ev);
        pk.send([app, [406, 150], db, slotPos(0), app], { cls: 'bad', dur: 1.4 });
        F.log(`<b>MISS</b> “${key}” not in cache. Read from the database (~80 ms), then stored in the cache.${ev ? ` Cache full, so “${ev}” was evicted.` : ''}`);
      }
      paint();
    }
    function randomKey() { let r = Math.random() * wsum; for (let i = 0; i < keys.length; i++) { r -= weights[i]; if (r <= 0) return keys[i]; } return keys[0]; }
    BP.every(750, () => { if (auto) request(randomKey()); });
    F.stat('hits', 'Hits'); F.stat('misses', 'Misses'); F.stat('ratio', 'Hit ratio'); F.stat('lat', 'Avg latency');
    const chips = h('div', { class: 'chips' }, keys.map((k) => BP.button(k, () => request(k))));
    F.add(BP.ctl('Order a dish', chips));
    F.add(BP.ctl('Auto traffic', BP.seg([[false, 'Off'], [true, 'On (popular dishes more often)']], false, (v) => (auto = v))),
      BP.slider('Cache size', { min: 1, max: 6, value: cap, fmt: (v) => v + ' slots' }, (v) => { cap = v; order = order.slice(0, cap); drawSlots(); }),
      BP.ctl('Eviction', BP.seg([['lru', 'LRU'], ['fifo', 'FIFO']], 'lru', (v) => { policy = v; drawSlots(); })),
      BP.button('Reset', () => { order = []; hits = misses = latSum = 0; drawSlots(); paint(); F.log('Cache emptied. A cold cache misses a lot at first.'); }));
    F.log('Tap dishes or switch on auto traffic. Popular dishes get ordered more, so a small cache still catches most requests.');
    drawSlots(); paint();
  };

  /* ---------- 6. CDN ---------- */
  sims.cdn = function (host) {
    const F = BP.simFrame(host, { title: 'CDN: content close to users', hint: 'Load the trailer from each city', viewBox: '0 0 760 350' });
    const W = F.layer(), P = F.layer(), N = F.layer();
    const pk = BP.packetLayer(P);
    [70, 140, 210, 280].forEach((y) => W.append(s('line', { x1: 20, x2: 740, y1: y, y2: y, class: 'wire dash', style: 'opacity:.5' })));
    const origin = [190, 120];
    const cities = [
      { n: 'London', p: [390, 95], ms: 80 }, { n: 'São Paulo', p: [265, 285], ms: 125 }, { n: 'Mumbai', p: [540, 200], ms: 210 },
      { n: 'Tokyo', p: [680, 125], ms: 160 }, { n: 'Sydney', p: [690, 290], ms: 230 },
    ];
    let on = false, total = 0, sum = 0, originHits = 0, edgeHits = 0;
    cities.forEach((c) => { c.edge = [c.p[0] - 50, c.p[1] - 38]; c.cached = false; });
    function draw() {
      W.querySelectorAll('.dyn').forEach((e) => e.remove()); N.innerHTML = '';
      BP.node(N, { x: origin[0], y: origin[1], w: 130, h: 54, label: 'Origin', tag: 'SERVER', sub: 'US East' });
      cities.forEach((c) => {
        if (on) {
          W.append(s('line', { x1: c.p[0], y1: c.p[1], x2: c.edge[0], y2: c.edge[1], class: 'wire dyn' }));
          W.append(s('line', { x1: c.edge[0], y1: c.edge[1], x2: origin[0], y2: origin[1], class: 'wire dash dyn', style: 'opacity:.45' }));
          N.append(s('rect', { x: c.edge[0] - 26, y: c.edge[1] - 13, width: 52, height: 26, rx: 6, class: 'n-box ' + (c.cached ? 'okay' : '') }));
          text(N, c.edge[0], c.edge[1] + 4, 'EDGE', 'n-tag', { 'text-anchor': 'middle' });
        } else W.append(s('line', { x1: c.p[0], y1: c.p[1], x2: origin[0], y2: origin[1], class: 'wire dash dyn' }));
        circle(N, c.p[0], c.p[1], 9, { class: 'fill-accent' });
        text(N, c.p[0] + 14, c.p[1] + 18, c.n, 'n-label');
      });
    }
    function paint() {
      F.set('avg', total ? Math.round(sum / total) + ' ms' : '—');
      F.set('origin', originHits);
      F.set('edge', edgeHits + originHits ? Math.round((edgeHits / (edgeHits + originHits)) * 100) + '%' : '—', 'good');
    }
    async function load(c) {
      let ms;
      if (!on) {
        ms = c.ms * 2 + 20; originHits++;
        await pk.send([c.p, origin, c.p], { cls: 'amber', dur: 0.4 + ms / 220 });
        F.log(`<b>${c.n}:</b> no CDN, so the request crossed the ocean to US East and back. <b>${ms} ms</b>.`);
      } else if (c.cached) {
        ms = 18; edgeHits++;
        await pk.send([c.p, c.edge, c.p], { cls: 'ok', dur: 0.5 });
        F.log(`<b>${c.n}:</b> edge server in the same city already had it. <b>${ms} ms</b>. Origin never knew.`);
      } else {
        ms = 18 + c.ms * 2; originHits++;
        await pk.send([c.p, c.edge, origin, c.edge, c.p], { cls: 'amber', dur: 0.5 + ms / 220 });
        c.cached = true; draw();
        F.log(`<b>${c.n}:</b> first request, edge was empty (cache miss), so it fetched from origin. <b>${ms} ms</b>. The next viewer here gets it fast.`);
      }
      total++; sum += ms; F.set('last', ms + ' ms', ms < 60 ? 'good' : ms > 300 ? 'bad' : 'warn'); paint();
    }
    F.stat('last', 'Last load'); F.stat('avg', 'Average'); F.stat('origin', 'Origin requests'); F.stat('edge', 'Edge hit rate');
    F.add(BP.ctl('CDN', BP.seg([[false, 'Off'], [true, 'On']], false, (v) => { on = v; draw(); F.log(v ? 'CDN on. Each city now has a nearby edge server. Edges start empty.' : 'CDN off. Every viewer goes to the origin in the US.'); })),
      BP.ctl('Load trailer from', h('div', { class: 'chips' }, cities.map((c) => BP.button(c.n, () => load(c))))),
      BP.button('Everyone at once', () => cities.forEach((c) => load(c)), 'primary'),
      BP.button('Purge edges', () => { cities.forEach((c) => (c.cached = false)); draw(); F.log('Edges purged. Do this when the file changes, or use versioned file names.'); }));
    F.log('Press <b>Everyone at once</b> with the CDN off, then turn it on and press it twice.');
    draw(); paint();
  };

  /* ---------- 7. Message queue ---------- */
  sims.queue = function (host) {
    const F = BP.simFrame(host, { title: 'Message queue absorbs spikes', hint: 'Hit “Dinner rush!”', viewBox: '0 0 760 280' });
    const W = F.layer(), P = F.layer(), N = F.layer(), Q = F.layer(), C = F.layer();
    const pk = BP.packetLayer(P);
    const prod = [80, 140];
    let rate = 2, nCons = 2, mode = 'queue', q = [], processed = 0, dropped = 0, waitSum = 0, now = 0;
    const PROC = 1.0, MAXQ = 60, SLOTS = 14;
    BP.node(N, { x: prod[0], y: prod[1], w: 120, h: 56, label: 'Order API', tag: 'PRODUCER' });
    const qx = 200, qw = 340;
    BP.line(W, [140, 140], [qx, 140]);
    W.append(s('rect', { x: qx, y: 112, width: qw, height: 56, rx: 8, class: 'n-box' }));
    const qLabel = text(W, qx + 6, 104, 'QUEUE · e.g. Kafka / SQS', 'n-tag');
    const slots = [];
    for (let i = 0; i < SLOTS; i++) { const r = s('rect', { x: qx + qw - 28 - i * 23.5, y: 124, width: 19, height: 32, rx: 4, class: 'fill-line' }); Q.append(r); slots.push(r); }
    const more = text(Q, qx + 6, 186, '', 'n-sub');
    let cons = [];
    function drawCons() {
      C.innerHTML = '';
      W.querySelectorAll('.cl').forEach((e) => e.remove());
      cons = Array.from({ length: nCons }, (_, i) => {
        const y = 140 + (i - (nCons - 1) / 2) * 50;
        const old = cons[i] || { busy: 0 };
        W.append(s('line', { x1: qx + qw, y1: 140, x2: 600, y2: y, class: 'wire cl' }));
        const nd = BP.node(C, { x: 660, y, w: 120, h: 40, label: 'Worker ' + (i + 1) });
        return { y, busy: old.busy, nd, pos: [600, y] };
      });
    }
    function paint() {
      slots.forEach((r, i) => r.setAttribute('class', i < q.length ? (q.length > 40 ? 'fill-bad' : q.length > 20 ? 'fill-amber' : 'fill-accent') : 'fill-line'));
      more.textContent = mode === 'direct' ? 'No queue: requests go straight to workers' : q.length > SLOTS ? `+${q.length - SLOTS} more waiting` : '';
      qLabel.textContent = mode === 'direct' ? 'NO QUEUE · direct calls' : 'QUEUE · e.g. Kafka / SQS';
      cons.forEach((c) => c.nd.setCls(c.busy > 0 ? 'hot' : ''));
      F.set('depth', mode === 'queue' ? q.length : '—', q.length > 20 ? 'bad' : '');
      F.set('done', processed, 'good'); F.set('lost', dropped, dropped ? 'bad' : '');
      F.set('wait', processed ? (waitSum / processed).toFixed(1) + ' s' : '—');
    }
    function produce() {
      if (mode === 'direct') {
        const c = cons.find((x) => x.busy <= 0);
        if (!c) { dropped++; pk.send([prod, [qx + 40, 140], prod], { cls: 'bad', dur: 0.5 }); F.log('<b>All workers busy.</b> Without a queue, the order fails and the user sees an error.'); paint(); return; }
        c.busy = PROC; pk.send([prod, [qx + qw, 140], c.pos], { cls: 'blue', dur: 0.6 }); waitSum += 0; processed++;
      } else {
        if (q.length >= MAXQ) { dropped++; F.log('<b>Queue full.</b> Even queues have limits. Add workers or apply back-pressure.'); paint(); return; }
        q.push(now); pk.send([prod, [qx + 10, 140]], { cls: 'blue', dur: 0.4 });
      }
      paint();
    }
    let acc = 0;
    BP.raf((dt) => {
      now += dt; acc += dt * rate;
      while (acc >= 1) { acc--; produce(); }
      cons.forEach((c) => {
        if (c.busy > 0) { c.busy -= dt; if (c.busy <= 0) paint(); }
        if (c.busy <= 0 && mode === 'queue' && q.length) {
          const t0 = q.shift(); c.busy = PROC; processed++; waitSum += now - t0;
          pk.send([[qx + qw - 18, 140], c.pos], { cls: 'ok', dur: 0.35 });
          paint();
        }
      });
    });
    F.stat('depth', 'Waiting'); F.stat('done', 'Processed'); F.stat('lost', 'Lost orders'); F.stat('wait', 'Avg wait');
    F.add(BP.ctl('Mode', BP.seg([['queue', 'With queue'], ['direct', 'No queue']], 'queue', (v) => { mode = v; q = []; paint(); })),
      BP.slider('Orders in', { min: 0, max: 10, value: rate, fmt: (v) => v + '/s' }, (v) => (rate = v)),
      BP.slider('Workers', { min: 1, max: 5, value: nCons, fmt: (v) => v + ' × 1/s' }, (v) => { nCons = v; drawCons(); paint(); }),
      BP.button('Dinner rush! +25', () => { for (let i = 0; i < 25; i++) produce(); F.log(mode === 'queue' ? '<b>Spike absorbed.</b> 25 orders wait in line. Workers drain them at their own pace. Nobody is lost.' : '<b>Spike without a queue:</b> most of those orders failed instantly.'); }, 'primary'));
    F.log('Each worker handles 1 order per second. Send a dinner rush, then switch to <b>No queue</b> and try again.');
    drawCons(); paint();
  };

  /* ---------- 8. Replication ---------- */
  sims.replication = function (host) {
    const F = BP.simFrame(host, { title: 'Leader–follower replication', hint: 'Write, read, then kill the leader', viewBox: '0 0 760 310' });
    const W = F.layer(), P = F.layer(), N = F.layer();
    const pk = BP.packetLayer(P);
    const pos = [[380, 62], [220, 235], [540, 235]];
    const writer = [80, 150], reader = [680, 150];
    const nodes = pos.map((p, i) => ({ p, name: 'db-' + (i + 1), val: 0, alive: true }));
    let leader = 0, lag = 1.5, mode = 'async', seq = 0, acked = 0, stale = 0, lost = 0, electing = false;
    BP.line(W, pos[0], pos[1], 'dash'); BP.line(W, pos[0], pos[2], 'dash'); BP.line(W, pos[1], pos[2], 'dash');
    pos.forEach((p) => { W.append(s('line', { x1: writer[0], y1: writer[1], x2: p[0], y2: p[1], class: 'wire', style: 'opacity:.25' })); W.append(s('line', { x1: reader[0], y1: reader[1], x2: p[0], y2: p[1], class: 'wire', style: 'opacity:.25' })); });
    userDot(W, writer, 'WRITE', 'var(--accent)'); userDot(W, reader, 'READ', 'var(--l3)');
    function draw() {
      N.innerHTML = '';
      nodes.forEach((n, i) => BP.node(N, { x: n.p[0], y: n.p[1], w: 150, h: 64, tag: !n.alive ? 'DOWN' : i === leader ? 'LEADER · writes' : 'FOLLOWER · reads', label: n.alive ? `balance = ₹${n.val}` : 'unreachable', sub: n.name, cls: !n.alive ? 'dead' : i === leader ? 'hot' : '' }));
      F.set('leader', nodes[leader].alive ? nodes[leader].name : 'none!', nodes[leader].alive ? '' : 'bad');
      F.set('acked', '₹' + acked); F.set('stale', stale, stale ? 'warn' : ''); F.set('lost', lost, lost ? 'bad' : '');
    }
    const followers = () => nodes.map((n, i) => i).filter((i) => i !== leader && nodes[i].alive);
    async function replicate(L, f, v) { await BP.wait(lag * 1000); await pk.send([nodes[L].p, nodes[f].p], { cls: 'blue', dur: 0.5 }); if (nodes[f].alive && nodes[f].val < v) nodes[f].val = v; draw(); }
    async function write() {
      if (!nodes[leader].alive || electing) { F.log('<b>Write failed:</b> no leader right now. Writes wait until a new leader is elected.'); return; }
      const L = leader, v = (seq += 100);
      await pk.send([writer, nodes[L].p], { cls: 'blue', dur: 0.5 });
      if (!nodes[L].alive) { F.log('<b>Write lost in flight:</b> the leader died.'); return; }
      nodes[L].val = v; draw();
      const fs = followers();
      if (mode === 'sync') {
        F.log(`<b>Sync:</b> leader waits for every follower to confirm before saying OK. Safer, but the user waits ${lag}s+.`);
        await Promise.all(fs.map((f) => replicate(L, f, v)));
        await pk.send([nodes[L].p, writer], { cls: 'ok', dur: 0.5 });
        acked = v; draw(); F.log(`<b>OK after all copies saved.</b> Balance ₹${v} is on every live node.`);
      } else {
        await pk.send([nodes[L].p, writer], { cls: 'ok', dur: 0.5 });
        acked = v; draw();
        F.log(`<b>Async:</b> leader said OK right away. Followers will catch up in ~${lag}s. Read now to see a stale value.`);
        fs.forEach((f) => replicate(L, f, v));
      }
    }
    async function read() {
      const fs = followers();
      if (!fs.length) { F.log('<b>No follower available.</b> Reading from the leader instead.'); }
      const i = fs.length ? BP.pick(fs) : leader;
      if (!nodes[i].alive) return;
      await pk.send([reader, nodes[i].p, reader], { cls: 'ok', dur: 0.9 });
      const v = nodes[i].val;
      if (v < acked) { stale++; F.log(`<b>Stale read!</b> ${nodes[i].name} says ₹${v} but the latest saved balance is ₹${acked}. This is replication lag.`); }
      else F.log(`<b>Fresh read</b> from ${nodes[i].name}: ₹${v}.`);
      draw();
    }
    async function kill() {
      if (!nodes[leader].alive || electing) return;
      nodes[leader].alive = false; electing = true; draw();
      F.log(`<b>${nodes[leader].name} (leader) crashed.</b> Followers notice missing heartbeats and hold an election…`);
      await BP.wait(1600);
      const fs = nodes.map((n, i) => i).filter((i) => nodes[i].alive);
      if (!fs.length) { electing = false; draw(); return; }
      fs.sort((a, b) => nodes[b].val - nodes[a].val);
      leader = fs[0]; electing = false;
      const newV = nodes[leader].val;
      if (newV < acked) { lost++; F.log(`<b>${nodes[leader].name} is the new leader, but it only had ₹${newV}.</b> The write of ₹${acked} was confirmed to the user and is now lost. That is the risk of async replication.`); acked = newV; }
      else F.log(`<b>${nodes[leader].name} is the new leader.</b> It had every confirmed write, so nothing was lost.`);
      draw();
    }
    function revive() {
      nodes.forEach((n) => { if (!n.alive) { n.alive = true; n.val = Math.min(n.val, nodes[leader].val); } });
      draw();
      followers().forEach((f) => replicate(leader, f, nodes[leader].val));
      F.log('Crashed nodes rejoin as followers and copy what they missed from the leader.');
    }
    F.stat('leader', 'Leader'); F.stat('acked', 'Last confirmed'); F.stat('stale', 'Stale reads'); F.stat('lost', 'Lost writes');
    F.add(BP.button('Deposit ₹100', write, 'primary'), BP.button('Read balance', read), BP.button('Kill leader', kill, 'danger'), BP.button('Revive nodes', revive),
      BP.ctl('Replication', BP.seg([['async', 'Async'], ['sync', 'Sync']], 'async', (v) => (mode = v))),
      BP.slider('Lag', { min: 0, max: 3, step: 0.5, value: lag, fmt: (v) => v + ' s' }, (v) => (lag = v)));
    F.log('Try this: <b>Deposit</b>, then <b>Read</b> right away (stale). Then Deposit and <b>Kill leader</b> quickly (lost write). Switch to Sync and repeat.');
    draw();
  };

  /* ---------- 9. Sharding hot spots ---------- */
  sims.sharding = function (host) {
    const F = BP.simFrame(host, { title: 'Sharding: pick the key carefully', hint: 'Compare the two shard keys', viewBox: '0 0 760 320' });
    const W = F.layer(), P = F.layer(), N = F.layer();
    const pk = BP.packetLayer(P);
    const cities = [['Bengaluru', 0.34], ['Mumbai', 0.24], ['Delhi', 0.2], ['Hyderabad', 0.1], ['Pune', 0.07], ['Chennai', 0.05]];
    const cityShard = [0, 1, 2, 3, 3, 3];
    let mode = 'city', rate = 12;
    const CAP = 4.5;
    const router = [190, 160], src = [50, 160];
    BP.line(W, src, router);
    userDot(N, src, 'ORDERS', 'var(--accent)');
    const rN = BP.node(N, { x: router[0], y: router[1], w: 120, h: 56, label: 'Shard router', tag: 'ROUTER', sub: 'by city' });
    const shards = [0, 1, 2, 3].map((i) => {
      const y = 48 + i * 75;
      BP.line(W, [250, 160], [400, y]);
      const g = s('g', { transform: `translate(400,${y - 30})` });
      const box = s('rect', { width: 340, height: 60, rx: 9, class: 'n-box' });
      const tag = s('text', { x: 10, y: 15, class: 'n-tag', text: 'SHARD ' + (i + 1) });
      const lab = s('text', { x: 10, y: 33, class: 'n-label', text: '' });
      const bg = s('rect', { x: 10, y: 41, width: 320, height: 9, rx: 4, class: 'fill-line' });
      const bar = s('rect', { x: 10, y: 41, width: 0, height: 9, rx: 4, class: 'fill-ok' });
      const capLine = s('line', { x1: 10 + 320 * (CAP / 8), x2: 10 + 320 * (CAP / 8), y1: 37, y2: 54, class: 'wire', style: 'stroke:var(--ink);stroke-width:2' });
      g.append(box, tag, lab, bg, bar, capLine); N.append(g);
      return { y, box, lab, bar, load: 0 };
    });
    text(N, 400 + 10 + 320 * (CAP / 8), 312, 'capacity', 'n-tag', { 'text-anchor': 'middle' });
    function labels() {
      rN.setSub(mode === 'city' ? 'by city' : 'by hash(order_id)');
      shards.forEach((sh, i) => (sh.label = mode === 'city' ? ['Bengaluru', 'Mumbai', 'Delhi', 'Hyd + Pune + Chennai'][i] : `hash range ${i * 25}–${i * 25 + 24}%`));
    }
    function pickCity() { let r = Math.random(); for (let i = 0; i < cities.length; i++) { r -= cities[i][1]; if (r <= 0) return i; } return 0; }
    let acc = 0, t = 0;
    BP.raf((dt) => {
      acc += dt * rate; t += dt;
      while (acc >= 1) {
        acc--;
        const c = pickCity();
        const si = mode === 'city' ? cityShard[c] : Math.floor(Math.random() * 4);
        shards[si].load += 1;
        pk.send([src, router, [400, shards[si].y]], { color: COLORS[c], r: 4, dur: 0.8 });
      }
      shards.forEach((sh) => (sh.load *= Math.exp(-dt)));
      if (t > 0.2) {
        t = 0;
        const loads = shards.map((sh) => sh.load);
        shards.forEach((sh) => {
          const pct = sh.load / CAP;
          sh.bar.setAttribute('width', Math.min(320, 320 * (sh.load / 8)));
          sh.bar.setAttribute('class', pct > 1 ? 'fill-bad' : pct > 0.8 ? 'fill-amber' : 'fill-ok');
          sh.box.setAttribute('class', 'n-box ' + (pct > 1 ? 'dead' : ''));
          sh.lab.textContent = `${sh.label} · ${sh.load.toFixed(1)}/s`;
        });
        const mx = Math.max(...loads), mn = Math.min(...loads);
        F.set('hot', Math.round((mx / CAP) * 100) + '%', mx > CAP ? 'bad' : 'good');
        F.set('cold', Math.round((mn / CAP) * 100) + '%');
        F.set('ratio', mn > 0.05 ? (mx / mn).toFixed(1) + '×' : '—', mx / Math.max(mn, 0.01) > 2 ? 'warn' : 'good');
      }
    });
    F.stat('hot', 'Busiest shard'); F.stat('cold', 'Quietest shard'); F.stat('ratio', 'Imbalance');
    F.add(BP.ctl('Shard key', BP.seg([['city', 'City'], ['hash', 'hash(order_id)']], 'city', (v) => {
      mode = v; labels();
      F.log(v === 'city' ? '<b>Shard by city:</b> easy to reason about, but Bengaluru is a third of all orders. Shard 1 melts while others idle.' : '<b>Shard by hash:</b> orders spread evenly. Cost: “all orders in Bengaluru” now has to ask every shard (scatter-gather).');
    })), BP.slider('Orders', { min: 4, max: 18, value: rate, fmt: (v) => v + '/s' }, (v) => (rate = v)));
    F.log('<b>Shard by city:</b> easy to reason about, but Bengaluru is a third of all orders. Shard 1 melts while others idle.');
    labels();
  };

  /* ---------- 10. Consistent hashing ring ---------- */
  sims.ring = function (host) {
    const F = BP.simFrame(host, { title: 'Consistent hashing ring', hint: 'Add and remove servers', viewBox: '0 0 760 380' });
    const R = F.layer(), K = F.layer(), S = F.layer(), B = F.layer();
    const c = [200, 190], r = 150;
    const keys = Array.from({ length: 60 }, (_, i) => ({ id: 'user:' + (i * 37 + 11), pos: 0 }));
    keys.forEach((k) => (k.pos = hash(k.id)));
    let servers = ['A', 'B', 'C', 'D'], spare = ['E', 'F', 'G', 'H'], vn = 1, owners = {}, lastMoved = null, lastMod = null, flash = new Set();
    R.append(s('circle', { cx: c[0], cy: c[1], r, class: 'wire', style: 'stroke-width:10;opacity:.35' }));
    text(R, c[0], c[1] - 6, 'hash space', 'n-tag', { 'text-anchor': 'middle' });
    text(R, c[0], c[1] + 12, '0 → 2³²', 'n-sub', { 'text-anchor': 'middle' });
    const at = (p, rr) => [c[0] + rr * Math.sin(p * 2 * Math.PI), c[1] - rr * Math.cos(p * 2 * Math.PI)];
    const color = (name) => COLORS[(name.charCodeAt(0) - 65) % COLORS.length];
    function points() { const pts = []; servers.forEach((n) => { for (let v = 0; v < vn; v++) pts.push({ n, pos: hash(n + '#' + v) }); }); return pts.sort((a, b) => a.pos - b.pos); }
    function owner(k, pts) { for (const p of pts) if (p.pos >= k.pos) return p.n; return pts[0].n; }
    function modOwner(k, list) { return list[Math.floor(hash(k.id + 'm') * 1e9) % list.length]; }
    function assign() { const pts = points(); const o = {}; keys.forEach((k) => (o[k.id] = owner(k, pts))); return o; }
    function draw() {
      const pts = points();
      K.innerHTML = ''; S.innerHTML = ''; B.innerHTML = '';
      keys.forEach((k) => { const [x, y] = at(k.pos, r); circle(K, x, y, flash.has(k.id) ? 6.5 : 4, { style: `fill:${color(owners[k.id])};${flash.has(k.id) ? 'stroke:var(--ink);stroke-width:2' : ''}` }); });
      pts.forEach((p) => {
        const [x, y] = at(p.pos, r);
        S.append(s('rect', { x: x - 8, y: y - 8, width: 16, height: 16, rx: 3, transform: `rotate(45 ${x} ${y})`, style: `fill:${color(p.n)};stroke:var(--paper);stroke-width:2` }));
        const [lx, ly] = at(p.pos, r + 24);
        text(S, lx, ly + 4, vn > 1 ? p.n + (pts.filter((q) => q.n === p.n).indexOf(p) + 1) : p.n, 'n-label', { 'text-anchor': 'middle' });
      });
      text(B, 440, 34, 'KEYS PER SERVER', 'n-tag');
      const counts = servers.map((n) => keys.filter((k) => owners[k.id] === n).length);
      servers.forEach((n, i) => {
        const y = 52 + i * 38;
        text(B, 440, y + 15, 'Server ' + n, 'n-label');
        B.append(s('rect', { x: 530, y: y + 3, width: 200, height: 16, rx: 4, class: 'fill-line' }));
        B.append(s('rect', { x: 530, y: y + 3, width: BP.clamp(200 * (counts[i] / 30), 2, 200), height: 16, rx: 4, style: `fill:${color(n)}` }));
        text(B, 736, y + 15, counts[i], 'n-sub', { 'text-anchor': 'end', style: 'fill:var(--ink)' });
      });
      F.set('servers', servers.length + (vn > 1 ? ` × ${vn} vnodes` : ''));
      F.set('moved', lastMoved == null ? '—' : `${lastMoved} / ${keys.length}`, 'good');
      F.set('mod', lastMod == null ? '—' : `${lastMod} / ${keys.length}`, 'bad');
      const mx = Math.max(...counts), mn = Math.min(...counts);
      F.set('bal', `${mn} – ${mx}`, mx > mn * 2.5 ? 'warn' : 'good');
    }
    function change(newList) {
      const before = owners, oldList = servers.slice();
      servers = newList;
      owners = assign();
      flash = new Set(keys.filter((k) => before[k.id] !== owners[k.id]).map((k) => k.id));
      lastMoved = flash.size;
      lastMod = keys.filter((k) => modOwner(k, oldList) !== modOwner(k, newList)).length;
      draw();
      BP.after(1600, () => { flash = new Set(); draw(); });
    }
    F.stat('servers', 'Servers'); F.stat('moved', 'Keys moved (ring)'); F.stat('mod', 'Would move (hash % N)'); F.stat('bal', 'Keys per server');
    F.add(BP.button('Add server', () => {
      if (!spare.length) return;
      const n = spare.shift(); change(servers.concat(n));
      F.log(`<b>Server ${n} joined.</b> Only keys between ${n} and its neighbor moved (outlined). With plain <code>hash % N</code>, ${lastMod} of ${keys.length} keys would have moved and the cache would go cold.`);
    }, 'primary'),
    BP.button('Remove a server', () => {
      if (servers.length <= 2) return;
      const n = BP.pick(servers); spare.unshift(n); change(servers.filter((x) => x !== n));
      F.log(`<b>Server ${n} left.</b> Its keys moved to the next server clockwise. Everyone else kept their keys.`);
    }, 'danger'),
    BP.ctl('Virtual nodes', BP.seg([[1, '1 per server'], [4, '4 per server']], 1, (v) => { vn = v; owners = assign(); lastMoved = lastMod = null; draw(); F.log(v > 1 ? '<b>Virtual nodes:</b> each server sits at 4 spots on the ring, so the keys spread much more evenly.' : 'One spot per server. Look at the bars: the split is uneven.'); })));
    F.log('Each key (dot) belongs to the first server (diamond) clockwise from it. Add a server and count how few keys move.');
    owners = assign(); draw();
  };

  /* ---------- 11. CAP theorem ---------- */
  sims.cap = function (host) {
    const F = BP.simFrame(host, { title: 'CAP: what happens during a network split', hint: 'Cut the network, then book', viewBox: '0 45 760 215' });
    const W = F.layer(), P = F.layer(), N = F.layer();
    const pk = BP.packetLayer(P);
    const M = [240, 150], D = [520, 150], A = [70, 150], Bc = [690, 150];
    const SEATS = 2;
    let mode = 'CP', split = false, m = SEATS, d = SEATS, sold = 0, rejected = 0, over = 0;
    BP.line(W, A, M); BP.line(W, Bc, D);
    const link = BP.line(W, [M[0] + 80, M[1]], [D[0] - 80, D[1]]);
    const cutTxt = text(W, 380, 132, '', 'n-tag', { 'text-anchor': 'middle' });
    userDot(N, A, 'A', 'var(--accent)'); userDot(N, Bc, 'B', 'var(--l3)');
    text(N, A[0], A[1] + 34, 'Asha', 'n-sub', { 'text-anchor': 'middle' }); text(N, Bc[0], Bc[1] + 34, 'Bilal', 'n-sub', { 'text-anchor': 'middle' });
    let nM, nD;
    function draw() {
      N.querySelectorAll('.dbn').forEach((e) => e.remove());
      nM = BP.node(N, { x: M[0], y: M[1], w: 160, h: 64, tag: 'DATACENTER · MUMBAI', label: `seats left: ${m}`, sub: 'Rajdhani 3A' }); nM.g.classList.add('dbn');
      nD = BP.node(N, { x: D[0], y: D[1], w: 160, h: 64, tag: 'DATACENTER · DELHI', label: `seats left: ${d}`, sub: 'Rajdhani 3A' }); nD.g.classList.add('dbn');
      link.setAttribute('class', 'wire ' + (split ? 'cut' : ''));
      cutTxt.textContent = split ? '✕ NETWORK PARTITION' : 'replication link';
      cutTxt.style.fill = split ? 'var(--bad)' : '';
      F.set('mode', mode === 'CP' ? 'CP · consistent' : 'AP · available');
      F.set('net', split ? 'SPLIT' : 'healthy', split ? 'bad' : 'good');
      F.set('rej', rejected, rejected ? 'warn' : ''); F.set('over', over, over ? 'bad' : '');
    }
    async function book(fromA) {
      const me = fromA ? A : Bc, mine = fromA ? M : D, other = fromA ? D : M, who = fromA ? 'Asha' : 'Bilal';
      await pk.send([me, mine], { cls: 'blue', dur: 0.5 });
      const local = fromA ? m : d;
      if (local <= 0) { await pk.send([mine, me], { cls: 'bad', dur: 0.5 }); F.log(`<b>${who}: sold out.</b>`); return; }
      if (!split) {
        await pk.send([mine, other], { cls: 'blue', dur: 0.5 });
        m--; d--; sold++; draw();
        await pk.send([mine, me], { cls: 'ok', dur: 0.5 });
        F.log(`<b>${who} booked a seat.</b> Network healthy, so both datacenters agree. Consistent and available.`);
        return;
      }
      if (mode === 'CP') {
        await pk.send([mine, mid(mine, other)], { cls: 'bad', dur: 0.4 });
        rejected++; draw();
        await pk.send([mine, me], { cls: 'bad', dur: 0.5 });
        F.log(`<b>CP: ${who}'s booking was refused.</b> The datacenter can't confirm with its partner, so it says “try again later” instead of risking a double booking. Consistent, not available.`);
      } else {
        if (fromA) m--; else d--;
        sold++; if (sold > SEATS) over = sold - SEATS;
        draw();
        await pk.send([mine, me], { cls: 'ok', dur: 0.5 });
        F.log(`<b>AP: ${who}'s booking was accepted locally.</b> The other datacenter doesn't know. ${over ? `<b>Overbooked by ${over}!</b> Heal the network to see the conflict.` : 'Try booking from the other side too.'}`);
      }
    }
    async function readB() {
      await pk.send([Bc, D], { cls: 'blue', dur: 0.5 });
      if (split && mode === 'CP') { rejected++; draw(); await pk.send([D, Bc], { cls: 'bad', dur: 0.5 }); F.log('<b>CP: read refused.</b> Delhi might be out of date, so it won\'t answer.'); return; }
      await pk.send([D, Bc], { cls: 'ok', dur: 0.5 });
      F.log(split && d !== m ? `<b>AP: Bilal sees ${d} seats</b>, but Mumbai already sold some. Stale answer. Available, not consistent.` : `<b>Bilal sees ${d} seat(s) left.</b>`);
    }
    function heal() {
      if (!split) return;
      split = false;
      const left = SEATS - sold;
      m = d = Math.max(0, left);
      draw();
      F.log(over ? `<b>Network healed. Conflict!</b> ${sold} tickets sold for ${SEATS} seats. AP systems need a plan for this: waitlist, refund, or merge rules.` : '<b>Network healed.</b> Datacenters sync up and agree again.');
    }
    F.stat('mode', 'Mode'); F.stat('net', 'Network'); F.stat('rej', 'Refused'); F.stat('over', 'Overbooked');
    F.add(BP.ctl('When split, prefer', BP.seg([['CP', 'Consistency'], ['AP', 'Availability']], 'CP', (v) => { mode = v; draw(); })),
      BP.button('Cut network', () => { split = true; draw(); F.log('<b>Network split.</b> Mumbai and Delhi can\'t talk. Now try booking from both sides.'); }, 'danger'),
      BP.button('Heal network', heal),
      BP.button('Asha books', () => book(true), 'primary'), BP.button('Bilal books', () => book(false), 'primary'), BP.button('Bilal checks seats', readB),
      BP.button('Reset', () => { split = false; m = d = SEATS; sold = rejected = over = 0; draw(); F.log('Reset. 2 seats left on the train.'); }));
    F.log('Only 2 seats are left. First book normally. Then <b>Cut network</b> and book from both sides, in CP and in AP.');
    draw();
  };

  /* ---------- 12. Token bucket rate limiter ---------- */
  sims.tokenBucket = function (host) {
    const F = BP.simFrame(host, { title: 'Rate limiter: token bucket', hint: 'Spam the button', viewBox: '0 0 760 270' });
    const W = F.layer(), P = F.layer(), N = F.layer(), T = F.layer();
    const pk = BP.packetLayer(P);
    const cl = [80, 140], api = [670, 140], bk = [350, 140];
    let cap = 5, refill = 1, tokens = 5, allowed = 0, denied = 0, traffic = 'off';
    BP.line(W, cl, [270, 140]); BP.line(W, [430, 140], api);
    userDot(N, cl, 'CLIENT', 'var(--accent)');
    BP.node(N, { x: api[0], y: api[1], w: 120, h: 56, label: 'Login API', tag: 'SERVICE' });
    N.append(s('path', { d: 'M270 60 L270 222 Q270 230 278 230 L422 230 Q430 230 430 222 L430 60', class: 'wire', style: 'stroke-width:3' }));
    text(N, 350, 50, 'TOKEN BUCKET', 'n-tag', { 'text-anchor': 'middle' });
    const rateTxt = text(N, 350, 252, '', 'n-sub', { 'text-anchor': 'middle' });
    function drawTokens() {
      T.innerHTML = '';
      for (let i = 0; i < cap; i++) {
        const x = 296 + (i % 5) * 27, y = 210 - Math.floor(i / 5) * 30;
        const fill = Math.max(0, Math.min(1, tokens - i));
        T.append(s('circle', { cx: x, cy: y, r: 11, class: 'fill-line' }));
        if (fill > 0) T.append(s('circle', { cx: x, cy: y, r: 11 * (fill < 1 ? 0.35 + fill * 0.5 : 1), class: fill >= 1 ? 'fill-amber' : 'fill-muted', style: fill < 1 ? 'opacity:.5' : '' }));
      }
      rateTxt.textContent = `+${refill} token/s · holds ${cap}`;
      F.set('tok', tokens.toFixed(1));
    }
    async function send() {
      await pk.send([cl, [282, 140]], { cls: 'blue', dur: 0.35 });
      if (tokens >= 1) {
        tokens -= 1; allowed++;
        pk.send([[282, 140], [430, 140], api], { cls: 'ok', dur: 0.5 });
      } else {
        denied++;
        pk.send([[282, 140], cl], { cls: 'bad', dur: 0.4 });
        F.log('<b>429 Too Many Requests.</b> Bucket is empty. The client must wait for a token to drip back in.');
      }
      F.set('ok', allowed, 'good'); F.set('no', denied, denied ? 'bad' : '');
      F.set('pct', Math.round((allowed / (allowed + denied)) * 100) + '%');
    }
    let acc = 0, tt = 0;
    BP.raf((dt) => {
      tokens = Math.min(cap, tokens + refill * dt);
      tt += dt;
      if (traffic === 'steady') { acc += dt * 1.5; }
      if (traffic === 'bursty' && Math.random() < dt * 0.5) acc += 8;
      while (acc >= 1) { acc--; send(); }
      if (tt > 0.1) { tt = 0; drawTokens(); }
    });
    F.stat('tok', 'Tokens now'); F.stat('ok', 'Allowed'); F.stat('no', 'Rejected (429)'); F.stat('pct', 'Success');
    F.add(BP.button('Send 1 request', send, 'primary'), BP.button('Burst ×10', () => { for (let i = 0; i < 10; i++) BP.after(i * 60, send); F.log('<b>Burst of 10.</b> The bucket lets through as many as it has tokens, then rejects the rest.'); }),
      BP.ctl('Auto traffic', BP.seg([['off', 'Off'], ['steady', 'Steady'], ['bursty', 'Bursty bot']], 'off', (v) => (traffic = v))),
      BP.slider('Bucket size', { min: 1, max: 10, value: cap, fmt: (v) => v + ' tokens' }, (v) => { cap = v; tokens = Math.min(tokens, cap); }),
      BP.slider('Refill', { min: 0.5, max: 5, step: 0.5, value: refill, fmt: (v) => v + '/s' }, (v) => (refill = v)));
    F.log('Each request spends one token. Tokens drip back at a fixed rate. Bucket size = how big a burst you allow.');
    drawTokens();
  };

  /* ---------- 13. Circuit breaker ---------- */
  sims.breaker = function (host) {
    const F = BP.simFrame(host, { title: 'Circuit breaker', hint: 'Break the payment service', viewBox: '0 0 760 290' });
    const W = F.layer(), P = F.layer(), N = F.layer();
    const pk = BP.packetLayer(P);
    const A = [100, 200], Br = [380, 200], B = [660, 200];
    let healthy = true, state = 'closed', fails = 0, openUntil = 0, calls = 0, fast = 0, errors = 0, clock = 0, busy = false;
    BP.line(W, A, Br); BP.line(W, Br, B);
    BP.node(N, { x: A[0], y: A[1], w: 140, h: 56, label: 'Order service', tag: 'CALLER' });
    const bN = BP.node(N, { x: B[0], y: B[1], w: 150, h: 56, label: 'Payment service', tag: 'DEPENDENCY', sub: 'healthy' });
    const brN = BP.node(N, { x: Br[0], y: Br[1], w: 130, h: 56, label: 'Breaker', tag: 'GUARD', sub: 'closed' });
    const pills = [['closed', 'CLOSED', 220], ['open', 'OPEN', 380], ['half', 'HALF-OPEN', 540]].map(([k, l, x]) => {
      const g = s('g'); const r = s('rect', { x: x - 62, y: 36, width: 124, height: 40, rx: 20, class: 'n-box' });
      g.append(r, s('text', { x, y: 61, 'text-anchor': 'middle', class: 'n-label', text: l })); N.append(g);
      return { k, r };
    });
    W.append(s('path', { d: 'M282 56 L318 56 M442 56 L478 56', class: 'wire', style: 'stroke-width:2' }));
    text(W, 300, 30, '3 fails', 'n-tag', { 'text-anchor': 'middle' }); text(W, 460, 30, 'after 4 s', 'n-tag', { 'text-anchor': 'middle' });
    text(W, 380, 112, 'trial fails → back to OPEN · trial works → CLOSED', 'n-sub', { 'text-anchor': 'middle' });
    function paint() {
      pills.forEach((p) => p.r.setAttribute('class', 'n-box ' + (p.k === state ? (state === 'closed' ? 'okay' : state === 'open' ? 'dead' : 'warn') : '')));
      brN.setSub(state === 'open' ? `open · ${Math.max(0, (openUntil - clock)).toFixed(1)}s` : state === 'half' ? 'testing…' : `closed · ${fails}/3 fails`);
      bN.setSub(healthy ? 'healthy' : 'timing out'); bN.setCls(healthy ? '' : 'dead');
      F.set('state', state.toUpperCase(), state === 'closed' ? 'good' : state === 'open' ? 'bad' : 'warn');
      F.set('calls', calls); F.set('fast', fast, fast ? 'warn' : ''); F.set('err', errors, errors ? 'bad' : '');
    }
    async function request() {
      if (busy) return;
      if (state === 'open' && clock >= openUntil) { state = 'half'; F.log('<b>Half-open:</b> cool-down over. Let one trial request through to test the water.'); }
      if (state === 'open') {
        fast++;
        await pk.send([A, Br, A], { cls: 'bad', dur: 0.5 });
        F.log('<b>Open:</b> failing fast without calling Payments. Order service shows “Pay on delivery” as a fallback. Payments gets room to recover.');
        paint(); return;
      }
      busy = state === 'half';
      calls++;
      await pk.send([A, Br, B], { cls: 'blue', dur: 0.7 });
      if (healthy) {
        await pk.send([B, Br, A], { cls: 'ok', dur: 0.6 });
        if (state === 'half') F.log('<b>Trial worked.</b> Breaker closes. Normal traffic resumes.');
        state = 'closed'; fails = 0;
      } else {
        await BP.wait(400);
        await pk.send([B, Br, A], { cls: 'bad', dur: 0.6 });
        errors++; fails++;
        if (state === 'half' || fails >= 3) { state = 'open'; openUntil = clock + 4; fails = 0; F.log('<b>Breaker opened.</b> Too many failures. Stop hammering a sick service.'); }
        else F.log(`<b>Call failed</b> after a slow timeout (${fails}/3). Each one ties up a thread in Order service.`);
      }
      busy = false; paint();
    }
    BP.raf((dt) => { clock += dt; });
    BP.every(900, request);
    BP.every(200, paint);
    F.stat('state', 'Breaker'); F.stat('calls', 'Calls to Payments'); F.stat('fast', 'Fast fails'); F.stat('err', 'Slow failures');
    F.add(BP.ctl('Payment service', BP.seg([[true, 'Healthy'], [false, 'Down']], true, (v) => { healthy = v; paint(); F.log(v ? 'Payments recovered. Wait for the next trial request.' : '<b>Payments is down.</b> Watch the breaker count failures.'); })));
    F.log('Requests flow every second. Set Payments to <b>Down</b> and watch the breaker trip, wait, test and recover.');
    paint();
  };

  /* ---------- 14. Bloom filter ---------- */
  sims.bloom = function (host) {
    const F = BP.simFrame(host, { title: 'Bloom filter: “is this username taken?”', hint: 'Add names, then check', viewBox: '0 0 760 170', narrowOk: false });
    const G = F.layer();
    const M = 32, K = 3;
    let bits = new Array(M).fill(0), items = [], hl = [];
    const idx = (w) => Array.from({ length: K }, (_, i) => Math.floor(hash(w.toLowerCase() + '|' + i) * M));
    function draw() {
      G.innerHTML = '';
      for (let i = 0; i < M; i++) {
        const x = 26 + (i % 16) * 45, y = i < 16 ? 30 : 100;
        G.append(s('rect', { x, y, width: 38, height: 38, rx: 6, class: 'n-box ' + (hl.includes(i) ? 'sel ' : '') + (bits[i] ? 'okay' : '') }));
        text(G, x + 19, y + 25, bits[i], 'n-big', { 'text-anchor': 'middle' });
        text(G, x + 19, y - 5, i, 'n-tag', { 'text-anchor': 'middle' });
      }
      const set = bits.filter(Boolean).length;
      const fp = Math.pow(1 - Math.exp((-K * items.length) / M), K);
      F.set('n', items.length); F.set('set', `${set}/${M}`); F.set('fp', (fp * 100).toFixed(1) + '%', fp > 0.2 ? 'bad' : fp > 0.05 ? 'warn' : 'good');
    }
    function add(w) {
      if (!w) return;
      hl = idx(w); hl.forEach((i) => (bits[i] = 1)); if (!items.includes(w.toLowerCase())) items.push(w.toLowerCase());
      F.log(`<b>Added “${w}”.</b> 3 hash functions picked bits ${hl.join(', ')} and set them to 1. The name itself is not stored.`);
      draw();
    }
    function check(w) {
      if (!w) return;
      hl = idx(w);
      const all = hl.every((i) => bits[i]);
      const real = items.includes(w.toLowerCase());
      if (!all) F.log(`<b>“${w}” is definitely free.</b> Bit ${hl.find((i) => !bits[i])} is 0, so it was never added. No database call needed.`);
      else if (real) F.log(`<b>“${w}” is probably taken.</b> Bits ${hl.join(', ')} are all 1. Now check the database to be sure.`);
      else F.log(`<b>False positive!</b> Bits ${hl.join(', ')} are all 1 because of other names, but “${w}” was never added. The database check will say it's free.`);
      draw();
    }
    const inp = h('input', { type: 'text', id: 'bloom-in', value: 'vinay', 'aria-label': 'Username', style: { width: '160px' } });
    F.stat('n', 'Names added'); F.stat('set', 'Bits set'); F.stat('fp', 'False-positive odds');
    F.add(BP.ctl('Username', inp), BP.button('Check', () => check(inp.value.trim()), 'primary'), BP.button('Add', () => add(inp.value.trim())),
      BP.button('Add 10 random', () => { for (let i = 0; i < 10; i++) add('user' + Math.floor(Math.random() * 9999)); }),
      BP.button('Clear', () => { bits.fill(0); items = []; hl = []; draw(); F.log('Cleared.'); }));
    ['rahul', 'priya', 'aisha', 'arjun'].forEach((w) => { idx(w).forEach((i) => (bits[i] = 1)); items.push(w); });
    F.log('Four names are already in. Check “vinay”, then “rahul”. Add 10 random names and watch the false-positive odds climb.');
    draw();
  };

  /* ---------- 15. Geospatial grid ---------- */
  sims.geo = function (host) {
    const F = BP.simFrame(host, { title: 'Find nearby drivers with a grid index', hint: 'Click anywhere on the map', viewBox: '0 0 760 400' });
    const Gr = F.layer(), H = F.layer(), D = F.layer(), O = F.layer(), T = F.layer();
    const COLS = 8, ROWS = 6, CS = 60, X0 = 20, Y0 = 20;
    const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      Gr.append(s('rect', { x: X0 + c * CS, y: Y0 + r * CS, width: CS, height: CS, class: 'n-box', style: 'fill:transparent;stroke-width:1;opacity:.6' }));
      text(Gr, X0 + c * CS + 4, Y0 + r * CS + 12, 'tdr' + B32[(c * ROWS + r) % 32], 'n-tag', { style: 'opacity:.6' });
    }
    const drivers = Array.from({ length: 48 }, () => ({ x: BP.rand(X0 + 5, X0 + COLS * CS - 5), y: BP.rand(Y0 + 5, Y0 + ROWS * CS - 5), vx: BP.rand(-12, 12), vy: BP.rand(-12, 12) }));
    const dots = drivers.map((d) => { const el = circle(D, d.x, d.y, 4.5, { class: 'fill-muted' }); return el; });
    let rider = null, best = null, checked = 0;
    const lineEl = s('line', { class: 'wire hot', x1: 0, y1: 0, x2: 0, y2: 0, style: 'display:none' }); O.append(lineEl);
    const pin = circle(O, -50, -50, 9, { class: 'fill-accent', style: 'stroke:var(--paper);stroke-width:3' });
    const T1 = text(T, 520, 40, 'HOW IT WORKS', 'n-tag');
    const lines = ['Each cell has an id (like a geohash).', 'Drivers report location every few', 'seconds; we file them under a cell.', 'To find nearby drivers, look only', 'in the rider\'s cell + 8 neighbors.', '', 'Real systems use geohash, S2 or', 'Uber\'s hexagonal H3 cells.'];
    lines.forEach((l, i) => text(T, 520, 66 + i * 20, l, 'n-sub', { style: 'fill:var(--ink-2)' }));
    void T1;
    const cellOf = (x, y) => [BP.clamp(Math.floor((x - X0) / CS), 0, COLS - 1), BP.clamp(Math.floor((y - Y0) / CS), 0, ROWS - 1)];
    function search() {
      if (!rider) return;
      H.innerHTML = '';
      const [c, r] = cellOf(rider.x, rider.y);
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
        H.append(s('rect', { x: X0 + cc * CS, y: Y0 + rr * CS, width: CS, height: CS, class: 'fill-soft', style: dc || dr ? 'opacity:.7' : '' }));
      }
      const cand = drivers.map((d, i) => ({ d, i })).filter(({ d }) => { const [dc, dr] = cellOf(d.x, d.y); return Math.abs(dc - c) <= 1 && Math.abs(dr - r) <= 1; });
      checked = cand.length;
      best = null; let bd = Infinity;
      cand.forEach(({ d, i }) => { const dist = Math.hypot(d.x - rider.x, d.y - rider.y); if (dist < bd) { bd = dist; best = i; } });
      dots.forEach((el, i) => el.setAttribute('class', i === best ? 'fill-ok' : cand.some((x) => x.i === i) ? 'fill-amber' : 'fill-muted'));
      dots.forEach((el, i) => el.setAttribute('r', i === best ? 7 : 4.5));
      F.set('cell', 'tdr' + B32[(c * ROWS + r) % 32]);
      F.set('checked', `${checked} of ${drivers.length}`, 'good');
      F.set('near', best == null ? 'none nearby' : Math.round(bd * 10) + ' m', best == null ? 'bad' : '');
    }
    function place(x, y) {
      rider = { x: BP.clamp(x, X0 + 2, X0 + COLS * CS - 2), y: BP.clamp(y, Y0 + 2, Y0 + ROWS * CS - 2) };
      pin.setAttribute('cx', rider.x); pin.setAttribute('cy', rider.y);
      search();
      F.log(best == null ? '<b>No drivers in the 9 cells.</b> Real systems widen the search ring.' : `<b>Checked only ${checked} drivers</b> in 9 nearby cells instead of all ${drivers.length}. In a real city that is ~50 instead of 100,000.`);
    }
    F.svg.addEventListener('click', (e) => {
      const pt = F.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(F.svg.getScreenCTM().inverse());
      if (p.x < X0 + COLS * CS) place(p.x, p.y);
    });
    F.svg.style.cursor = 'crosshair';
    let t = 0;
    BP.raf((dt) => {
      drivers.forEach((d, i) => {
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.x < X0 + 3 || d.x > X0 + COLS * CS - 3) d.vx *= -1;
        if (d.y < Y0 + 3 || d.y > Y0 + ROWS * CS - 3) d.vy *= -1;
        dots[i].setAttribute('cx', d.x); dots[i].setAttribute('cy', d.y);
      });
      t += dt;
      if (rider && t > 0.5) { t = 0; search(); }
      if (rider && best != null) { const d = drivers[best]; lineEl.setAttribute('x1', rider.x); lineEl.setAttribute('y1', rider.y); lineEl.setAttribute('x2', d.x); lineEl.setAttribute('y2', d.y); lineEl.style.display = ''; }
      else lineEl.style.display = 'none';
    });
    F.stat('cell', 'Rider cell'); F.stat('checked', 'Drivers checked'); F.stat('near', 'Nearest driver');
    F.add(BP.button('Random rider', () => place(BP.rand(X0, X0 + COLS * CS), BP.rand(Y0, Y0 + ROWS * CS)), 'primary'));
    F.log('Click the map to drop a rider. Amber drivers are the only ones we check. Green is the match.');
    place(250, 200);
  };

  /* ---------- 16. Polling vs WebSocket ---------- */
  sims.realtime = function (host) {
    const F = BP.simFrame(host, { title: 'Polling vs WebSocket', hint: 'Same events, two ways to deliver', viewBox: '0 0 760 280' });
    const W = F.layer(), P = F.layer(), N = F.layer();
    const pk = BP.packetLayer(P);
    const pc = [90, 85], ps = [650, 85], wc = [90, 215], ws = [650, 215];
    let interval = 3, pollReq = 0, empty = 0, pDelay = [], wDelay = [], pending = [], clock = 0, nextPoll = 1, nextEvt = 1.5;
    BP.line(W, [150, 85], [590, 85], 'dash');
    W.append(s('line', { x1: 150, y1: 215, x2: 590, y2: 215, class: 'wire', style: 'stroke-width:6;opacity:.35;stroke:var(--accent)' }));
    text(W, 370, 40, 'HTTP POLLING · “anything new?” every few seconds', 'n-tag', { 'text-anchor': 'middle' });
    text(W, 370, 170, 'WEBSOCKET · one open connection, server pushes', 'n-tag', { 'text-anchor': 'middle' });
    BP.node(N, { x: pc[0], y: pc[1], w: 120, h: 50, label: 'Rider app', tag: 'CLIENT' });
    const s1 = BP.node(N, { x: ps[0], y: ps[1], w: 120, h: 50, label: 'Server', tag: 'SERVER', sub: '0 waiting' });
    BP.node(N, { x: wc[0], y: wc[1], w: 120, h: 50, label: 'Rider app', tag: 'CLIENT' });
    BP.node(N, { x: ws[0], y: ws[1], w: 120, h: 50, label: 'Server', tag: 'SERVER' });
    const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) + ' s' : '—');
    function paint() {
      F.set('req', pollReq); F.set('empty', pollReq ? Math.round((empty / pollReq) * 100) + '%' : '—', empty ? 'warn' : '');
      F.set('pd', avg(pDelay), 'warn'); F.set('wd', avg(wDelay), 'good');
      s1.setSub(pending.length + ' waiting');
    }
    async function poll() {
      pollReq++; paint();
      await pk.send([[150, 85], [590, 85]], { cls: 'ink', r: 4, dur: 0.45 });
      const got = pending.splice(0);
      if (!got.length) empty++;
      await pk.send([[590, 85], [150, 85]], { cls: got.length ? 'ok' : 'ink', r: got.length ? 6 : 3, dur: 0.45 });
      got.forEach((t0) => pDelay.push(clock - t0));
      paint();
    }
    async function event() {
      const t0 = clock;
      pending.push(t0);
      pk.send([[590, 215], [150, 215]], { cls: 'ok', r: 6, dur: 0.45 }).then(() => { wDelay.push(clock - t0); paint(); });
      F.log('<b>Driver moved.</b> WebSocket pushed it at once. The polling app will only find out on its next poll.');
      paint();
    }
    BP.raf((dt) => {
      clock += dt;
      if (clock >= nextPoll) { nextPoll = clock + interval; poll(); }
      if (clock >= nextEvt) { nextEvt = clock + BP.rand(1.5, 4); event(); }
    });
    F.stat('req', 'Poll requests'); F.stat('empty', 'Empty polls'); F.stat('pd', 'Delay (polling)'); F.stat('wd', 'Delay (WebSocket)');
    F.add(BP.slider('Poll every', { min: 1, max: 6, step: 0.5, value: interval, fmt: (v) => v + ' s' }, (v) => (interval = v)));
    F.log('Poll fast and you waste requests. Poll slowly and updates arrive late. WebSockets avoid that trade-off for live data.');
  };

  /* ---------- 17. Index vs full scan ---------- */
  sims.index = function (host) {
    const F = BP.simFrame(host, { title: 'Database index vs full table scan', hint: 'Find a user both ways', viewBox: '0 0 760 225' });
    const G = F.layer();
    const COLS = 20, ROWS = 6, NROW = COLS * ROWS;
    const ids = Array.from({ length: NROW }, (_, i) => 1000 + i * 7);
    let cells = [], running = false;
    for (let i = 0; i < NROW; i++) {
      const x = 22 + (i % COLS) * 36, y = 18 + Math.floor(i / COLS) * 33;
      const r = s('rect', { x, y, width: 32, height: 28, rx: 4, class: 'n-box' });
      const t = text(G, x + 16, y + 18, ids[i], 'n-tag', { 'text-anchor': 'middle', style: 'letter-spacing:0' });
      G.append(r); G.append(t); cells.push(r);
    }
    const reset = () => cells.forEach((c) => c.setAttribute('class', 'n-box'));
    async function scan() {
      if (running) return; running = true; reset();
      const target = Math.floor(BP.rand(NROW * 0.4, NROW));
      F.log(`<b>Full scan:</b> looking for user ${ids[target]} by reading every row in order…`);
      for (let i = 0; i <= target; i++) {
        cells[i].setAttribute('class', 'n-box ' + (i === target ? 'okay' : 'warn'));
        F.set('read', i + 1);
        if (i % 2 === 0) await BP.wait(BP.reduced ? 0 : 18);
      }
      F.set('big', '≈ 5,000,000', 'bad');
      F.log(`<b>Found after reading ${target + 1} rows.</b> On a 10M-row table that is millions of reads per query.`);
      running = false;
    }
    async function index() {
      if (running) return; running = true; reset();
      const target = Math.floor(BP.rand(0, NROW));
      let lo = 0, hi = NROW - 1, steps = 0;
      F.log(`<b>Index lookup:</b> ids are kept sorted in a tree, so we jump to the middle and halve the search each step.`);
      while (lo <= hi) {
        const m = (lo + hi) >> 1; steps++;
        cells[m].setAttribute('class', 'n-box ' + (m === target ? 'okay' : 'hot'));
        F.set('read', steps);
        await BP.wait(BP.reduced ? 50 : 420);
        if (m === target) break;
        if (m < target) { for (let i = lo; i <= m; i++) if (i !== m) cells[i].setAttribute('class', 'n-box dead'); lo = m + 1; }
        else { for (let i = m; i <= hi; i++) if (i !== m) cells[i].setAttribute('class', 'n-box dead'); hi = m - 1; }
      }
      F.set('big', '≈ 24', 'good');
      F.log(`<b>Found user ${ids[target]} in ${steps} steps.</b> log₂(120) ≈ 7. On 10M rows it is still only about 24 steps.`);
      running = false;
    }
    F.stat('read', 'Rows read'); F.stat('big', 'Reads on 10M rows');
    F.add(BP.button('Full table scan', scan), BP.button('Use index', index, 'primary'));
    F.log('120 users sorted by id. Find a random one by scanning, then with an index.');
  };

  /* ---------- 18. Pick a database ---------- */
  sims.dbPicker = function (host) {
    const ans = { shape: 'tables', tx: true, scale: 'one', query: 'joins' };
    const out = h('div', { style: { padding: '16px 18px', borderTop: '1px solid var(--line)' } });
    const recs = {
      sql: ['Relational database', 'PostgreSQL, MySQL', 'Tables, joins and ACID transactions. The safe default for most products. Start here unless you have a clear reason not to.'],
      dsql: ['Distributed SQL / sharded SQL', 'CockroachDB, Google Spanner, Vitess (sharded MySQL)', 'You need SQL and transactions but one machine is not enough. More moving parts, so only when you truly need it.'],
      doc: ['Document database', 'MongoDB, Couchbase, Firestore', 'Each record is a JSON document with its own shape. Great for catalogs and profiles that change often. Joins are weak.'],
      docsql: ['Relational with JSON columns', 'PostgreSQL with JSONB', 'Flexible fields plus real transactions. Many teams pick this over a pure document DB.'],
      kv: ['Key-value store', 'Redis, DynamoDB', 'Get and put by key, extremely fast. Sessions, carts, counters, caches. No ad-hoc queries.'],
      wide: ['Wide-column / time-series store', 'Cassandra, ScyllaDB, TimescaleDB', 'Massive write rates spread over many machines. Chat messages, sensor data, location pings. You design tables around your queries.'],
      graph: ['Graph database', 'Neo4j, Amazon Neptune', 'When the relationships are the data: friends of friends, fraud rings, recommendations.'],
      search: ['Search engine next to your main DB', 'Elasticsearch, OpenSearch', 'Full-text search, typo tolerance, filters and ranking. Keep the source of truth in your main DB and sync into the search index.'],
    };
    function decide() {
      if (ans.query === 'search') return 'search';
      if (ans.shape === 'graph') return 'graph';
      if (ans.shape === 'series') return 'wide';
      if (ans.shape === 'kv') return 'kv';
      if (ans.shape === 'docs') return ans.tx ? 'docsql' : 'doc';
      return ans.tx && ans.scale === 'many' ? 'dsql' : ans.scale === 'many' && !ans.tx ? 'wide' : 'sql';
    }
    function render() {
      const [name, ex, why] = recs[decide()];
      out.innerHTML = '';
      out.append(h('div', { class: 'eyebrow' }, 'Recommendation'), h('h3', { style: { margin: '4px 0 2px' } }, name), h('p', { class: 'mono', style: { margin: '0 0 6px', color: 'var(--accent)', fontSize: '14px' } }, ex), h('p', { style: { margin: 0, color: 'var(--ink-2)' } }, why));
    }
    const q = (label, key, opts) => BP.ctl(label, BP.seg(opts, ans[key], (v) => { ans[key] = v; render(); }));
    const panel = h('div', { class: 'sim' },
      h('div', { class: 'sim-head' }, h('i', { class: 'live' }), 'Live · Which database fits?'),
      h('div', { class: 'sim-controls', style: { borderTop: '0' } },
        q('Shape of the data', 'shape', [['tables', 'Rows & relations'], ['docs', 'JSON documents'], ['kv', 'Key → value'], ['series', 'Huge event stream'], ['graph', 'Network of links']]),
        q('Money or stock involved?', 'tx', [[true, 'Yes, need transactions'], [false, 'No']]),
        q('Size', 'scale', [['one', 'Fits one big server'], ['many', 'Needs many servers']]),
        q('Main queries', 'query', [['joins', 'Joins & reports'], ['key', 'Lookup by id'], ['search', 'Text search']])),
      out);
    host.appendChild(panel);
    render();
  };

  /* ---------- 19. Feed fan-out ---------- */
  sims.fanout = function (host) {
    const F = BP.simFrame(host, { title: 'News feed: push vs pull', hint: 'Post as a celebrity', viewBox: '0 0 760 300' });
    const W = F.layer(), P = F.layer(), N = F.layer();
    const pk = BP.packetLayer(P);
    const steps = [100, 1000, 10000, 100000, 1000000, 50000000];
    let fi = 1, mode = 'push', writes = 0, reads = 0;
    const author = [80, 150], svc = [250, 150];
    BP.line(W, author, svc);
    userDot(N, author, 'YOU', 'var(--accent)');
    const authorLab = text(N, author[0], author[1] + 36, '', 'n-sub', { 'text-anchor': 'middle' });
    BP.node(N, { x: svc[0], y: svc[1], w: 120, h: 56, label: 'Feed service', tag: 'SERVICE' });
    const boxes = [];
    for (let i = 0; i < 12; i++) {
      const c = i % 4, r = Math.floor(i / 4);
      const p = [440 + c * 80, 70 + r * 80];
      W.append(s('line', { x1: svc[0] + 60, y1: svc[1], x2: p[0] - 30, y2: p[1], class: 'wire', style: 'opacity:.3' }));
      const n = BP.node(N, { x: p[0], y: p[1], w: 64, h: 52, label: '', tag: 'FEED', sub: '' });
      boxes.push({ p, n, items: 0 });
    }
    const moreTxt = text(N, 600, 292, '', 'n-sub', { 'text-anchor': 'middle' });
    function paint() {
      const f = steps[fi];
      authorLab.textContent = BP.fmtNum(f, 0) + ' followers';
      moreTxt.textContent = f > 12 ? `12 of ${BP.fmtNum(f, 0)} follower feeds shown` : '';
      boxes.forEach((b) => { b.n.lab.textContent = b.items ? b.items + ' new' : ''; b.n.setSub(''); });
      F.set('w', BP.fmtNum(writes, 1)); F.set('r', BP.fmtNum(reads, 1));
    }
    const usePush = () => mode === 'push' || (mode === 'hybrid' && steps[fi] < 100000);
    async function post() {
      const f = steps[fi];
      await pk.send([author, svc], { cls: 'blue', dur: 0.5 });
      if (usePush()) {
        writes += f;
        boxes.forEach((b, i) => BP.after(i * 40, () => pk.send([[svc[0] + 60, svc[1]], b.p], { cls: 'amber', r: 4, dur: 0.6 }).then(() => { b.items++; paint(); })));
        F.set('lat', f >= 1e6 ? `~${Math.round(f / 200000)} s to reach all` : 'instant', f >= 1e6 ? 'bad' : 'good');
        F.log(f >= 1e6 ? `<b>Push for a celebrity = ${BP.fmtNum(f, 0)} writes for one photo.</b> Fans see it late and the write queue is swamped. Try Hybrid.` : `<b>Fan-out on write:</b> your post was copied into ${BP.fmtNum(f, 0)} feeds now, so each follower's feed is a single fast read.`);
      } else {
        writes += 1;
        F.set('lat', 'instant', 'good');
        F.log(mode === 'hybrid' ? '<b>Hybrid:</b> you have too many followers to push. The post is stored once, and followers pull it in when they open their feed.' : '<b>Fan-out on read:</b> stored once. Cheap writes, but every feed open must gather posts from everyone the reader follows.');
      }
      paint();
    }
    async function open() {
      const b = boxes[0];
      if (mode === 'pull') { reads += 300; await pk.send([b.p, [svc[0] + 60, svc[1]], b.p], { cls: 'bad', dur: 1.4 }); F.log('<b>Pull:</b> opening one feed queried 300 accounts and merged the results. Slow at read time.'); }
      else if (mode === 'hybrid') { reads += 6; await pk.send([b.p, [svc[0] + 60, svc[1]], b.p], { cls: 'ok', dur: 0.9 }); F.log('<b>Hybrid:</b> read the pre-built feed, plus pulled from the few celebrities this person follows. Fast and cheap.'); }
      else { reads += 1; await pk.send([b.p, [b.p[0] - 30, b.p[1]], b.p], { cls: 'ok', dur: 0.4 }); F.log('<b>Push:</b> the feed was ready. One read.'); }
      b.items = 0; paint();
    }
    F.stat('w', 'Total writes'); F.stat('r', 'Total reads'); F.stat('lat', 'Delivery');
    F.add(BP.button('Post a photo', post, 'primary'), BP.button('Open a follower\'s feed', open),
      BP.ctl('Strategy', BP.seg([['push', 'Push (on write)'], ['pull', 'Pull (on read)'], ['hybrid', 'Hybrid']], 'push', (v) => { mode = v; paint(); })),
      BP.slider('Followers', { min: 0, max: steps.length - 1, value: fi, fmt: (v) => BP.fmtNum(steps[v], 0) }, (v) => { fi = v; paint(); }));
    F.log('Post with 1K followers, then drag followers to 50M (a cricket star) and post again.');
    paint();
  };
})();
