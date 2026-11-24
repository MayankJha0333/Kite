// Kite landing page: hero stickers, the working mini browser, words that light up, and small demos.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ---------- hero stickers drift with the pointer ---------- */
const stickers = $('#stickers');
if (stickers) {
  $$('.st', stickers).forEach((e) => e.style.setProperty('--dd', e.dataset.d));
  if (!reduced) addEventListener('pointermove', (e) => {
    stickers.style.setProperty('--px', (e.clientX / innerWidth - 0.5).toFixed(3));
    stickers.style.setProperty('--py', (e.clientY / innerHeight - 0.5).toFixed(3));
  }, { passive: true });
}

/* ---------- the mini Kite ---------- */
const SPACES = [
  { name: 'Home', emoji: '🪁', g: ['#2b2a8a', '#5b3bc4', '#23707c'], acc: '#8f7bff', tabs: [
    { t: 'Kite – Wikipedia', h: 'en.wikipedia.org', c: '#3b5bdb', l: 'W', kind: 'article', head: 'Kite', meta: 'From Wikipedia, the free encyclopedia' },
    { t: 'Hacker News', h: 'news.ycombinator.com', c: '#f26522', l: 'Y', kind: 'list', head: 'Top stories', meta: '30 links · updated a minute ago', rows: ['Show HN: a browser with a sidebar', 'Why calm software matters', 'The case for fewer tabs'] },
    { t: 'YouTube', h: 'youtube.com', c: '#e03131', l: '▶', kind: 'video', head: 'Kite flying for beginners', meta: '12 min · floats when you switch tabs' },
    { t: 'Figma', h: 'figma.com', c: '#a259ff', l: 'F', kind: 'article', head: 'Sidebar redesign', meta: 'Edited 4 minutes ago' },
  ] },
  { name: 'Work', emoji: '💼', g: ['#7a1f52', '#c2416c', '#d9804a'], acc: '#f0739c', tabs: [
    { t: 'electron/electron', h: 'github.com', c: '#24292f', l: 'G', kind: 'list', head: 'Pull requests', meta: '4 open · 2 need review', rows: ['Upgrade Chromium', 'Fix download resume', 'Docs: fuses'] },
    { t: 'Launch plan', h: 'notes', c: '#c2416c', l: '✎', kind: 'article', head: 'Launch plan', meta: 'A note in the sidebar · 64 words' },
    { t: 'CSS | MDN', h: 'developer.mozilla.org', c: '#1c7ed6', l: 'M', kind: 'article', head: 'CSS: Cascading Style Sheets', meta: 'Reference · Web technology for developers' },
  ] },
  { name: 'Calm', emoji: '🌿', g: ['#12503a', '#1e8a5c', '#2f7f93'], acc: '#4fd1a1', tabs: [
    { t: 'Weekend in Kyoto', h: 'travel.example', c: '#1e8a5c', l: 'K', kind: 'article', head: 'Weekend in Kyoto', meta: 'Two slow days of temples, tea and long walks' },
    { t: 'Lo-fi mix', h: 'youtube.com', c: '#e03131', l: '▶', kind: 'video', head: 'Lo-fi for reading', meta: '1 h 20 min' },
    { t: 'Reading list', h: 'notes', c: '#2f9e44', l: '✎', kind: 'list', head: 'Reading list', meta: '3 saved for later', rows: ['The Shallows', 'How Buildings Learn', 'A Pattern Language'] },
  ] },
];
const app = $('#app');
if (app) {
  const st = { space: 0, tab: 0, split: false, touched: false };
  const tabsEl = $('#tabs'), pagesEl = $('#pages'), favs = $('#favs'), spacesEl = $('#spaces'), cmd = $('#cmd'), cmdList = $('#cmd-list'), cmdText = $('#cmd-text');
  const seg = $('#seg'), segBtns = $$('button', seg), pill = $('i', seg);
  const setSeg = (act) => { const b = segBtns.find((x) => x.dataset.act === act) || segBtns[0]; segBtns.forEach((x) => x.classList.toggle('on', x === b)); pill.style.width = b.offsetWidth + 'px'; pill.style.translate = b.offsetLeft + 'px 0'; };
  const ico = (t) => '<i class="fav-ico" style="background:' + t.c + '">' + t.l + '</i>';
  const pageHtml = (t) => {
    let body;
    if (t.kind === 'video') body = '<div class="hero-blk"><span class="play">▶</span></div><div class="ln" style="width:70%"></div><div class="ln" style="width:44%"></div>';
    else if (t.kind === 'list') body = '<div class="rows">' + t.rows.map((r) => '<div><b></b>' + r + '</div>').join('') + '</div><div class="hero-blk" style="height:22%;min-height:54px"></div><div class="ln" style="width:58%"></div>';
    else body = '<div class="hero-blk"></div><div class="ln"></div><div class="ln" style="width:92%"></div><div class="ln" style="width:64%"></div>';
    return '<span class="blocked">🛡 ' + (3 + (t.t.length % 9)) + ' blocked</span><div class="host">' + t.h + '</div><h4>' + t.head + '</h4><div class="meta">' + t.meta + '</div>' + body;
  };
  const page = (t) => { const p = el('div', 'page', pageHtml(t)); p.style.setProperty('--pc', t.c); return p; };
  function render(animateTabs) {
    const sp = SPACES[st.space];
    ['g1', 'g2', 'g3'].forEach((k, i) => app.style.setProperty('--' + k, sp.g[i])); app.style.setProperty('--acc', sp.acc);
    $('#space-name').textContent = sp.emoji + '  ' + sp.name;
    $('#url-text').textContent = sp.tabs[st.tab].h;
    tabsEl.replaceChildren(...sp.tabs.map((t, i) => {
      const b = el('button', 'tab' + (i === st.tab ? ' on' : '') + (animateTabs ? ' enter' : ''), ico(t) + '<span>' + t.t + '</span>');
      b.type = 'button'; b.onclick = () => { st.touched = true; setSeg('tabs'); go(i); };
      if (animateTabs) setTimeout(() => b.classList.remove('enter'), 60 + i * 80);
      return b;
    }));
    spacesEl.replaceChildren(...SPACES.map((s, i) => { const b = el('button', i === st.space ? 'on' : '', s.emoji); b.type = 'button'; b.title = s.name; b.onclick = () => { st.touched = true; setSeg('space'); setSpace(i); }; return b; }));
    favs.replaceChildren(...sp.tabs.slice(0, 3).map((t, i) => { const b = el('button', '', ico(t)); b.type = 'button'; b.title = t.t; b.onclick = () => { st.touched = true; go(i); }; return b; }));
    pagesEl.classList.toggle('split', st.split);
    pagesEl.replaceChildren(page(sp.tabs[st.tab]), ...(st.split ? [page(sp.tabs[(st.tab + 1) % sp.tabs.length])] : []));
  }
  const go = (i) => { st.tab = i; render(false); };
  const setSpace = (i) => { st.space = i; st.tab = 0; st.split = false; render(true); };

  let typing = null;
  function listFor(q) {
    const all = SPACES.flatMap((s, si) => s.tabs.map((t, ti) => ({ t, si, ti })));
    const hits = all.filter((x) => (x.t.t + x.t.h).toLowerCase().includes(q.toLowerCase())).slice(0, 4);
    cmdList.replaceChildren(...hits.map((x, i) => { const b = el('button', i === 0 ? 'on' : '', ico(x.t) + '<span>' + x.t.t + '</span><small>Switch to Tab</small>'); b.type = 'button'; b.onclick = () => pick(x); return b; }));
    return hits;
  }
  function pick(x) { closeCmd(); st.space = x.si; st.split = false; st.tab = x.ti; render(true); }
  function openCmd(query) {
    closeCmd(); cmd.hidden = false; cmdText.textContent = ''; listFor('');
    let n = 0, hits = [];
    typing = setInterval(() => {
      n++; cmdText.textContent = query.slice(0, n); hits = listFor(query.slice(0, n));
      if (n >= query.length) { clearInterval(typing); typing = setTimeout(() => { if (!cmd.hidden && hits[0]) pick(hits[0]); }, 1200); }
    }, reduced ? 0 : 180);
  }
  function closeCmd() { clearInterval(typing); clearTimeout(typing); cmd.hidden = true; }
  cmd.addEventListener('click', (e) => { if (e.target === cmd) closeCmd(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCmd(); });
  const QUERIES = ['fig', 'git', 'kyo'];
  $('#url').onclick = $('#newtab').onclick = () => { st.touched = true; setSeg('cmd'); openCmd(QUERIES[(st.space + 1) % 3]); };

  const act = (a) => {
    setSeg(a);
    if (a === 'tabs') { st.split = false; go((st.tab + 1) % SPACES[st.space].tabs.length); }
    if (a === 'cmd') openCmd(QUERIES[(st.space + 1) % 3]);
    if (a === 'split') { st.split = true; render(false); }
    if (a === 'space') setSpace((st.space + 1) % SPACES.length);
  };
  segBtns.forEach((b) => (b.onclick = () => { st.touched = true; act(b.dataset.act); }));
  render(true);
  const resync = () => setSeg(segBtns.find((b) => b.classList.contains('on')).dataset.act);
  requestAnimationFrame(resync);
  addEventListener('resize', resync);
  if (document.fonts) document.fonts.ready.then(resync);

  // plays by itself until someone touches it
  const script = ['tabs', 'tabs', 'cmd', 'split', 'space', 'tabs', 'split', 'space', 'cmd', 'space'];
  let step = 0, visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.35 }).observe(app);
  if (!reduced) setInterval(() => { if (st.touched || !visible || !cmd.hidden || document.hidden) return; act(script[step++ % script.length]); }, 2800);
}

