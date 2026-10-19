/* Router, sidebar, home, roadmap, topic pages, search, progress. */
(function () {
  const BP = window.BP;
  const { h, s } = BP;
  const page = document.getElementById('page');
  const side = document.getElementById('side');

  /* ---------- Progress ---------- */
  let done = BP.store.get('done', {});
  BP.isDone = (id) => !!done[id];
  BP.setDone = (id, v) => {
    if (v) done[id] = true; else delete done[id];
    BP.store.set('done', done);
    renderSide();
    renderTopProgress();
  };
  const allItems = () => BP.TOPICS.map((t) => t.id).concat(BP.CASES.map((c) => 'c-' + c.id));
  function renderTopProgress() {
    const items = allItems();
    const n = items.filter((i) => done[i]).length;
    const pct = Math.round((n / items.length) * 100);
    const el = document.getElementById('topProgress');
    el.innerHTML = '';
    el.append(h('span', null, `${n}/${items.length} done`), h('span', { class: 'bar' }, h('i', { style: { width: pct + '%' } })));
  }

  /* ---------- Theme ---------- */
  const themeBtn = document.getElementById('themeBtn');
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  applyTheme(BP.store.get('theme', null));
  themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    BP.store.set('theme', next);
  });

  /* ---------- Sidebar ---------- */
  const brandMark = () => {
    const m = s('svg', { viewBox: '0 0 34 34', class: 'brand-mark', 'aria-hidden': 'true' });
    m.append(
      s('rect', { x: 1, y: 1, width: 32, height: 32, rx: 8, class: 'fill-accent' }),
      s('circle', { cx: 9, cy: 17, r: 3.2, class: 'fill-paper' }),
      s('circle', { cx: 25, cy: 9, r: 3.2, class: 'fill-paper' }),
      s('circle', { cx: 25, cy: 25, r: 3.2, class: 'fill-paper' }),
      s('path', { d: 'M12 17 L22 10 M12 17 L22 24', stroke: 'var(--accent-ink)', 'stroke-width': 2, fill: 'none' })
    );
    return m;
  };
  function navLink(href, label, opts = {}) {
    const cur = location.hash || '#home';
    const cls = ['nav-link', cur === href ? 'active' : '', opts.done ? 'done' : ''].join(' ');
    return h('a', { class: cls, href }, opts.glyph ? h('span', { class: 'glyph' }, opts.glyph) : h('span', { class: 'tick' }), h('span', null, label));
  }
  function renderSide() {
    side.innerHTML = '';
    side.append(h('a', { class: 'brand', href: '#home' }, brandMark(), h('span', null, h('b', null, 'Scale Blueprint'), h('small', null, 'System design, drawn live'))));
    const g0 = h('div', { class: 'nav-group' },
      navLink('#home', 'Home', { glyph: '⌂' }),
      navLink('#scale', 'Start here: 1 → 1B users', { glyph: '▶' }),
      navLink('#path', 'Full roadmap', { glyph: '≡' }),
      navLink('#plan', '7-day study plan', { glyph: '7' }));
    side.append(g0);
    BP.LEVELS.forEach((L) => {
      const ts = BP.TOPICS.filter((t) => t.level === L.n);
      const n = ts.filter((t) => done[t.id]).length;
      const grp = h('div', { class: 'nav-group' },
        h('div', { class: 'nav-head' }, h('i', { class: 'lv', style: { background: BP.levelColor(L.n) } }), `L${L.n} · ${L.title}`, h('span', { class: 'count' }, `${n}/${ts.length}`)));
      ts.forEach((t) => grp.append(navLink('#t-' + t.id, t.title, { done: done[t.id] })));
      side.append(grp);
    });
    const cg = h('div', { class: 'nav-group' }, h('div', { class: 'nav-head' }, 'Case studies', h('span', { class: 'count' }, `${BP.CASES.filter((c) => done['c-' + c.id]).length}/${BP.CASES.length}`)));
    cg.append(navLink('#cases', 'All case studies', { glyph: '◆' }));
    BP.CASES.forEach((c) => cg.append(navLink('#c-' + c.id, c.name, { done: done['c-' + c.id] })));
    side.append(cg);
    side.append(h('div', { class: 'nav-group' }, h('div', { class: 'nav-head' }, 'Practice'),
      navLink('#interview', 'Interview framework', { glyph: '◷' }),
      navLink('#estimate', 'Back-of-envelope calculator', { glyph: '∑' }),
      navLink('#quiz', 'Quiz arena', { glyph: '?' })));
  }

  /* ---------- Small shared pieces ---------- */
  BP.ring = function (pct, color) {
    const r = 19, c = 2 * Math.PI * r;
    return s('svg', { viewBox: '0 0 46 46', class: 'ring', 'aria-label': pct + '% complete' },
      s('circle', { cx: 23, cy: 23, r, fill: 'none', 'stroke-width': 4, class: 'bgc' }),
      s('circle', { cx: 23, cy: 23, r, fill: 'none', 'stroke-width': 4, class: 'fgc', stroke: color, 'stroke-linecap': 'round',
        'stroke-dasharray': c, 'stroke-dashoffset': c * (1 - pct / 100), transform: 'rotate(-90 23 23)' }),
      s('text', { x: 23, y: 27, 'text-anchor': 'middle', text: pct + '%' }));
  };
  BP.quiz = function (qs) {
    const wrap = h('div', { class: 'quiz' });
    qs.forEach((q, qi) => {
      const box = h('div', { class: 'q' }, h('p', { class: 'q-text' }, `${qi + 1}. ${q.q}`));
      const opts = h('div', { class: 'q-opts' });
      const btns = q.o.map((o, i) => {
        const b = h('button', { class: 'q-opt', type: 'button' }, h('span', { class: 'k' }, 'ABCD'[i]), h('span', null, o));
        b.addEventListener('click', () => {
          btns.forEach((x, j) => { x.disabled = true; if (j === q.a) x.classList.add('right'); });
          if (i !== q.a) b.classList.add('wrong');
          box.append(h('p', { class: 'q-why' }, (i === q.a ? 'Correct. ' : 'Not quite. ') + q.why));
          if (q.onAnswer) q.onAnswer(i === q.a);
        });
        opts.append(b);
        return b;
      });
      box.append(opts);
      wrap.append(box);
    });
    return wrap;
  };
  BP.foot = () => h('footer', { class: 'foot' },
    h('span', null, 'Scale Blueprint · built for people starting out in system design'),
    h('span', null, 'Numbers in case studies are rounded, public or illustrative. Use them to reason, not to quote.'));

  /* ---------- Home ---------- */
  function heroArt() {
    const svg = s('svg', { viewBox: '0 0 520 330', role: 'img', 'aria-label': 'Requests flowing from users through a load balancer to servers, cache and database' });
    const wires = s('g'); const nodes = s('g'); const pk = s('g');
    svg.append(wires, pk, nodes);
    const users = [[40, 70], [40, 165], [40, 260]];
    const lb = [160, 165];
    const apps = [[290, 75], [290, 165], [290, 255]];
    const cache = [440, 105], db = [440, 235];
    users.forEach((u) => BP.line(wires, u, lb, 'dash'));
    apps.forEach((a) => { BP.line(wires, lb, a); BP.line(wires, a, cache); BP.line(wires, a, db); });
    users.forEach((u, i) => {
      nodes.append(s('circle', { cx: u[0], cy: u[1], r: 18, class: 'n-box' }));
      nodes.append(s('text', { x: u[0], y: u[1] + 4, 'text-anchor': 'middle', class: 'n-tag', text: ['APP', 'WEB', 'APP'][i] }));
    });
    BP.node(nodes, { x: lb[0], y: lb[1], w: 96, h: 46, label: 'Load bal.', tag: 'LB' });
    const appNodes = apps.map((a, i) => BP.node(nodes, { x: a[0], y: a[1], w: 104, h: 46, label: `api-${i + 1}`, tag: 'SERVICE' }));
    const cN = BP.node(nodes, { x: cache[0], y: cache[1], w: 104, h: 46, label: 'Redis', tag: 'CACHE' });
    BP.node(nodes, { x: db[0], y: db[1], w: 104, h: 46, label: 'Postgres', tag: 'DATABASE' });
    const P = BP.packetLayer(pk);
    let served = 0, hits = 0;
    const cap = h('div', { class: 'cap' }, h('span', null, 'live traffic'), h('span', null, '0 requests · 0% cache hits'));
    async function one() {
      const u = BP.pick(users), ai = Math.floor(Math.random() * 3), a = apps[ai];
      await P.send([u, lb], { dur: 0.45, cls: 'blue', r: 4 });
      appNodes[ai].setCls('hot');
      await P.send([lb, a], { dur: 0.35, cls: 'blue', r: 4 });
      const hit = Math.random() < 0.72;
      if (hit) { await P.send([a, cache], { dur: 0.25, r: 4 }); await P.send([cache, a], { dur: 0.25, cls: 'ok', r: 4 }); hits++; }
      else { await P.send([a, db], { dur: 0.45, r: 4 }); await P.send([db, a], { dur: 0.45, cls: 'ok', r: 4 }); }
      appNodes[ai].setCls('');
      await P.send([a, lb, u], { dur: 0.6, cls: 'ok', r: 4 });
      served++;
      cap.lastChild.textContent = `${served} requests · ${Math.round((hits / served) * 100)}% cache hits`;
    }
    BP.every(BP.reduced ? 2000 : 520, one);
    one();
    return h('div', { class: 'hero-art' }, svg, cap);
  }

  function home() {
    const items = allItems();
    const nDone = items.filter((i) => done[i]).length;
    const next = BP.TOPICS.find((t) => !done[t.id]);
    page.append(
      h('section', { class: 'hero' },
        h('div', null,
          h('div', { class: 'eyebrow' }, 'Beginner → Advanced', h('i', { class: 'dotsep' }), `${BP.TOPICS.length} topics`, h('i', { class: 'dotsep' }), `${BP.CASES.length} case studies`),
          h('h1', null, 'Learn system design by ', h('em', null, 'watching it run'), '.'),
          h('p', { class: 'lead' }, 'Every concept here has a live simulation you can poke. Kill a server. Overflow a queue. Split a network in two. Then see how Swiggy, Uber, Netflix and IRCTC put the same pieces together.'),
          h('div', { class: 'hero-actions' },
            h('a', { class: 'btn primary', href: next ? '#t-' + next.id : '#cases' }, nDone ? `Continue: ${next ? next.title : 'case studies'}` : 'Start lesson 1'),
            h('a', { class: 'btn', href: '#scale' }, 'Watch 1 user grow to 1B'),
            h('a', { class: 'btn ghost', href: '#plan' }, '7-day plan'))),
        heroArt()));

    page.append(h('div', { class: 'section-head' }, h('div', null, h('div', { class: 'eyebrow' }, 'The path'), h('h2', null, 'Five levels, in order')), h('a', { class: 'btn small', href: '#path' }, 'See full roadmap')));
    const lv = h('div', { class: 'levels' });
    BP.LEVELS.forEach((L) => {
      const ts = BP.TOPICS.filter((t) => t.level === L.n);
      const pct = Math.round((ts.filter((t) => done[t.id]).length / ts.length) * 100);
      lv.append(h('a', { class: 'level-row', href: '#t-' + ts[0].id },
        h('span', { class: 'level-num', style: { color: BP.levelColor(L.n) } }, 'L' + L.n),
        h('div', null, h('h3', null, L.title), h('p', null, L.blurb + ' · ' + ts.length + ' topics')),
        BP.ring(pct, BP.levelColor(L.n))));
    });
    page.append(lv);

    page.append(h('div', { class: 'section-head' }, h('div', null, h('div', { class: 'eyebrow' }, 'Apply it'), h('h2', null, 'Case studies from apps you use')), h('a', { class: 'btn small', href: '#cases' }, 'All case studies')));
    page.append(caseGrid(BP.CASES.slice(0, 8)));

    page.append(h('div', { class: 'section-head' }, h('div', null, h('div', { class: 'eyebrow' }, 'Practice'), h('h2', null, 'Tools for interview prep'))));
    page.append(h('div', { class: 'tool-grid' },
      toolCard('#scale', 'Interactive story', '1 user → 1B users', 'Drag one slider and watch the architecture grow, with what broke at each step.'),
      toolCard('#estimate', 'Calculator', 'Back-of-envelope math', 'Turn daily users into QPS, storage and bandwidth. Presets for real apps.'),
      toolCard('#interview', 'Framework + timer', 'Mock interview', 'A 45-minute structure with a running clock and random prompts.'),
      toolCard('#quiz', 'Self-test', 'Quiz arena', '10 random questions from every level. Find your weak spots.')));
    page.append(BP.foot());
  }
  function toolCard(href, k, b, sp) { return h('a', { class: 'tool-card', href }, h('span', { class: 'k' }, k), h('b', null, b), h('span', null, sp)); }
  function caseGrid(list) {
    const g = h('div', { class: 'grid-cards' });
    list.forEach((c) => g.append(h('a', { class: 'case-card', href: '#c-' + c.id },
      h('div', { class: 'mono-badge', style: { background: c.color } }, c.letter),
      h('h3', null, c.name),
      h('p', null, c.tagline),
      h('div', { class: 'meta' }, h('span', null, c.levelLabel), done['c-' + c.id] ? h('span', { class: 'done-mark' }, '✓ done') : h('span', null, c.focus)))));
    return g;
  }
  BP.caseGrid = caseGrid;

  /* ---------- Roadmap ---------- */
  function roadmap() {
    page.append(h('div', { class: 'eyebrow' }, 'Roadmap'), h('h1', null, 'From zero to designing Uber'),
      h('p', { class: 'lead' }, 'Go top to bottom. Each level uses the one before it. Tiles marked SIM have a live simulation. Finish a level, then try the case studies that use it.'));
    const road = h('div', { class: 'road' });
    BP.LEVELS.forEach((L, i) => {
      const ts = BP.TOPICS.filter((t) => t.level === L.n);
      const list = h('div', { class: 'topic-list' });
      ts.forEach((t) => list.append(h('a', { class: 'topic-tile' + (done[t.id] ? ' done' : ''), href: '#t-' + t.id },
        h('span', { class: 'tick' }), h('b', null, t.title), h('small', null, t.short),
        h('span', { class: 'tags' }, t.sim ? h('span', { class: 'mini' }, 'sim') : null, h('span', { class: 'mini amber' }, t.mins + ' min')))));
      const cases = BP.CASES.filter((c) => c.after === L.n);
      road.append(h('div', { class: 'road-level' },
        h('div', { class: 'road-rail' }, h('span', { class: 'num', style: { background: BP.levelColor(L.n) } }, L.n), i < BP.LEVELS.length - 1 ? h('span', { class: 'line' }) : null),
        h('div', null, h('div', { class: 'eyebrow' }, 'Level ' + L.n), h('h2', null, L.title), h('p', { class: 'muted', style: { margin: 0 } }, L.blurb), list,
          cases.length ? h('div', { class: 'chips', style: { marginTop: '12px' } }, h('span', { class: 'muted', style: { fontSize: '14px' } }, 'Ready for:'), cases.map((c) => h('a', { class: 'chip', href: '#c-' + c.id }, c.name))) : null)));
    });
    page.append(road, BP.foot());
  }

  /* ---------- Topic ---------- */
  function topic(id) {
    const i = BP.TOPICS.findIndex((t) => t.id === id);
    const t = BP.TOPICS[i];
    if (!t) return notFound();
    const L = BP.LEVELS.find((l) => l.n === t.level);
    page.append(h('div', { class: 'topic-head' },
      h('div', { class: 'eyebrow' }, h('span', { style: { color: BP.levelColor(L.n) } }, `Level ${L.n} · ${L.title}`), h('i', { class: 'dotsep' }), `${t.mins} min`, t.sim ? [h('i', { class: 'dotsep' }), 'Live sim'] : null),
      h('h1', null, t.title),
      h('p', { class: 'lead' }, t.tldr)));
    if (t.analogy) page.append(h('div', { class: 'callout' }, h('span', { class: 'ico' }, 'Analogy'), h('div', null, h('b', { class: 't' }, 'Think of it like this'), h('p', { html: t.analogy }))));
    if (t.sim && BP.sims[t.sim]) {
      page.append(h('h2', null, 'Play with it'));
      if (t.simIntro) page.append(h('p', { class: 'prose', html: t.simIntro }));
      BP.sims[t.sim](page);
    }
    if (t.body) page.append(h('div', { class: 'prose', html: t.body }));
    if (t.pros) page.append(h('h2', null, 'Trade-offs'), h('div', { class: 'tradeoff' },
      h('div', { class: 'pro' }, h('h4', null, t.prosLabel || 'Good at'), h('ul', null, t.pros.map((p) => h('li', { html: p })))),
      h('div', { class: 'con' }, h('h4', null, t.consLabel || 'Costs you'), h('ul', null, t.cons.map((p) => h('li', { html: p }))))));
    if (t.takeaways) page.append(h('h2', null, 'Remember this'), h('ol', { class: 'takeaways' }, t.takeaways.map((k) => h('li', { html: k }))));
    if (t.seen && t.seen.length) page.append(h('h2', null, 'Where you see it'), h('div', { class: 'chips' }, t.seen.map((cid) => {
      const c = BP.CASES.find((x) => x.id === cid);
      return c ? h('a', { class: 'chip', href: '#c-' + c.id }, c.name) : null;
    })));
    if (t.tip) page.append(h('div', { class: 'callout tip' }, h('span', { class: 'ico' }, 'Interview'), h('div', null, h('b', { class: 't' }, 'What interviewers listen for'), h('p', { html: t.tip }))));
    if (t.quiz) page.append(h('h2', null, 'Check yourself'), BP.quiz(t.quiz));
    const btn = h('button', { class: 'btn ' + (done[t.id] ? '' : 'primary'), type: 'button' }, done[t.id] ? '✓ Completed · undo' : 'Mark as complete');
    btn.addEventListener('click', () => {
      BP.setDone(t.id, !done[t.id]);
      btn.className = 'btn ' + (done[t.id] ? '' : 'primary');
      btn.textContent = done[t.id] ? '✓ Completed · undo' : 'Mark as complete';
      if (done[t.id]) BP.toast('Marked complete');
    });
    page.append(h('div', { class: 'done-bar' }, h('span', { class: 'muted' }, 'Done reading and playing?'), btn));
    const prev = BP.TOPICS[i - 1], next = BP.TOPICS[i + 1];
    page.append(h('nav', { class: 'pn' },
      prev ? h('a', { href: '#t-' + prev.id }, h('small', null, '← Previous'), h('b', null, prev.title)) : h('span'),
      next ? h('a', { class: 'next', href: '#t-' + next.id }, h('small', null, 'Next →'), h('b', null, next.title)) :
        h('a', { class: 'next', href: '#cases' }, h('small', null, 'Next →'), h('b', null, 'Case studies'))));
    page.append(BP.foot());
  }

  function casesPage() {
    page.append(h('div', { class: 'eyebrow' }, 'Case studies'), h('h1', null, 'How real apps are built'),
      h('p', { class: 'lead' }, 'Each one follows the interview flow: requirements, estimates, an architecture you can click, request flows you can play step by step, then deep dives. Start with the URL shortener.'));
    page.append(caseGrid(BP.CASES), BP.foot());
  }

  function notFound() {
    page.append(h('h1', null, 'Page not found'), h('p', null, h('a', { href: '#home' }, 'Go home')));
  }

  /* ---------- Search palette ---------- */
  const pal = document.getElementById('palette');
  const palInput = document.getElementById('paletteInput');
  const palList = document.getElementById('paletteList');
  let palSel = 0, palResults = [];
  function searchIndex() {
    const idx = [];
    BP.TOPICS.forEach((t) => idx.push({ href: '#t-' + t.id, title: t.title, kind: 'L' + t.level + ' topic', text: (t.title + ' ' + t.short + ' ' + (t.keywords || '')).toLowerCase() }));
    BP.CASES.forEach((c) => idx.push({ href: '#c-' + c.id, title: c.name + ' — ' + c.focus, kind: 'case study', text: (c.name + ' ' + c.tagline + ' ' + c.focus).toLowerCase() }));
    [['#scale', '1 user → 1B users story', 'scaling story evolution'], ['#estimate', 'Back-of-envelope calculator', 'qps storage bandwidth estimate'],
      ['#interview', 'Interview framework & timer', 'mock interview steps'], ['#quiz', 'Quiz arena', 'test questions'], ['#plan', '7-day study plan', 'week schedule'], ['#path', 'Full roadmap', 'levels']]
      .forEach(([href, title, kw]) => idx.push({ href, title, kind: 'tool', text: (title + ' ' + kw).toLowerCase() }));
    return idx;
  }
  function renderPal() {
    const q = palInput.value.trim().toLowerCase();
    const idx = searchIndex();
    palResults = q ? idx.filter((i) => q.split(/\s+/).every((w) => i.text.includes(w))) : idx.slice(0, 12);
    palSel = Math.min(palSel, Math.max(0, palResults.length - 1));
    palList.innerHTML = '';
    if (!palResults.length) palList.append(h('div', { class: 'pal-empty' }, 'Nothing matches. Try "cache", "queue" or "Uber".'));
    palResults.forEach((r, i) => palList.append(h('a', { class: 'pal-item' + (i === palSel ? ' sel' : ''), href: r.href, onclick: closePal }, h('span', null, r.title), h('small', null, r.kind))));
  }
  function openPal() { pal.hidden = false; palInput.value = ''; palSel = 0; renderPal(); palInput.focus(); }
  function closePal() { pal.hidden = true; }
  document.getElementById('searchBtn').addEventListener('click', openPal);
  pal.addEventListener('click', (e) => { if (e.target === pal) closePal(); });
  palInput.addEventListener('input', () => { palSel = 0; renderPal(); });
  palInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { palSel = Math.min(palResults.length - 1, palSel + 1); renderPal(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { palSel = Math.max(0, palSel - 1); renderPal(); e.preventDefault(); }
    else if (e.key === 'Enter' && palResults[palSel]) { location.hash = palResults[palSel].href; closePal(); }
    else if (e.key === 'Escape') closePal();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? openPal() : closePal(); }
    else if (e.key === '/' && pal.hidden && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openPal(); }
  });

  /* ---------- Mobile nav ---------- */
  document.getElementById('menuBtn').addEventListener('click', () => document.body.classList.add('nav-open'));
  document.getElementById('scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));

  /* ---------- Router ---------- */
  function route() {
    BP.disposeAll();
    document.body.classList.remove('nav-open');
    page.innerHTML = '';
    const r = (location.hash || '#home').slice(1);
    let title = 'Scale Blueprint';
    try {
      if (r === 'home' || r === '') home();
      else if (r === 'path') { roadmap(); title = 'Roadmap · ' + title; }
      else if (r === 'cases') { casesPage(); title = 'Case studies · ' + title; }
      else if (r.startsWith('t-')) { topic(r.slice(2)); const t = BP.TOPICS.find((x) => x.id === r.slice(2)); if (t) title = t.title + ' · ' + title; }
      else if (r.startsWith('c-')) {
        const c = BP.CASES.find((x) => x.id === r.slice(2));
        if (c) { BP.renderCase(page, c); title = c.name + ' · ' + title; } else notFound();
      }
      else if (BP.pages[r]) BP.pages[r](page);
      else notFound();
    } catch (err) {
      console.error(err);
      page.append(h('div', { class: 'callout warn' }, h('span', { class: 'ico' }, 'Error'), h('p', null, 'This page failed to draw: ' + err.message)));
    }
    document.title = title;
    renderSide();
    const active = side.querySelector('.nav-link.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  renderTopProgress();
  route();
})();
