/* Shared helpers: DOM builders, storage, animation loops, packet animator, sim frame. */
(function () {
  const BP = (window.BP = window.BP || {});

  // Things a page started (loops, timers) that must stop when the page changes.
  BP._disposers = [];
  BP.onDispose = (f) => BP._disposers.push(f);
  BP.disposeAll = () => {
    BP._disposers.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
    BP._disposers = [];
  };

  BP.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    kids.flat(Infinity).forEach((c) => {
      if (c == null || c === false) return;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return el;
  };

  const NS = 'http://www.w3.org/2000/svg';
  BP.s = function (tag, attrs, ...kids) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
    kids.flat(Infinity).forEach((c) => c && el.appendChild(c));
    return el;
  };

  BP.store = {
    get(k, d) {
      try { const v = localStorage.getItem('bp:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem('bp:' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    },
  };

  BP.reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  BP.raf = function (fn) {
    let id, last = performance.now(), alive = true;
    const tick = (t) => {
      if (!alive) return;
      const dt = BP.clamp((t - last) / 1000, 0, 0.05);
      last = t;
      try { fn(dt, t); } catch (e) { console.error(e); }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    const stop = () => { alive = false; cancelAnimationFrame(id); };
    BP.onDispose(stop);
    return stop;
  };
  // Skips ticks while the tab is hidden, so animations don't pile up and burst on return.
  BP.every = (ms, fn, always) => {
    const id = setInterval(() => { if (always || !document.hidden) fn(); }, ms);
    BP.onDispose(() => clearInterval(id));
    return id;
  };
  BP.after = (ms, fn) => { const id = setTimeout(fn, ms); BP.onDispose(() => clearTimeout(id)); return id; };
  BP.wait = (ms) => new Promise((r) => BP.after(ms, r));

  BP.rand = (a, b) => a + Math.random() * (b - a);
  BP.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  BP.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  BP.fmtNum = function (n, digits = 1) {
    if (!isFinite(n)) return '—';
    const a = Math.abs(n);
    const f = (x, s) => (Math.round(x * 10 ** digits) / 10 ** digits).toLocaleString('en-US') + s;
    if (a >= 1e12) return f(n / 1e12, 'T');
    if (a >= 1e9) return f(n / 1e9, 'B');
    if (a >= 1e6) return f(n / 1e6, 'M');
    if (a >= 1e3) return f(n / 1e3, 'K');
    return f(n, '');
  };
  BP.fmtBytes = function (b) {
    const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    let i = 0;
    while (Math.abs(b) >= 1000 && i < u.length - 1) { b /= 1000; i++; }
    return (b >= 100 ? Math.round(b) : Math.round(b * 10) / 10) + ' ' + u[i];
  };

  /* Packets: small dots that travel along a path of points inside an SVG group. */
  BP.packetLayer = function (g) {
    const list = [];
    BP.raf((dt) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.t += dt / p.dur;
        const t = Math.min(1, p.t);
        const segs = p.pts.length - 1;
        const pos = t * segs;
        const si = Math.min(segs - 1, Math.floor(pos));
        const lt = pos - si;
        const a = p.pts[si], b = p.pts[si + 1];
        p.el.setAttribute('cx', a[0] + (b[0] - a[0]) * lt);
        p.el.setAttribute('cy', a[1] + (b[1] - a[1]) * lt);
        if (t >= 1) {
          p.el.remove();
          list.splice(i, 1);
          p.done();
        }
      }
    });
    return {
      send(pts, o = {}) {
        if (pts.length < 2 || !pts.every((p) => p && isFinite(p[0]) && isFinite(p[1]))) {
          console.warn('packet path skipped', JSON.stringify(pts), new Error().stack);
          return Promise.resolve();
        }
        return new Promise((done) => {
          const el = BP.s('circle', { r: o.r || 5, class: 'pkt ' + (o.cls || ''), cx: pts[0][0], cy: pts[0][1], style: o.color ? 'fill:' + o.color : null });
          g.appendChild(el);
          const dur = BP.reduced ? Math.min(0.25, o.dur || 0.8) : (o.dur || 0.8);
          list.push({ el, pts, t: 0, dur, done });
        });
      },
      clear() { list.forEach((p) => p.el.remove()); list.length = 0; },
      get count() { return list.length; },
    };
  };

  /* Standard frame for every live simulation. */
  BP.simFrame = function (host, { title, hint, viewBox, narrowOk }) {
    const svg = BP.s('svg', { viewBox, role: 'img', 'aria-label': title });
    const stage = BP.h('div', { class: 'sim-stage' + (narrowOk ? ' narrow-ok' : '') }, svg);
    const controls = BP.h('div', { class: 'sim-controls' });
    const stats = BP.h('div', { class: 'sim-stats' });
    const log = BP.h('div', { class: 'sim-log', 'aria-live': 'polite' });
    const root = BP.h('div', { class: 'sim' },
      BP.h('div', { class: 'sim-head' }, BP.h('i', { class: 'live' }), 'Live · ' + title, hint ? BP.h('span', { class: 'hint' }, hint) : null),
      stage, controls, stats, log);
    host.appendChild(root);
    const statEls = {};
    return {
      root, svg, stage, controls,
      layer(cls) { const g = BP.s('g', { class: cls || '' }); svg.appendChild(g); return g; },
      log(html) { log.innerHTML = html; },
      stat(key, label) {
        const b = BP.h('b', null, '0');
        stats.appendChild(BP.h('div', { class: 'stat' }, BP.h('span', null, label), b));
        statEls[key] = b;
        return b;
      },
      set(key, val, tone) {
        const b = statEls[key]; if (!b) return;
        b.textContent = val;
        b.className = tone || '';
      },
      add(...els) { els.forEach((e) => controls.appendChild(e)); },
    };
  };

  /* Controls */
  BP.button = (label, onclick, cls) => BP.h('button', { class: 'btn small ' + (cls || ''), type: 'button', onclick }, label);
  BP.seg = function (options, value, onchange) {
    const wrap = BP.h('div', { class: 'seg', role: 'group' });
    const btns = options.map(([val, label]) => {
      const b = BP.h('button', { type: 'button', class: val === value ? 'on' : '', 'aria-pressed': String(val === value) }, label);
      b.addEventListener('click', () => {
        btns.forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
        b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
        onchange(val);
      });
      wrap.appendChild(b);
      return b;
    });
    return wrap;
  };
  let sliderId = 0;
  BP.slider = function (label, { min, max, step = 1, value, fmt = (v) => v }, oninput) {
    const id = 'sl-' + (++sliderId);
    const out = BP.h('output', { for: id }, fmt(value));
    const input = BP.h('input', { type: 'range', id, min, max, step, value });
    input.addEventListener('input', () => { const v = +input.value; out.textContent = fmt(v); oninput(v); });
    return BP.h('label', { class: 'ctl', for: id }, BP.h('span', { class: 'ctl-row' }, label, out), input);
  };
  BP.ctl = (label, el) => BP.h('div', { class: 'ctl' }, BP.h('span', null, label), el);

  /* SVG node: a labelled box with a small type tag. */
  BP.node = function (parent, { x, y, w = 120, h = 50, label, tag, sub, cls }) {
    const g = BP.s('g', { transform: `translate(${x - w / 2},${y - h / 2})` });
    const rect = BP.s('rect', { width: w, height: h, rx: 9, class: 'n-box ' + (cls || '') });
    g.appendChild(rect);
    if (tag) g.appendChild(BP.s('text', { x: 10, y: 14, class: 'n-tag', text: tag }));
    const ly = tag ? (sub ? h / 2 + 4 : h / 2 + 8) : (sub ? h / 2 - 2 : h / 2 + 5);
    const lab = BP.s('text', { x: tag ? 10 : w / 2, y: ly, class: 'n-label', 'text-anchor': tag ? 'start' : 'middle', text: label });
    g.appendChild(lab);
    let subEl = null;
    if (sub != null) {
      subEl = BP.s('text', { x: tag ? 10 : w / 2, y: ly + 15, class: 'n-sub', 'text-anchor': tag ? 'start' : 'middle', text: sub });
      g.appendChild(subEl);
    }
    parent.appendChild(g);
    return { g, rect, lab, subEl, x, y, w, h,
      setSub(t) { if (subEl) subEl.textContent = t; },
      setCls(c) { rect.setAttribute('class', 'n-box ' + (c || '')); },
    };
  };
  BP.line = (parent, a, b, cls) => {
    const l = BP.s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'wire ' + (cls || '') });
    parent.appendChild(l);
    return l;
  };

  BP.toast = function (msg) {
    const t = BP.h('div', { class: 'toast', role: 'status' }, msg);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  };

  BP.levelColor = (n) => `var(--l${n})`;
})();
