// Scroll reveals, the hero frame's tilt, and the two small demos in the feature cards.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reveal sections as they enter the viewport.
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      io.unobserve(e.target);
      const counter = e.target.querySelector('[data-count]');
      if (counter) runShields(counter);
    }
  },
  { threshold: 0.18 },
);
document.querySelectorAll('.reveal').forEach((el, i) => {
  if (el.classList.contains('card')) el.style.transitionDelay = `${(i % 4) * 70}ms`;
  io.observe(el);
});

// The hero frame starts tilted back and flattens as you scroll to it; it also leans toward the pointer.
const frame = document.getElementById('tilt');
if (frame && !reduced && matchMedia('(min-width: 861px)').matches) {
  let px = 0;
  const update = () => {
    const r = frame.getBoundingClientRect();
    const seen = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.75)));
    frame.style.setProperty('--rx', `${(1 - seen) * 14}deg`);
    frame.style.setProperty('--s', String(0.92 + seen * 0.08));
    frame.style.setProperty('--ry', `${px * 4}deg`);
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('pointermove', (e) => {
    px = e.clientX / innerWidth - 0.5;
    update();
  }, { passive: true });
  update();
}

// Shields card: 57 dots, 53 of them get "blocked" while the number counts up.
function runShields(counter) {
  const target = Number(counter.dataset.count);
  const dots = document.querySelector('.dots');
  const total = 57;
  if (dots && !dots.children.length) for (let i = 0; i < total; i++) dots.appendChild(document.createElement('i'));
  const order = [...Array(total).keys()].sort((a, b) => ((a * 37) % total) - ((b * 37) % total)).slice(0, target);
  if (reduced) {
    counter.textContent = String(target);
    order.forEach((i) => dots?.children[i].classList.add('hit'));
    return;
  }
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / 1800);
    const n = Math.round(target * (1 - Math.pow(1 - p, 3)));
    counter.textContent = String(n);
    for (let i = 0; i < n; i++) dots?.children[order[i]].classList.add('hit');
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Stagger the download segments.
document.querySelectorAll('.segs i').forEach((el, i) => el.style.setProperty('--i', String(i)));

// Play the film only while it is on screen.
const film = document.querySelector('.frame video');
if (film) {
  if (reduced) {
    film.removeAttribute('autoplay');
    film.pause();
    film.controls = true;
  } else {
    new IntersectionObserver(([e]) => (e.isIntersecting ? film.play().catch(() => {}) : film.pause()), { threshold: 0.2 }).observe(film);
  }
}