/* ---------- scroll: nav, words that light up, film straightening ---------- */
const nav = $('#nav'), film = $('.film'), wordsEl = $('#words');
let wordSpans = [];
if (wordsEl) {
  const KEY = new Set(['sidebar,', 'Spaces,', 'archives', 'page']);
  wordsEl.innerHTML = wordsEl.textContent.trim().split(/\s+/).map((w) => '<span class="' + (KEY.has(w) ? 'kw' : '') + '">' + w + '</span>').join(' ');
  wordSpans = $$('span', wordsEl);
}
let ticking = false;
const onScroll = () => {
  ticking = false;
  nav.classList.toggle('stuck', scrollY > 40);
  if (wordsEl) {
    const r = wordsEl.getBoundingClientRect();
    const p = reduced ? 1 : Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
    const n = Math.round(p * wordSpans.length);
    wordSpans.forEach((w, i) => w.classList.toggle('lit', i < n));
  }
  if (film && !reduced) {
    const r = film.getBoundingClientRect();
    const seen = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.8)));
    film.style.setProperty('--rot', (-5 + seen * 4).toFixed(2) + 'deg');
    film.style.setProperty('--s', (0.86 + seen * 0.14).toFixed(3));
  }
};
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

/* ---------- reveals and count-ups ---------- */
const countUp = (b) => {
  const n = Number(b.dataset.n);
  if (reduced) { b.textContent = n; return; }
  const t0 = performance.now();
  const tick = (now) => { const p = Math.min(1, (now - t0) / 1600); b.textContent = Math.round(n * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('in'); io.unobserve(e.target);
    const b = $('[data-n]', e.target); if (b) countUp(b);
    if (e.target.classList.contains('score')) runPops();
  }
}, { threshold: 0.16 });
$$('.reveal').forEach((e) => {
  const sibs = [...e.parentElement.children].filter((c) => c.classList.contains('reveal'));
  e.style.setProperty('--rd', (sibs.indexOf(e) % 4) * 90 + 'ms');
  io.observe(e);
});

/* ---------- privacy: tracker pills pop one by one ---------- */
const HOSTS = ['googletagmanager', 'doubleclick', 'facebook pixel', 'hotjar', 'taboola', 'bing ads', 'scorecard', 'amazon ads', 'tiktok pixel', 'criteo'];
let popsRan = false;
function runPops() {
  if (popsRan) return; popsRan = true;
  const list = $('#pops'); if (!list) return;
  const items = HOSTS.map((h) => { const li = el('li', '', h); list.appendChild(li); return li; });
  if (reduced) return;
  let i = 0;
  setInterval(() => { if (document.hidden) return; if (i >= items.length) { items.forEach((li) => li.classList.remove('gone')); i = 0; return; } items[i++].classList.add('gone'); }, 700);
}

/* ---------- film plays only while visible ---------- */
const video = $('.film video');
if (video) {
  if (reduced) { video.removeAttribute('autoplay'); video.pause(); video.controls = true; }
  else new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause()), { threshold: 0.2 }).observe(video);
}
