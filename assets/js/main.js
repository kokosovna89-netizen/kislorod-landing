/* =====================================================================
   ЖК «Кислород» — интерфейс и движение
   Принципы: анимации привязаны к скроллу (scrub), переход висит
   на уходящей секции; UI — CSS-пружины; первый экран — на CSS,
   скролл-сцены собираются после первой отрисовки.
   Все заявки — в квиз Marquiz (KS_CONFIG.quizId).
   ===================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const cfg = window.KS_CONFIG || {};
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HAS_GSAP = !!(window.gsap && window.ScrollTrigger);
  const MOTION = HAS_GSAP && !REDUCED;
  const FINE = matchMedia('(pointer: fine)').matches;

  root.classList.add(MOTION ? 'motion' : 'no-motion');

  function goal(name, params) {
    const g = cfg.goals && cfg.goals[name];
    if (cfg.metrikaId && g && typeof window.ym === 'function') window.ym(cfg.metrikaId, 'reachGoal', g, params);
  }

  /* ---------- Квиз Marquiz: кнопки — обычные ссылки на квиз,
     а если скрипт Marquiz загрузился, открываем его поверх страницы ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-quiz]');
    if (!a) return;
    goal('quiz_open', { from: a.textContent.trim() });
    if (window.Marquiz && typeof window.Marquiz.showModal === 'function' && cfg.quizId) {
      e.preventDefault();
      if (menu.classList.contains('is-open')) toggleMenu(false);
      window.Marquiz.showModal(cfg.quizId);
    }
  });
  $$('[data-goal="call"]').forEach((a) => a.addEventListener('click', () => goal('call')));

  /* ---------- Плавный скролл: Lenis только на десктопе с мышью ---------- */
  let lenis = null;
  function initLenis() {
    if (!(MOTION && FINE && matchMedia('(min-width: 1024px)').matches)) return;
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/lenis@1.1.13/dist/lenis.min.js';
    s.onload = () => {
      if (!window.Lenis) return;
      lenis = new window.Lenis({ duration: 1.4, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    };
    document.head.appendChild(s);
  }
  const lockScroll = (on) => {
    if (lenis) on ? lenis.stop() : lenis.start();
    document.body.style.overflow = on ? 'hidden' : '';
  };

  const hdr = $('#hdr');
  function scrollToTarget(sel) {
    const top = sel === '#top';
    const el = top ? document.body : $(sel);
    if (!el) return;
    const offset = top ? 0 : -(hdr.offsetHeight - 1);
    if (lenis) lenis.scrollTo(top ? 0 : el, { offset, duration: 1.5 });
    else window.scrollTo({ top: top ? 0 : el.getBoundingClientRect().top + window.scrollY + offset, behavior: REDUCED ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-scroll]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.charAt(0) !== '#') return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) toggleMenu(false);
    scrollToTarget(href);
  });

  /* ---------- Шапка и нижняя панель ---------- */
  const hero = $('.hero');
  const mbar = $('#mbar');
  let lastY = window.scrollY, finalInView = false;
  const heroMedia = $('.hero__media');
  let heroH = hero.offsetHeight, mediaH = heroMedia.offsetHeight;
  window.addEventListener('resize', () => { heroH = hero.offsetHeight; mediaH = heroMedia.offsetHeight; }, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { finalInView = en.isIntersecting; onScroll(); }, { threshold: 0.2 }).observe($('.final'));
  }

  /* ---------- Кадр первого экрана: башни целиком и с воздухом ----------
     hero-air.jpg собран из дневного рендера: слева дерево и небо (0–0.18),
     средняя и правая башни занимают 0.18–0.85 ширины, крыши от 0.075 высоты.
     Кадр прижат к низу и к левому краю окна: слева от башен воздух,
     сверху продолжается небо (фон окна того же цвета). */
  const heroImg = $('.hero__zoom img');
  function fitHero() {
    const pw = heroMedia.clientWidth, ph = heroMedia.clientHeight;
    if (!pw || !ph || !heroImg.naturalWidth) return;
    const ar = heroImg.naturalWidth / heroImg.naturalHeight;
    const RIGHT = 0.85, SCALE = 0.86;               // правый край башен; высота кадра от высоты окна
    let W = ph * SCALE * ar;
    W = Math.max(pw, Math.min(W, (pw - 32) / RIGHT)); // не уже окна; правая башня с отступом 32px
    const H = W / ar;
    const top = Math.max(ph - H, -0.04 * H);          // если кадр выше окна — режем небо, но не крыши
    Object.assign(heroImg.style, {
      width: W.toFixed(1) + 'px', height: H.toFixed(1) + 'px',
      left: '0px', top: top.toFixed(1) + 'px',
      objectFit: 'fill',
    });
  }
  if (heroImg.complete) fitHero(); else heroImg.addEventListener('load', fitHero);
  if ('ResizeObserver' in window) new ResizeObserver(fitHero).observe(heroMedia);
  else window.addEventListener('resize', fitHero);
  function onScroll() {
    const y = window.scrollY;
    const heroEnd = heroH - hdr.offsetHeight;
    // белая шапка — как только под ней кончилось фото (на телефоне это раньше конца экрана)
    hdr.classList.toggle('is-solid', y > mediaH - hdr.offsetHeight - 10);
    if (y > heroEnd && y > lastY + 4) hdr.classList.add('is-hidden');
    else if (y < lastY - 4 || y <= heroEnd) hdr.classList.remove('is-hidden');
    mbar.classList.toggle('is-shown', y > heroH * 0.7 && !finalInView);
    lastY = y;
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();

  /* ---------- Меню ---------- */
  const menu = $('#menu');
  const burger = $('.burger');
  $$('.menu__list a').forEach((a, i) => a.style.setProperty('--i', i));
  function toggleMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    hdr.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    lockScroll(open);
  }
  burger.addEventListener('click', () => toggleMenu(!menu.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) toggleMenu(false); });

  /* ---------- Табы планировок: индикатор-«капля» ---------- */
  $$('.tabs').forEach((list) => {
    const ind = $('.tabs__ind', list);
    const tabs = $$('[role="tab"]', list);
    let cur = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const place = (i) => {
      const t = tabs[i];
      ind.style.setProperty('--l', t.offsetLeft + 'px');
      ind.style.setProperty('--r2', (list.clientWidth - t.offsetLeft - t.offsetWidth) + 'px');
    };
    function select(i, focus) {
      if (i === cur) return;
      list.dataset.dir = i > cur ? 'right' : 'left';
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).classList.toggle('is-active', on);
      });
      cur = i;
      place(i);
      if (focus) tabs[i].focus();
    }
    tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
    list.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (e.key === 'Home') select(0, true);
      else if (e.key === 'End') select(tabs.length - 1, true);
      else if (d) select((cur + d + tabs.length) % tabs.length, true);
      else return;
      e.preventDefault();
    });
    const snap = () => { delete list.dataset.dir; place(cur); };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(snap);
    if ('ResizeObserver' in window) new ResizeObserver(snap).observe(list); else snap();
  });

  /* ---------- Отзывы: лента, стрелки, прогресс, драг мышью ---------- */
  const track = $('.rev-track');
  if (track) {
    const bar = $('.rev-progress span');
    const cards = $$('.rev', track);
    const prev = $('[data-rev="prev"]'), next = $('[data-rev="next"]');
    const checkClamp = () => cards.forEach((c) => {
      if (c.classList.contains('is-open')) return;
      const t = $('.rev__text', c);
      $('.rev__more', c).hidden = t.scrollHeight <= t.clientHeight + 2;
    });
    cards.forEach((c) => $('.rev__more', c).addEventListener('click', (e) => {
      const open = c.classList.toggle('is-open');
      e.currentTarget.textContent = open ? 'Свернуть' : 'Читать полностью';
    }));
    const progress = () => {
      const max = track.scrollWidth - track.clientWidth;
      const w = Math.min(1, track.clientWidth / track.scrollWidth);
      const p = max > 0 ? track.scrollLeft / max : 0;
      bar.style.setProperty('--w', w.toFixed(3));
      bar.style.setProperty('--x', (p * (1 - w) / w * 100).toFixed(2));
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft > max - 4;
    };
    const stepW = () => cards[0].offsetWidth + (parseFloat(getComputedStyle(track).columnGap) || 16);
    prev.addEventListener('click', () => track.scrollBy({ left: -stepW(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: stepW(), behavior: 'smooth' }));
    track.addEventListener('scroll', () => requestAnimationFrame(progress), { passive: true });
    window.addEventListener('resize', () => { checkClamp(); progress(); });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { checkClamp(); progress(); });

    let down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.target.closest('button')) return;
      down = true; moved = false; sx = e.clientX; sl = track.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add('is-drag'); }
      if (moved) track.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (!moved) return;
      const w = stepW();
      track.classList.remove('is-drag');
      track.scrollTo({ left: Math.round(track.scrollLeft / w) * w, behavior: 'smooth' });
    });
  }

  /* ---------- Карта: метки по координатам схемы, дуга-маршрут ---------- */
  const map = $('#map');
  if (map) {
    const [VW, VH] = map.dataset.vb.split(' ').map(Number);
    const home = $('.pin--home', map);
    const HX = +home.dataset.x, HY = +home.dataset.y;
    const route = $('.map__route', map);
    const pins = $$('.pin[data-key]', map);
    const times = $$('.time[data-key]');
    const keys = pins.map((p) => p.dataset.key);
    pins.forEach((p, i) => p.style.setProperty('--n', i));

    function layout() {
      const w = map.clientWidth, h = map.clientHeight;
      const s = Math.max(w / VW, h / VH);                 // как object-fit: cover
      const ox = (w - VW * s) / 2, oy = (h - VH * s) / 2;
      $$('[data-x]', map).forEach((el) => {
        el.style.left = (ox + el.dataset.x * s).toFixed(1) + 'px';
        el.style.top = (oy + el.dataset.y * s).toFixed(1) + 'px';
        if (el.dataset.r) el.style.setProperty('--rot', el.dataset.r + 'deg');
      });
      requestAnimationFrame(() => {                       // подписи улиц за краем карты прячем
        const mr = map.getBoundingClientRect();
        $$('.map__lbl', map).forEach((el) => {
          el.hidden = false;
          const r = el.getBoundingClientRect();
          el.hidden = r.left < mr.left + 8 || r.right > mr.right - 8 || r.top < mr.top + 8 || r.bottom > mr.bottom - 8;
        });
      });
    }
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(map);
    layout();

    let current = null;
    function activate(key) {
      if (key === current) return;
      current = key;
      pins.forEach((p) => p.classList.toggle('is-active', p.dataset.key === key));
      times.forEach((t) => t.classList.toggle('is-active', t.dataset.key === key));
      const p = pins.find((x) => x.dataset.key === key);
      if (!p) return;
      const tx = +p.dataset.x, ty = +p.dataset.y;
      pins.forEach((x) => x.classList.toggle('pin--below', x === p && ty > HY));
      const mx = (HX + tx) / 2, my = (HY + ty) / 2, k = 0.22;
      route.setAttribute('d', `M${HX} ${HY}Q${(mx - (ty - HY) * k).toFixed(0)} ${(my + (tx - HX) * k).toFixed(0)} ${tx} ${ty}`);
      route.classList.remove('is-drawn');
      void route.getBoundingClientRect();
      route.classList.add('is-drawn');
    }

    let timer = null, touched = false, visible = false;
    const stop = () => { clearInterval(timer); timer = null; };
    const cycle = () => {
      stop();
      if (touched || !visible || REDUCED) return;
      timer = setInterval(() => activate(keys[(keys.indexOf(current) + 1) % keys.length]), 3400);
    };
    const pick = (key) => { touched = true; stop(); activate(key); };
    pins.forEach((p) => p.addEventListener('click', () => pick(p.dataset.key)));
    times.forEach((t) => {
      t.addEventListener('click', () => pick(t.dataset.key));
      t.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) pick(t.dataset.key); });
      t.addEventListener('focus', () => pick(t.dataset.key));
    });
    const start = () => {
      map.classList.add('is-in');
      setTimeout(() => { if (!current) activate(keys[0]); cycle(); }, MOTION ? 1200 : 0);
    };
    if ('IntersectionObserver' in window) {
      let started = false;
      new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        if (visible && !started) { started = true; start(); }
        else if (started) visible ? cycle() : stop();
      }, { threshold: 0.3 }).observe(map);
    } else start();
  }

  /* ---------- Cookie ---------- */
  const cookie = $('#cookie');
  if (cookie) {
    let ok = false;
    try { ok = localStorage.getItem('ks_cookie') === '1'; } catch (e) { /* хранилище недоступно */ }
    if (!ok) {
      setTimeout(() => { cookie.inert = false; cookie.classList.add('is-shown'); }, 1500);
      $('[data-cookie-ok]', cookie).addEventListener('click', () => {
        try { localStorage.setItem('ks_cookie', '1'); } catch (e) { /* ничего */ }
        cookie.classList.remove('is-shown');
        cookie.inert = true;
      });
    }
  }

  /* =====================================================================
     ДВИЖЕНИЕ
     ===================================================================== */
  const tick = () => new Promise((r) => (window.scheduler && scheduler.yield ? scheduler.yield().then(r) : setTimeout(r, 0)));

  function splitWords(el) {
    const words = el.textContent.trim().split(/ +/);
    el.innerHTML = words.map((w) => '<span class="w">' + w + '</span>').join(' ');
    return $$('.w', el);
  }

  async function initMotion() {
    gsap.registerPlugin(ScrollTrigger);
    const hasSplit = !!window.SplitText;
    if (hasSplit) gsap.registerPlugin(SplitText);
    const mm = gsap.matchMedia();

    /* Заголовки: строки выезжают из-под маски */
    $$('.split').forEach((el) => {
      if (!hasSplit) { gsap.from(el, { y: 30, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }); return; }
      SplitText.create(el, {
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.15, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: el, start: 'top 88%', once: true } }),
      });
    });

    await tick();
    /* Появление по скроллу: соседи лесенкой */
    const idx = (el) => [...el.parentElement.children].filter((c) => c.classList.contains('ani-rise')).indexOf(el);
    $$('.ani-rise').forEach((el) => {
      const k = Math.max(0, idx(el)) % 4;
      gsap.fromTo(el, { opacity: 0, y: 70, scale: 0.95 }, {
        opacity: 1, y: 0, scale: 1, ease: 'none',
        scrollTrigger: { trigger: el, start: `top+=${k * 36} bottom`, end: `top+=${k * 36} 74%`, scrub: true },
      });
    });
    $$('.ani-fade').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 72%', scrub: true } });
    });

    await tick();
    /* Первый экран уходит вниз и гаснет */
    gsap.to('.hero__media', {
      y: () => window.innerHeight * 0.22, opacity: 0.5, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });

    /* Счётчики */
    $$('[data-count]').forEach((el) => {
      const to = +el.dataset.count, o = { v: 0 };
      el.textContent = '0';
      ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v); } }) });
    });

    await tick();
    /* О квартале: слова проявляются по мере чтения */
    const lead = $('.about__lead');
    if (lead) {
      gsap.to(splitWords(lead), {
        color: (i) => (i === 0 ? '#A86F5A' : '#1D1D1B'), ease: 'none', stagger: 0.06,
        scrollTrigger: { trigger: lead, start: 'top 82%', end: 'bottom 46%', scrub: true },
      });
    }

    await tick();
    /* Главная сцена: двор раскрывается через знак Партикл */
    const reveal = $('.reveal');
    if (reveal) {
      const media = $('.reveal__media', reveal);
      const img = $('img', media);
      const cap = $('.reveal__caption', reveal);
      const uline = $('.u-line', cap);
      gsap.timeline({ scrollTrigger: { trigger: reveal, start: 'top bottom', end: 'bottom bottom', scrub: 0.6 } })
        .fromTo(media, { '--m': '46vh' }, { '--m': '2400vh', ease: 'power3.in', duration: 1 }, 0)
        .fromTo(img, { scale: 1.4 }, { scale: 1, ease: 'power1.out', duration: 1 }, 0)
        .fromTo('.reveal__scrim', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.66)
        .fromTo(cap, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'power2.out', duration: 0.2 }, 0.7)
        .call(() => uline && uline.classList.remove('is-on'), null, 0.86)
        .call(() => uline && uline.classList.add('is-on'), null, 0.9)
        .to({}, { duration: 0.12 });
      /* уход: кадр уезжает вглубь и становится карточкой */
      gsap.fromTo('.reveal__frame', { scale: 1, borderRadius: 0 }, { scale: 0.86, borderRadius: 32, ease: 'none', scrollTrigger: { trigger: '.adv', start: 'top bottom', end: 'top 15%', scrub: true } });
      gsap.fromTo(img, { yPercent: 0 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.adv', start: 'top bottom', end: 'top 15%', scrub: true } });
    }

    await tick();
    /* Преимущества: стопка, нижняя карточка уходит вглубь и темнеет */
    const cards = $$('.adv__card');
    cards.forEach((card, i) => {
      card.style.setProperty('--i', i);
      gsap.fromTo($('img', card), { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'top 30%', scrub: true } });
      const nx = cards[i + 1];
      if (!nx) return;
      gsap.to(card, {
        scale: 0.93, '--dim': 0.3, ease: 'none',
        scrollTrigger: { trigger: nx, start: 'top bottom', end: () => 'top ' + (parseFloat(getComputedStyle(nx).top) || 90) + 'px', scrub: true, invalidateOnRefresh: true },
      });
    });

    await tick();
    /* Линии-шевроны рисуют себя */
    $$('.draw').forEach((p) => {
      gsap.fromTo(p, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: p.closest('section'), start: 'top 75%', end: 'bottom 70%', scrub: true } });
    });

    /* Время до объектов выезжает слева */
    $$('.time').forEach((el, i) => {
      gsap.fromTo(el, { opacity: 0, x: -60 }, { opacity: 1, x: 0, ease: 'none', scrollTrigger: { trigger: el, start: `top+=${(i % 2) * 20} bottom`, end: `top+=${(i % 2) * 20} 76%`, scrub: true } });
    });

    await tick();
    /* Фото-пауза: параллакс */
    gsap.fromTo('.pause__media', { yPercent: -8, scale: 1.12 }, { yPercent: 8, scale: 1, ease: 'none', scrollTrigger: { trigger: '.pause', start: 'top bottom', end: 'bottom top', scrub: true } });

    /* Отзывы въезжают волной */
    gsap.from('.rev', { x: 90, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.rev-track', start: 'top 85%', once: true } });

    await tick();
    /* Финал: фото раскрывается, плашка поднимается, футер гасит фото */
    gsap.fromTo('.final__media img', { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.final', start: 'top bottom', end: 'top top', scrub: true } });
    mm.add('(min-width: 768px)', () => {
      gsap.fromTo('.final__plaque', { y: 120, opacity: 0 }, { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.final', start: 'top 70%', end: 'top 10%', scrub: true } });
    });
    gsap.to('.final__media', { opacity: 0.35, ease: 'none', scrollTrigger: { trigger: '.ftr', start: 'top bottom', end: 'top 30%', scrub: true } });

    /* Магнитные кнопки */
    if (FINE) {
      $$('.hero__btns .btn, .terms__cta, .hdr__cta, .final__btn').forEach((b) => {
        const xTo = gsap.quickTo(b, 'x', { duration: 0.6, ease: 'power3.out' });
        const yTo = gsap.quickTo(b, 'y', { duration: 0.6, ease: 'power3.out' });
        b.addEventListener('pointermove', (e) => {
          const r = b.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.22);
          yTo((e.clientY - r.top - r.height / 2) * 0.35);
        });
        b.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
      });
    }

    ScrollTrigger.refresh();
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  const boot = () => {
    if (MOTION) initMotion().then(initLenis);
    else $$('.u-line').forEach((el) => el.classList.add('is-on'));
  };
  if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 1000 });
  else setTimeout(boot, 200);
})();
