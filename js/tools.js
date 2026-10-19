/* Tool pages: scale story, estimator, 7-day plan, quiz arena, interview framework. */
(function () {
  const BP = window.BP;
  const { h, s } = BP;
  const pages = (BP.pages = {});

  /* ================= 1 user → 1B users ================= */
  const STAGES = [
    { u: '1–100', title: 'One box does everything', broke: null, fix: 'App and database share one server. Perfect for a prototype: one thing to deploy, one bill. Do not over-engineer yet.' },
    { u: '1K', title: 'Separate the database', broke: 'App and database fight over CPU and memory. A bad deploy or a full disk can take your data down with the app.', fix: 'Move the database to its own server. Size, tune and back up each one separately.' },
    { u: '10K', title: 'Add a load balancer', broke: 'One app server is maxed out at lunch, and every deploy or crash means downtime.', fix: 'Run three identical, stateless app servers behind a load balancer. Lose one and keep serving.' },
    { u: '100K', title: 'Cache and read replicas', broke: 'Database CPU is at 90%, mostly from the same popular reads (menus, profiles).', fix: 'Put Redis in front for hot data and add read replicas. Writes still go to the primary.' },
    { u: '1M', title: 'CDN, object storage, shared sessions', broke: 'Images eat bandwidth, far-away users see slow pages, and users get logged out when the load balancer picks a different server.', fix: 'Serve images and static files from a CDN backed by object storage. Keep sessions in Redis so any server can serve any user.' },
    { u: '10M', title: 'Queues and background workers', broke: 'Sending emails, resizing photos and updating counters inside the request makes it slow, and traffic spikes topple services.', fix: 'Put slow work on a queue. Workers handle it in the background. The request returns right away.' },
    { u: '100M', title: 'Shard the database', broke: 'Writes alone overwhelm the biggest primary money can buy, and tables are many terabytes.', fix: 'Split data across shards by a key like user_id, using consistent hashing. Each shard has its own replicas.' },
    { u: '1B', title: 'Go multi-region', broke: 'Users on other continents see 200 ms round trips, and one datacenter outage takes everyone down.', fix: 'Run full copies of the stack in several regions. GeoDNS sends users to the nearest one; data replicates between regions.' },
  ];
  const SN = {
    users: [80, 260, 0, 9, 'USERS', ''], dns: [80, 90, 7, 9, 'DNS', 'GeoDNS'], cdn: [240, 90, 4, 9, 'CDN', 'edge caches'],
    store: [430, 50, 4, 9, 'STORAGE', 'S3 images'], lb: [240, 260, 2, 9, 'LB', 'load balancer'],
    one: [430, 260, 0, 0, 'SERVER', 'app + database'], app1: [430, 260, 1, 9, 'APP', 'api-1'], app2: [430, 160, 2, 9, 'APP', 'api-2'], app3: [430, 360, 2, 9, 'APP', 'api-3'],
    cache: [620, 150, 3, 9, 'CACHE', 'Redis'], db: [800, 260, 1, 5, 'DATABASE', 'primary'], rep: [800, 370, 3, 5, 'REPLICA', 'read-only copy'],
    sh1: [800, 170, 6, 9, 'SHARD 1', 'users A–H'], sh2: [800, 270, 6, 9, 'SHARD 2', 'users I–Q'], sh3: [800, 370, 6, 9, 'SHARD 3', 'users R–Z'],
    q: [620, 400, 5, 9, 'QUEUE', 'Kafka'], work: [800, 470, 5, 9, 'WORKERS', 'emails, resize'], reg2: [240, 450, 7, 9, 'REGION 2', 'same stack, Singapore'],
  };
  const SE = [['users', 'one', 0, 0], ['users', 'app1', 1, 1], ['users', 'lb', 2, 9], ['lb', 'app1', 2, 9], ['lb', 'app2', 2, 9], ['lb', 'app3', 2, 9],
    ['app1', 'db', 1, 5], ['app2', 'db', 2, 5], ['app3', 'db', 2, 5], ['app2', 'cache', 3, 9], ['app1', 'cache', 3, 9], ['db', 'rep', 3, 5],
    ['users', 'cdn', 4, 9], ['cdn', 'store', 4, 9], ['app2', 'store', 4, 9], ['app3', 'q', 5, 9], ['q', 'work', 5, 9],
    ['app2', 'sh1', 6, 9], ['app1', 'sh2', 6, 9], ['app3', 'sh3', 6, 9], ['users', 'dns', 7, 9], ['dns', 'lb', 7, 9], ['dns', 'reg2', 7, 9]];

  pages.scale = function (page) {
    page.append(h('div', { class: 'eyebrow' }, 'Start here · interactive story'), h('h1', null, 'From 1 user to 1 billion'),
      h('p', { class: 'lead' }, 'Every big system grew one bottleneck at a time. Drag the slider and watch the architecture change. Each step says what broke and what fixed it.'));
    let st = BP.clamp(BP.store.get('scaleStage', 0), 0, 7);
    const usersEl = h('div', { class: 'story-users' });
    const input = h('input', { type: 'range', min: 0, max: 7, step: 1, value: st, id: 'scale-slider', 'aria-label': 'Number of users' });
    const ticks = h('div', { class: 'story-ticks' }, STAGES.map((x) => h('span', null, x.u.replace('1–100', '1'))));
    const prev = BP.button('←', () => set(st - 1)), next = BP.button('Next stage →', () => set(st + 1), 'primary');
    const svg = s('svg', { viewBox: '0 0 1000 520', role: 'img', 'aria-label': 'Architecture at this scale' });
    const E = s('g'), P = s('g'), N = s('g'); svg.append(E, P, N);
    const text = h('div', { class: 'story-text' });
    page.append(h('div', { class: 'scale-story' },
      h('div', { class: 'story-top' }, usersEl, h('div', { class: 'story-slider' }, input, ticks), h('div', { style: { display: 'flex', gap: '8px' } }, prev, next)),
      h('div', { class: 'story-body' }, h('div', { class: 'sim-stage' }, svg), text)));
    const pk = BP.packetLayer(P);
    const vis = (k) => st >= SN[k][2] && st <= SN[k][3];
    const nodeG = {};
    Object.entries(SN).forEach(([k, [x, y, , , tag, sub]]) => {
      const g = s('g', { class: 'fade-node' });
      if (k === 'users') {
        g.append(s('circle', { cx: x, cy: y, r: 34, class: 'fill-accent' }));
        g.append(s('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'n-tag', style: 'fill:var(--accent-ink)', text: 'USERS' }));
      } else {
        const n = BP.node(g, { x, y, w: 140, h: 50, label: tag, sub, cls: k === 'reg2' ? '' : '' });
        if (k === 'reg2') n.rect.setAttribute('stroke-dasharray', '6 4');
      }
      N.append(g); nodeG[k] = g;
    });
    const edgeEls = SE.map(([a, b, f, t]) => {
      const A = SN[a], B = SN[b];
      const l = s('line', { x1: A[0], y1: A[1], x2: B[0], y2: B[1], class: 'wire fade-node' + (a === 'dns' || b === 'reg2' ? ' dash' : '') });
      E.append(l);
      return { l, f, t };
    });
    const pos = (k) => [SN[k][0], SN[k][1]];
    function draw() {
      Object.entries(nodeG).forEach(([k, g]) => { const v = vis(k); g.style.opacity = v ? 1 : 0; g.style.pointerEvents = v ? '' : 'none'; });
      edgeEls.forEach(({ l, f, t }) => (l.style.opacity = st >= f && st <= t ? 1 : 0));
      const S = STAGES[st];
      usersEl.innerHTML = '';
      usersEl.append(S.u, h('small', null, 'users'));
      input.value = st;
      prev.disabled = st === 0; next.disabled = st === 7;
      text.innerHTML = '';
      text.append(h('div', { class: 'eyebrow' }, `Stage ${st + 1} of 8`), h('h3', null, S.title));
      if (S.broke) text.append(h('div', { class: 'broke' }, h('b', null, 'What broke'), S.broke));
      text.append(h('div', { class: 'fix', style: S.broke ? null : { gridColumn: '1 / -1' } }, h('b', null, S.broke ? 'The fix' : 'The setup'), S.fix));
      const learn = { 2: 'load-balancing', 3: 'caching', 4: 'cdn', 5: 'message-queues', 6: 'sharding', 7: 'replication' }[st];
      if (learn) { const t = BP.TOPICS.find((x) => x.id === learn); text.append(h('p', { style: { marginTop: '12px', marginBottom: 0 } }, 'Learn more: ', h('a', { href: '#t-' + learn }, t.title))); }
      BP.store.set('scaleStage', st);
    }
    function set(v) { st = BP.clamp(v, 0, 7); draw(); }
    input.addEventListener('input', () => set(+input.value));
    function route() {
      if (st === 0) return ['users', 'one'];
      if (st === 1) return ['users', 'app1', 'db'];
      const app = BP.pick(['app1', 'app2', 'app3']);
      if (st >= 4 && Math.random() < 0.35) return ['users', 'cdn'];
      const front = st === 7 ? ['users', 'lb'] : ['users', 'lb'];
      if (st >= 3 && Math.random() < 0.6) return front.concat([app, 'cache']);
      if (st >= 6) return front.concat([app, { app1: 'sh2', app2: 'sh1', app3: 'sh3' }[app]]);
      return front.concat([app, 'db']);
    }
    BP.every(BP.reduced ? 1500 : 420, async () => {
      const r = route();
      const pts = r.map(pos);
      await pk.send(pts.concat(pts.slice(0, -1).reverse()), { cls: 'blue', r: 4.5, dur: 0.5 * pts.length + 0.3 });
    });
    BP.every(1500, () => { if (st >= 5) pk.send([pos('app3'), pos('q'), pos('work')], { cls: 'amber', r: 4, dur: 1.2 }); });
    draw();
    page.append(h('div', { class: 'callout tip' }, h('span', { class: 'ico' }, 'Interview'), h('p', null, 'This exact story is a great answer to “how would you scale this?” Walk the stages in order, and for each one say what metric told you it was time (CPU, latency, error rate, storage).')));
    page.append(BP.foot());
  };

  /* ================= Estimator ================= */
  const PRESETS = {
    url: { name: 'URL shortener', dau: 10e6, writes: 1, ratio: 100, size: 500, years: 5, peak: 3, resp: 0.5 },
    food: { name: 'Food delivery', dau: 20e6, writes: 0.5, ratio: 50, size: 3000, years: 3, peak: 3, resp: 20 },
    chat: { name: 'Chat app', dau: 500e6, writes: 40, ratio: 1, size: 100, years: 1, peak: 2.5, resp: 0.5 },
    photo: { name: 'Photo feed', dau: 500e6, writes: 0.2, ratio: 200, size: 2e6, years: 10, peak: 2, resp: 200 },
  };
  pages.estimate = function (page) {
    page.append(h('div', { class: 'eyebrow' }, 'Practice · calculator'), h('h1', null, 'Back-of-envelope calculator'),
      h('p', { class: 'lead' }, 'Change the inputs and watch QPS, storage and bandwidth update. Presets are illustrative, not real company numbers. In interviews do this math by hand; use this to check yourself.'));
    const v = Object.assign({}, BP.store.get('est', PRESETS.food));
    const fields = [
      ['dau', 'Daily active users', 1], ['writes', 'Writes per user per day', 0.1], ['ratio', 'Reads per write', 1],
      ['size', 'Bytes per written item', 1], ['years', 'Years to keep data', 1], ['peak', 'Peak ÷ average', 0.5], ['resp', 'Avg response size (KB)', 0.5]];
    const form = h('form', { class: 'est-form', onsubmit: (e) => e.preventDefault() });
    const presetSel = h('select', { id: 'est-preset' }, h('option', { value: '' }, 'Custom'), Object.entries(PRESETS).map(([k, p]) => h('option', { value: k }, p.name)));
    form.append(h('label', { for: 'est-preset' }, 'PRESET', presetSel));
    const inputs = {};
    fields.forEach(([k, label, step]) => {
      const inp = h('input', { type: 'number', id: 'est-' + k, min: 0, step, value: v[k] });
      inp.addEventListener('input', () => { v[k] = +inp.value || 0; presetSel.value = ''; BP.store.set('estPreset', ''); calc(); });
      inputs[k] = inp;
      form.append(h('label', { for: 'est-' + k }, label.toUpperCase(), inp));
    });
    presetSel.value = BP.store.get('estPreset', 'food');
    presetSel.addEventListener('change', () => { BP.store.set('estPreset', presetSel.value); const p = PRESETS[presetSel.value]; if (!p) return; Object.assign(v, p); fields.forEach(([k]) => (inputs[k].value = v[k])); calc(); });
    const out = h('div', { class: 'est-out' });
    const verdict = h('div', { class: 'callout tip', style: { maxWidth: 'none' } });
    page.append(h('div', { class: 'est' }, form, h('div', { style: { minWidth: 0 } }, out, verdict)));
    const tile = (label, val, how) => h('div', { class: 'est-tile' }, h('span', null, label), h('b', null, val), h('small', null, how));
    function calc() {
      BP.store.set('est', v);
      const wps = (v.dau * v.writes) / 86400, rps = wps * v.ratio;
      const pw = wps * v.peak, pr = rps * v.peak;
      const perDay = v.dau * v.writes * v.size, total = perDay * 365 * v.years;
      const bw = rps * v.resp * 1000 * 8;
      const servers = Math.max(2, Math.ceil(((pw + pr) / 2000) * 1.3));
      const cacheB = v.dau * v.writes * v.ratio * Math.min(v.size, v.resp * 1000) * 0.2;
      out.innerHTML = '';
      out.append(
        tile('Writes / s', BP.fmtNum(wps), `peak ${BP.fmtNum(pw)}/s · DAU × writes ÷ 86,400`),
        tile('Reads / s', BP.fmtNum(rps), `peak ${BP.fmtNum(pr)}/s · writes × ${v.ratio}`),
        tile(`Storage · ${v.years} yr`, BP.fmtBytes(total), `${BP.fmtBytes(perDay)}/day before replication (×3 in practice)`),
        tile('Egress bandwidth', BP.fmtNum(bw / 1e6) + ' Mbps', `reads/s × ${v.resp} KB`),
        tile('App servers (peak)', servers, '~2,000 req/s each, +30% headroom'),
        tile('Cache (80/20 rule)', BP.fmtBytes(cacheB), '20% of a day’s read volume'));
      const notes = [];
      notes.push(v.ratio >= 10 ? `<b>Read-heavy (${v.ratio}:1).</b> Lead with caching, read replicas and a CDN.` : v.ratio <= 2 ? '<b>Write-heavy.</b> Think about a write-optimized store (Cassandra-style), partitioning, and queues to absorb bursts.' : '<b>Balanced reads and writes.</b>');
      notes.push(pw > 5000 ? '<b>Peak writes exceed what one SQL primary comfortably takes.</b> Plan for sharding.' : '<b>Writes fit on one primary database</b> (with replicas for safety).');
      notes.push(total * 3 > 50e12 ? '<b>Storage is large.</b> Partition data and move old data to cheaper tiers.' : '<b>Storage is manageable</b> on a few machines.');
      verdict.innerHTML = '';
      verdict.append(h('span', { class: 'ico' }, 'Verdict'), h('div', null, h('b', { class: 't' }, 'What these numbers suggest'), h('p', { html: notes.join(' ') })));
    }
    calc();
    page.append(h('h2', null, 'Numbers to remember'), h('div', { class: 'table-wrap' }, h('table', { html: `
      <tr><th>Fact</th><th>Value</th><th>Shortcut</th></tr>
      <tr><td>Seconds per day</td><td class="num">86,400</td><td>≈ 10⁵</td></tr>
      <tr><td>Seconds per month</td><td class="num">2.6M</td><td>≈ 2.5 × 10⁶</td></tr>
      <tr><td>1M requests / day</td><td class="num">~12 / s</td><td>divide by 10⁵</td></tr>
      <tr><td>Simple app server</td><td class="num">1K–10K req/s</td><td>CPU-bound work is lower</td></tr>
      <tr><td>Redis node</td><td class="num">~100K ops/s</td><td>in memory, sub-ms</td></tr>
      <tr><td>SQL primary (OLTP)</td><td class="num">~5K–10K writes/s</td><td>varies a lot with hardware</td></tr>
      <tr><td>Kafka broker</td><td class="num">100s of MB/s</td><td>sequential disk writes</td></tr>
      <tr><td>2¹⁰ / 2²⁰ / 2³⁰ / 2⁴⁰</td><td class="num">KB / MB / GB / TB</td><td>thousand / million / billion / trillion</td></tr>` })));
    page.append(BP.foot());
  };

  /* ================= 7-day plan ================= */
  const DAYS = [
    ['Foundations', 'How requests travel, how fast things are, and how systems grow.', ['p:scale', 't:what-is-system-design', 't:client-server', 't:latency', 't:scaling', 't:estimation']],
    ['Core building blocks', 'The parts in almost every diagram. End with your first full design.', ['t:load-balancing', 't:caching', 't:cdn', 't:databases', 'c:url-shortener']],
    ['Data and communication', 'Indexes, APIs and queues: how parts talk and how data is found.', ['t:indexing', 't:api-design', 't:message-queues', 'p:estimate']],
    ['Data at scale', 'Copying, splitting and agreeing on data across machines.', ['t:replication', 't:sharding', 't:consistent-hashing', 't:cap-theorem', 't:consistency-models', 't:object-storage']],
    ['Staying alive', 'Rate limits, failures, retries, real-time and location. Then two food-tech designs.', ['t:rate-limiting', 't:resilience', 't:idempotency', 't:realtime', 't:geospatial', 't:bloom-filters', 'c:swiggy', 'c:zomato']],
    ['Architecture', 'Services, events, feeds and operations. Then three classic designs.', ['t:microservices', 't:news-feeds', 't:event-driven', 't:observability', 't:security', 'c:whatsapp', 'c:uber', 'c:instagram']],
    ['Big systems + mock interview', 'The hardest case studies, then practise under a clock.', ['c:netflix', 'c:hotstar', 'c:irctc', 'c:upi', 'p:interview', 'p:quiz']],
  ];
  const PNAMES = { scale: ['1 → 1B users story', 10], estimate: ['Estimator practice', 15], interview: ['Timed mock interview', 45], quiz: ['Quiz arena: score 8/10+', 10] };
  function planItem(ref) {
    const [kind, id] = ref.split(':');
    if (kind === 't') { const t = BP.TOPICS.find((x) => x.id === id); return { href: '#t-' + id, label: t.title, mins: t.mins, done: BP.isDone(id), tag: 'L' + t.level }; }
    if (kind === 'c') { const c = BP.CASES.find((x) => x.id === id); return { href: '#c-' + id, label: 'Case: ' + c.name, mins: 25, done: BP.isDone('c-' + id), tag: 'case' }; }
    const [label, mins] = PNAMES[id];
    const done = !!BP.store.get('plan:' + id, false);
    return { href: '#' + id, label, mins, done, tag: 'practice', manual: id };
  }
  pages.plan = function (page) {
    page.append(h('div', { class: 'eyebrow' }, 'Study plan'), h('h1', null, 'System design in 7 days'),
      h('p', { class: 'lead' }, 'About 1–2 focused hours a day, more if you replay the simulations. Topics tick themselves when you mark them complete. Don’t rush the simulations: predicting what happens before you click is where the learning sticks.'));
    const wrap = h('div', { class: 'days' });
    DAYS.forEach(([title, blurb, refs], i) => {
      const items = refs.map(planItem);
      const mins = items.reduce((a, x) => a + x.mins, 0);
      const nd = items.filter((x) => x.done).length;
      const list = h('div', { class: 'day-items' });
      items.forEach((it) => {
        const tick = h('span', { class: 'tick' + (it.done ? ' on' : '') });
        const row = h('a', { class: 'day-item' + (it.done ? ' done' : ''), href: it.href }, tick, h('span', null, it.label), h('span', { class: 'mini' + (it.tag === 'case' ? ' amber' : '') }, it.tag + ' · ' + it.mins + 'm'));
        if (it.manual) {
          tick.setAttribute('role', 'checkbox'); tick.setAttribute('aria-checked', String(it.done)); tick.setAttribute('tabindex', '0'); tick.setAttribute('aria-label', 'Mark ' + it.label + ' done');
          const toggle = (e) => { e.preventDefault(); e.stopPropagation(); const nv = !BP.store.get('plan:' + it.manual, false); BP.store.set('plan:' + it.manual, nv); tick.classList.toggle('on', nv); row.classList.toggle('done', nv); tick.setAttribute('aria-checked', String(nv)); };
          tick.addEventListener('click', toggle);
          tick.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') toggle(e); });
        }
        list.append(row);
      });
      wrap.append(h('div', { class: 'day' },
        h('div', { class: 'day-num' }, h('span', null, 'Day'), h('b', null, i + 1), h('span', null, `${nd}/${items.length} done`), h('span', null, `~${mins} min`)),
        h('div', { class: 'day-body' }, h('h3', null, title), h('p', null, blurb), list)));
    });
    page.append(wrap);
    page.append(h('div', { class: 'callout' }, h('span', { class: 'ico' }, 'Habit'), h('div', null, h('b', { class: 't' }, 'Each evening, 10 minutes'), h('p', null, 'Close the site and explain one thing you learned out loud, as if to a friend, with a quick sketch. If you get stuck, that is tomorrow’s first thing to revisit.'))));
    page.append(BP.foot());
  };

  /* ================= Quiz arena ================= */
  pages.quiz = function (page) {
    page.append(h('div', { class: 'eyebrow' }, 'Practice · self-test'), h('h1', null, 'Quiz arena'),
      h('p', { class: 'lead' }, 'Ten random questions. Answer, read why, and the score shows which topics to revisit.'));
    let level = 0;
    const scoreEl = h('div', { class: 'sim-stats', style: { borderTop: 0, border: '1px solid var(--line)', borderRadius: '12px', background: 'var(--paper)', margin: '18px 0' } });
    const body = h('div');
    const ctl = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' } },
      BP.ctl('Questions from', BP.seg([[0, 'All levels'], [1, 'L1'], [2, 'L2'], [3, 'L3'], [4, 'L4'], [5, 'L5']], 0, (v) => { level = v; deal(); })),
      BP.button('New set', () => deal(), 'primary'));
    page.append(ctl, scoreEl, body);
    function deal() {
      const pool = [];
      BP.TOPICS.filter((t) => !level || t.level === level).forEach((t) => (t.quiz || []).forEach((q) => pool.push(Object.assign({}, q, { topic: t }))));
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const set = pool.slice(0, 10);
      let answered = 0, right = 0;
      const missed = [];
      function paintScore() {
        scoreEl.innerHTML = '';
        const st = (l, v, c) => h('div', { class: 'stat' }, h('span', null, l), h('b', { class: c || '' }, v));
        scoreEl.append(st('Answered', `${answered}/${set.length}`), st('Correct', right, 'good'), st('Score', answered ? Math.round((right / answered) * 100) + '%' : '—', answered && right / answered >= 0.8 ? 'good' : answered ? 'warn' : ''));
      }
      set.forEach((q) => (q.onAnswer = (ok) => {
        answered++; if (ok) right++; else missed.push(q.topic);
        paintScore();
        if (answered === set.length) {
          const uniq = [...new Set(missed)];
          body.append(h('div', { class: 'callout ' + (right >= 8 ? 'tip' : '') }, h('span', { class: 'ico' }, 'Result'), h('div', null,
            h('b', { class: 't' }, right >= 8 ? `${right}/10. Strong.` : `${right}/10. Good start.`),
            uniq.length ? h('p', null, 'Revisit: ', uniq.map((t, i) => [i ? ', ' : '', h('a', { href: '#t-' + t.id }, t.title)])) : h('p', null, 'No misses. Try a case study next.'))));
        }
      }));
      body.innerHTML = '';
      body.append(BP.quiz(set));
      paintScore();
    }
    deal();
    page.append(BP.foot());
  };

  /* ================= Interview framework ================= */
  const STEPS = [
    [0, 5, 'Clarify requirements', ['List 3–5 core features. Say what is out of scope.', 'Ask about scale: users, regions, read/write mix.', 'Non-functional: latency, availability, consistency needs.']],
    [5, 10, 'Estimate', ['QPS (average and peak), storage, bandwidth.', 'Say what the numbers imply: “read-heavy, so cache”.']],
    [10, 15, 'API and data model', ['3–5 endpoints with method, path, key fields.', 'Main entities and keys. Pick a database and say why.']],
    [15, 25, 'High-level design', ['Draw clients, gateway/LB, services, data stores, cache, queue.', 'Walk one request end to end through the boxes.']],
    [25, 40, 'Deep dives', ['Find the bottleneck and scale it (cache, shard, queue).', 'Failure cases: a node dies, a dependency is slow, a retry duplicates.', 'Name trade-offs out loud.']],
    [40, 45, 'Wrap up', ['Summarize the design in 30 seconds.', 'Monitoring: 2–3 key metrics and an SLO.', 'What you would improve with more time.']],
  ];
  const PROMPTS = [
    ['Design a URL shortener', 'url-shortener', ['Reads are ~100× writes. What does that suggest?', 'How do you generate unique 7-character codes without collisions?', '301 vs 302: which keeps analytics?']],
    ['Design Swiggy order tracking', 'swiggy', ['How often do partners send location? Compute the write rate.', 'How does the customer’s app receive updates without polling?', 'What happens to an order if payment succeeds but the restaurant rejects it?']],
    ['Design WhatsApp', 'whatsapp', ['How does a message find the server holding the receiver’s connection?', 'What changes when the receiver is offline?', 'How do you avoid duplicates when the sender retries?']],
    ['Design Uber ride matching', 'uber', ['How would you find drivers within 2 km quickly?', 'How do you stop two drivers accepting one trip?', 'Where does surge pricing get its data?']],
    ['Design IRCTC Tatkal booking', 'irctc', ['Where is the contention? Name the hot row.', 'How do you keep the backend alive at 10:00:00?', 'What if payment times out after seats are held?']],
    ['Design Instagram’s feed', 'instagram', ['Push or pull fan-out? What about a celebrity post?', 'How are images uploaded and served?', 'How do feed cursors work?']],
    ['Design Netflix', 'netflix', ['Why can’t video come from your API servers?', 'How does quality adapt to a slow connection?', 'What should the home screen do if recommendations are down?']],
    ['Design Hotstar for an IPL final', 'hotstar', ['Why is autoscaling alone not enough?', 'Which features would you turn off under load?', 'How do you count concurrent viewers cheaply?']],
    ['Design UPI-style payments', 'upi', ['How do you guarantee no double debit on retries?', 'The bank doesn’t reply in time. Success or failure?', 'Why an append-only ledger?']],
    ['Design a rate limiter', null, ['Which algorithm allows small bursts?', 'Where do counters live with 20 gateway servers?', 'If Redis is down, fail open or closed?']],
    ['Design a notification system', null, ['Push, SMS and email have different providers. How do you abstract them?', 'How do you avoid sending the same notification twice?', 'How do you respect user preferences and quiet hours?']],
    ['Design search autocomplete', null, ['What data structure gives prefix lookups fast?', 'How do you rank suggestions?', 'How often do you rebuild, and how do you serve while rebuilding?']],
    ['Design a Dream11-style leaderboard', null, ['Millions of score updates during a match. Where do you keep ranks?', 'Redis sorted sets: how do they help?', 'How do you show “your rank” among 10M users fast?']],
    ['Design Google Docs-style collaboration', null, ['How do two people’s edits to the same line merge?', 'What do OT and CRDTs do?', 'How do cursors of other users appear live?']],
  ];
  pages.interview = function (page) {
    page.append(h('div', { class: 'eyebrow' }, 'Practice · 45 minutes'), h('h1', null, 'Mock interview'),
      h('p', { class: 'lead' }, 'Pick a prompt, start the clock, and talk out loud while you sketch on paper. The current step lights up as time passes. Reveal hints only when you are stuck.'));
    let pi = Math.floor(Math.random() * PROMPTS.length), left = 45 * 60, running = false, shown = 0;
    const timer = h('div', { class: 'timer', role: 'timer', 'aria-live': 'off' });
    const startB = BP.button('Start', () => { running = !running; startB.textContent = running ? 'Pause' : 'Resume'; }, 'primary');
    const resetB = BP.button('Reset', () => { running = false; left = 45 * 60; startB.textContent = 'Start'; paint(); });
    const card = h('div', { class: 'prompt-card' });
    const steps = h('div', { class: 'iv-steps' });
    function paintPrompt() {
      const [title, cid, hints] = PROMPTS[pi];
      card.innerHTML = '';
      const hintList = h('ol', { style: { margin: '8px 0 0', paddingLeft: '1.2em', color: 'var(--ink-2)' } }, hints.slice(0, shown).map((x) => h('li', null, x)));
      card.append(h('div', { class: 'eyebrow' }, 'Your prompt'), h('h3', null, title),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' } },
          BP.button('Another prompt', () => { pi = (pi + 1 + Math.floor(Math.random() * (PROMPTS.length - 1))) % PROMPTS.length; shown = 0; paintPrompt(); }),
          BP.button(shown < hints.length ? `Reveal hint ${shown + 1}/${hints.length}` : 'All hints shown', () => { if (shown < hints.length) { shown++; paintPrompt(); } }),
          cid ? h('a', { class: 'btn small ghost', href: '#c-' + cid }, 'Compare with case study →') : null),
        hintList);
    }
    function paint() {
      const m = Math.floor(left / 60), sec = left % 60;
      timer.textContent = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      timer.style.color = left < 300 ? 'var(--bad)' : '';
      const el = 45 - left / 60;
      steps.innerHTML = '';
      STEPS.forEach(([a, b, t, pts]) => steps.append(h('div', { class: 'iv-step' + (el >= a && el < b && (running || left < 2700) ? ' cur' : '') },
        h('span', { class: 't' }, `${a}–${b} min`), h('div', null, h('h4', null, t), h('ul', null, pts.map((p) => h('li', null, p)))))));
    }
    BP.every(1000, () => { if (running && left > 0) { left--; paint(); if (left === 0) { running = false; startB.textContent = 'Start'; BP.toast('Time. Summarize your design.'); } } }, true);
    page.append(card, h('div', { style: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', margin: '22px 0 14px' } }, timer, startB, resetB), steps);
    page.append(h('h2', null, 'What strong candidates do'), h('ol', { class: 'takeaways' },
      ['Ask questions before drawing anything, and write the answers down.', 'Use numbers to make decisions, not as decoration.', 'Start simple, then evolve the design where the numbers say it breaks.', 'Say trade-offs out loud: “I pick X over Y because…”.', 'Drive the conversation. Propose the next deep dive yourself.'].map((x) => h('li', null, x))));
    paintPrompt(); paint();
    page.append(BP.foot());
  };
})();
