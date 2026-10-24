/* UI des veganen Wochenplaners */
(function () {
  const D = window.VPData, P = window.VPPlanner;
  const KEY = 'veganWochenplaner.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SLOT = {
    breakfast: { ico: '🥣', label: 'Frühstück' },
    lunch: { ico: '🥗', label: 'Mittag' },
    dinner: { ico: '🍲', label: 'Abendessen' },
    snack: { ico: '💪', label: 'Protein-Snack' },
  };
  const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const fmtDate = (s) => { const d = P.parseIso(s); return `${WD_SHORT[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.`; };

  let st, tab = 'plan', recipeFilter = { q: '', meal: 'all' }, lastEffects = null;

  // ---------- Speicher ----------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const def = P.defaultState();
        s.settings = Object.assign(def.settings, s.settings);
        return Object.assign(def, s);
      }
    } catch (e) { console.warn(e); }
    return null;
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(st)); }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
  }

  // ---------- Init ----------
  function init() {
    st = load();
    if (!st) {
      st = P.defaultState();
      P.applyFeedback(st, 'Ich mag Granola zum Frühstück');
      st.plan = P.generatePlan(st);
      st.firstRun = true;
      save();
    }
    document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
    $('#modalBg').addEventListener('click', (e) => { if (e.target.id === 'modalBg') closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    const h = location.hash.replace('#', '');
    if (['plan', 'shop', 'recipes', 'feedback', 'settings'].includes(h)) tab = h;
    render();
  }
  function go(t) { tab = t; location.hash = t; render(); window.scrollTo(0, 0); }

  function render() {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    const open = openItemsCount();
    $('#shopBadge').textContent = open ? open : '';
    const app = $('#app');
    ({ plan: renderPlan, shop: renderShop, recipes: renderRecipes, feedback: renderFeedback, settings: renderSettings })[tab](app);
  }

  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const weekOver = () => st.plan && P.planEnd(st.plan) < today();

  // ---------- Wochenplan ----------
  function renderPlan(app) {
    const plan = st.plan;
    const S = st.settings;
    const end = P.planEnd(plan);
    const avgProtein = Math.round(plan.days.reduce((s, d) => s + P.dayProtein(st, d), 0) / plan.days.length);
    const cookCount = plan.days.reduce((s, d) => s + ['lunch', 'dinner'].filter((x) => d.meals[x] && d.meals[x].servings).length, 0);
    const delivery = P.parseIso(plan.start);
    let html = '';

    if (st.firstRun) {
      html += `<div class="banner info"><p><b>Willkommen! 👋</b> Dein erster Plan ist fertig – Granola ist schon im Frühstück eingeplant.
        <span class="steps-onboard">
          <div><b>1.</b> Plan ansehen, mit 🔄 einzelne Gerichte tauschen oder mit 🔒 behalten.</div>
          <div><b>2.</b> Unter <b>🛒 Einkauf</b> die Liste abhaken und bei REWE bestellen.</div>
          <div><b>3.</b> Nach dem Essen 👍/👎 geben oder unter <b>💬 Feedback</b> schreiben, was du magst.</div>
          <div><b>4.</b> Jede Woche: Woche abschließen → neuer Plan, der dein Feedback berücksichtigt.</div>
        </span></p>
        <button class="btn" data-act="dismiss">Verstanden</button></div>`;
    }
    if (weekOver()) {
      html += `<div class="banner warn"><p><b>Neue Woche!</b> Dieser Plan ist abgelaufen. Bewerte kurz, was dir geschmeckt hat (👍/👎) – dann erstelle den Plan für die nächste Lieferung.</p>
        <button class="btn primary" data-act="newweek">✨ Neuen Wochenplan erstellen</button></div>`;
    }

    html += `<div class="row"><div><h1>Wochenplan</h1>
      <p class="sub">${fmtDate(plan.start)} – ${fmtDate(P.iso(end))} · REWE-Lieferung am <b>${P.WD[delivery.getDay()]}, ${delivery.getDate()}.${delivery.getMonth() + 1}.</b> · ${S.persons} ${S.persons === 1 ? 'Person' : 'Personen'}</p></div>
      <div class="spacer"></div>
      <div class="row no-print">
        <button class="btn" data-act="regen" title="Neuer Vorschlag – mit 🔒 gesperrte Gerichte bleiben">🎲 Neu mischen</button>
        <button class="btn" data-act="newweek" title="Aktuelle Woche archivieren und Plan für die nächste Lieferung erstellen">⏭️ Woche abschließen</button>
        <button class="btn primary" data-go="shop">🛒 Zur Einkaufsliste</button>
      </div></div>`;

    html += `<div class="stats">
      <div class="stat"><b>${avgProtein} g</b><span>Protein pro Person/Tag (Ziel ${S.proteinTarget} g)</span><div class="bar"><i style="width:${Math.min(100, (avgProtein / S.proteinTarget) * 100)}%"></i></div></div>
      <div class="stat"><b>${cookCount}×</b><span>kochen pro Woche${S.lunchMode === 'leftovers' ? ' (Reste = Mittagessen)' : ''}</span></div>
      <div class="stat"><b>${openItemsCount()}</b><span>Artikel noch nicht im Warenkorb</span></div>
      <div class="stat"><b>${Object.keys(st.prefs.ingredient).length + Object.keys(st.prefs.tag).length + Object.keys(st.prefs.recipe).length}</b><span>gelernte Vorlieben</span></div>
    </div>`;

    html += '<div class="days">';
    const td = P.iso(today());
    plan.days.forEach((d, i) => {
      html += `<div class="card day ${d.date === td ? 'today' : ''}"><h3>${P.WD[d.weekday]} <small>${fmtDate(d.date)} · 💪 ${P.dayProtein(st, d)} g</small></h3>`;
      for (const slot of P.SLOTS) {
        const m = d.meals[slot];
        if (!m) continue;
        const r = P.RBY[m.id];
        const left = m.leftoverOf != null;
        const rating = st.prefs.recipe[r.id] || 0;
        let meta = `⏱ ${r.time} Min · 💪 ${r.protein} g`;
        if (left) meta = `Reste vom Vorabend – nur aufwärmen/einpacken · 💪 ${r.protein} g`;
        else if (slot === 'dinner' && st.settings.lunchMode === 'leftovers' && m.servings > st.settings.persons) meta += ` · <b>${m.servings} Portionen</b> kochen (Hälfte für morgen)`;
        else if ((slot === 'breakfast' || slot === 'snack') && i > 0 && plan.days[i - 1].meals[slot] && plan.days[i - 1].meals[slot].id === m.id) meta = `wie gestern · ⏱ ${r.time} Min · 💪 ${r.protein} g`;
        html += `<div class="meal ${left ? 'leftover' : ''}">
          <div class="ico">${left ? '♻️' : SLOT[slot].ico}</div>
          <div><div class="slot">${SLOT[slot].label}${d.locks[slot] ? ' · 🔒' : ''}</div>
            <div class="name" data-recipe="${r.id}" data-servings="${left ? st.settings.persons : m.servings}">${esc(r.name)}</div>
            <div class="meta">${meta}</div></div>
          <div class="acts no-print">${left ? '' : `
            <button class="icon-btn ${rating > 0 ? 'on' : ''}" data-rate="${r.id}" data-v="1" title="Schmeckt mir – öfter vorschlagen">👍</button>
            <button class="icon-btn ${rating < 0 ? 'on neg' : ''}" data-rate="${r.id}" data-v="-1" title="Nicht so gut – seltener vorschlagen">👎</button>
            <button class="icon-btn" data-swap="${i}" data-slot="${slot}" title="${slot === 'breakfast' || slot === 'snack' ? 'Tauschen (für alle Tage mit diesem Gericht)' : 'Anderes Gericht vorschlagen'}">🔄</button>
            <button class="icon-btn ${d.locks[slot] ? 'on' : ''}" data-lock="${i}" data-slot="${slot}" title="Behalten, auch beim Neu-Mischen">🔒</button>`}
          </div></div>`;
      }
      html += '</div>';
    });
    html += '</div>';
    app.innerHTML = html;

    app.onclick = (e) => {
      const b = e.target.closest('[data-act],[data-go],[data-recipe],[data-rate],[data-swap],[data-lock]');
      if (!b) return;
      if (b.dataset.go) return go(b.dataset.go);
      if (b.dataset.recipe) return openRecipe(b.dataset.recipe, +b.dataset.servings);
      if (b.dataset.rate) { rate(b.dataset.rate, +b.dataset.v); return; }
      if (b.dataset.swap != null) {
        const r = P.swapMeal(st, +b.dataset.swap, b.dataset.slot);
        if (r) { save(); toast(`🔄 Neu: ${r.name}`); } else toast('Keine passende Alternative gefunden.');
        return render();
      }
      if (b.dataset.lock != null) {
        const d = plan.days[+b.dataset.lock], s = b.dataset.slot;
        const val = !d.locks[s];
        if (s === 'breakfast' || s === 'snack') plan.days.forEach((x) => { if (x.meals[s] && x.meals[s].id === d.meals[s].id) x.locks[s] = val; });
        else d.locks[s] = val;
        save(); return render();
      }
      const act = b.dataset.act;
      if (act === 'dismiss') { delete st.firstRun; save(); render(); }
      if (act === 'regen') regen(true);
      if (act === 'newweek') newWeek();
    };
  }

  function rate(id, v) {
    const cur = st.prefs.recipe[id] || 0;
    const name = P.RBY[id].name;
    if ((v > 0 && cur > 0) || (v < 0 && cur < 0 && cur > -99)) { P.setPref(st, 'recipe', id, 0); toast('Bewertung entfernt'); }
    else { P.setPref(st, 'recipe', id, v > 0 ? 2 : -2); toast(v > 0 ? `👍 „${name}“ kommt öfter` : `👎 „${name}“ kommt seltener`); }
    save(); render();
  }

  function regen(keepLocks) {
    const oldChecked = st.checked;
    st.plan = P.generatePlan(st, { keepLocks, keepStart: true });
    st.checked = oldChecked;
    save(); render(); toast('🎲 Neuer Vorschlag erstellt');
  }

  function newWeek() {
    if (!weekOver() && !confirm('Aktuelle Woche abschließen und einen neuen Plan für die nächste Lieferung erstellen?')) return;
    P.archivePlan(st);
    let start = P.nextDelivery(today(), st.settings.deliveryDay);
    if (!weekOver() && P.iso(start) <= st.plan.start) start = P.nextDelivery(P.addDays(P.planEnd(st.plan), 1), st.settings.deliveryDay);
    st.plan = P.generatePlan(st, { start });
    st.checked = {}; st.pantryMissing = {};
    save(); render(); toast('✨ Neuer Wochenplan – angepasst an dein Feedback');
  }

  // ---------- Einkauf ----------
  function qtyLabel(it) {
    const I = D.INGREDIENTS[it.key];
    if (I.pack === 1) {
      const n = it.packs;
      const u = { Stk: 'Stk', Dose: n === 1 ? 'Dose' : 'Dosen', Bund: 'Bund' }[I.unit] || I.unit;
      return `${n} ${u}`;
    }
    return `${it.packs}×`;
  }
  function itemText(it) {
    const I = D.INGREDIENTS[it.key];
    return I.pack === 1 ? `${qtyLabel(it)} ${I.name}` : `${it.packs}× ${I.name} (${I.packLabel})`;
  }
  function allItems() {
    const sl = P.shoppingList(st);
    const list = [];
    sl.groups.forEach((g) => g.items.forEach((it) => list.push({ id: 'i:' + it.key })));
    sl.pantry.forEach((p) => st.pantryMissing[p.key] && list.push({ id: 'p:' + p.key }));
    st.essentials.forEach((e) => e.on && list.push({ id: 'e:' + e.id }));
    return { sl, list };
  }
  function openItemsCount() {
    if (!st || !st.plan) return 0;
    return allItems().list.filter((x) => !st.checked[x.id]).length;
  }
  const reweLink = (q) => st.settings.reweUrl + encodeURIComponent(q);

  function renderShop(app) {
    const { sl, list } = allItems();
    const done = list.filter((x) => st.checked[x.id]).length;
    const delivery = P.parseIso(st.plan.start);
    let html = `<div class="row"><div><h1>Einkaufsliste</h1>
      <p class="sub">Für die REWE-Lieferung am <b>${P.WD[delivery.getDay()]}, ${delivery.getDate()}.${delivery.getMonth() + 1}.</b> · Mengen sind auf ganze Packungen gerundet.</p></div>
      <div class="spacer"></div>
      <div class="row no-print">
        <button class="btn" data-act="copy">📋 Liste kopieren</button>
        <button class="btn" data-act="print">🖨️ Drucken</button>
        <a class="btn rewe" href="https://shop.rewe.de/" target="_blank" rel="noopener">REWE Lieferservice öffnen ↗</a>
      </div></div>
      <div class="banner info no-print"><p>So geht’s: Klicke bei jedem Artikel auf <b>REWE ↗</b>, lege das Produkt in deinen Warenkorb und hake es hier ab. Was du schon zuhause hast, hakst du einfach direkt ab.</p>
      <span class="progress">${done}/${list.length} erledigt</span></div>
      <div class="shop-grid"><div class="card">`;

    const itemRow = (id, qty, name, extra, search) => `<label class="item ${st.checked[id] ? 'done' : ''}">
        <input type="checkbox" data-check="${esc(id)}" ${st.checked[id] ? 'checked' : ''}/>
        <div><span class="q">${qty}</span><span class="nm">${esc(name)}</span>${extra ? `<div class="for">${extra}</div>` : ''}</div>
        ${search ? `<a class="rewe-link" href="${reweLink(search)}" target="_blank" rel="noopener" title="Bei REWE suchen: ${esc(search)}">REWE ↗</a>` : '<span></span>'}
      </label>`;

    sl.groups.forEach((g) => {
      html += `<div class="group"><h3>${g.cat}</h3>`;
      g.items.forEach((it) => {
        const I = D.INGREDIENTS[it.key];
        const pack = I.pack === 1 ? '' : ` <span class="for">(${I.packLabel})</span>`;
        let extra = `für: ${it.usedIn.map(esc).join(', ')}`;
        if (I.pack !== 1) extra = `benötigt ${P.fmtQty(it.need, it.unit)}${it.restPct > 0.25 ? ` · Rest ${P.fmtQty(it.rest, it.unit)} bleibt für nächste Woche` : ''} · ${extra}`;
        html += itemRow('i:' + it.key, qtyLabel(it), I.name, extra, I.search).replace('</span><div class="for">', `</span>${pack}<div class="for">`);
      });
      html += '</div>';
    });
    const missing = sl.pantry.filter((p) => st.pantryMissing[p.key]);
    if (missing.length) {
      html += `<div class="group"><h3>Vorrat nachkaufen</h3>`;
      missing.forEach((p) => { html += itemRow('p:' + p.key, '1×', p.name, '', D.INGREDIENTS[p.key].search); });
      html += '</div>';
    }
    const ess = st.essentials.filter((e) => e.on);
    if (ess.length) {
      html += `<div class="group"><h3>Essentials (jede Woche)</h3>`;
      ess.forEach((e) => { html += itemRow('e:' + e.id, '', e.name, '', e.name.replace(/\(.*?\)/g, '').trim()); });
      html += '</div>';
    }
    html += `</div><div>
      <div class="card no-print"><h3>🧂 Vorrat prüfen</h3><p class="sub" style="margin:4px 0 8px">Diese Basics brauchst du diese Woche. Kreuze an, was <b>fehlt</b> – es landet dann auf der Liste.</p>
      ${sl.pantry.map((p) => `<label class="item"><input type="checkbox" data-pantry="${p.key}" ${st.pantryMissing[p.key] ? 'checked' : ''}/><div>${esc(p.name)}<div class="for">${P.fmtQty(p.need, p.unit)} diese Woche</div></div><span></span></label>`).join('')}
      </div>
      <div class="card no-print" style="margin-top:14px"><h3>⭐ Essentials – jede Woche dabei</h3><p class="sub" style="margin:4px 0 8px">Dinge, die du unabhängig vom Menü immer bestellst.</p>
      ${st.essentials.map((e) => `<div class="item"><input type="checkbox" data-ess="${e.id}" ${e.on ? 'checked' : ''} title="Diese Woche bestellen"/><div>${esc(e.name)}</div><button class="icon-btn" data-essdel="${e.id}" title="Entfernen">✕</button></div>`).join('')}
      <form class="ess-add" id="essForm"><input type="text" id="essInput" placeholder="z. B. Hafermilch Barista, Spülmittel …"/><button class="btn small primary">+</button></form>
      </div>
      <div class="card no-print" style="margin-top:14px"><h3>📅 Wöchentliche Erinnerung</h3><p class="sub" style="margin:4px 0 8px">Kalendertermin (wiederholend) am Vortag der Lieferung um 18 Uhr: „Woche bewerten, neuen Plan erstellen, bei REWE bestellen“.</p>
      <button class="btn" data-act="ics">📅 Zum Kalender hinzufügen</button></div>
    </div></div>`;
    app.innerHTML = html;

    app.onchange = (e) => {
      const t = e.target;
      if (t.dataset.check) { if (t.checked) st.checked[t.dataset.check] = true; else delete st.checked[t.dataset.check]; }
      else if (t.dataset.pantry) { if (t.checked) st.pantryMissing[t.dataset.pantry] = true; else delete st.pantryMissing[t.dataset.pantry]; }
      else if (t.dataset.ess) { const x = st.essentials.find((e) => e.id === t.dataset.ess); x.on = t.checked; }
      else return;
      save(); render();
    };
    app.onclick = (e) => {
      const b = e.target.closest('[data-act],[data-essdel]');
      if (!b) return;
      if (b.dataset.essdel) { st.essentials = st.essentials.filter((x) => x.id !== b.dataset.essdel); save(); return render(); }
      const act = b.dataset.act;
      if (act === 'copy') copyList(sl);
      if (act === 'print') window.print();
      if (act === 'ics') downloadIcs();
    };
    $('#essForm').onsubmit = (e) => {
      e.preventDefault();
      const v = $('#essInput').value.trim();
      if (!v) return;
      st.essentials.push({ id: 'e' + Date.now(), name: v, on: true });
      save(); render();
    };
  }

  function copyList(sl) {
    const d = P.parseIso(st.plan.start);
    let txt = `🛒 REWE-Einkauf für ${P.WD[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.\n`;
    sl.groups.forEach((g) => {
      const items = g.items.filter((it) => !st.checked['i:' + it.key]);
      if (!items.length) return;
      txt += `\n${g.cat}\n` + items.map((it) => `☐ ${itemText(it)}`).join('\n') + '\n';
    });
    const miss = sl.pantry.filter((p) => st.pantryMissing[p.key] && !st.checked['p:' + p.key]);
    if (miss.length) txt += `\nVorrat\n` + miss.map((p) => `☐ ${p.name}`).join('\n') + '\n';
    const ess = st.essentials.filter((e) => e.on && !st.checked['e:' + e.id]);
    if (ess.length) txt += `\nEssentials\n` + ess.map((e) => `☐ ${e.name}`).join('\n') + '\n';
    const done = () => toast('📋 Offene Artikel kopiert – z. B. in Notizen oder WhatsApp einfügen');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    else fallbackCopy(txt, done);
  }
  function fallbackCopy(txt, cb) {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) { alert(txt); }
    ta.remove();
  }

  function downloadIcs() {
    const S = st.settings;
    let d = P.nextDelivery(P.addDays(today(), 1), S.deliveryDay);
    d = P.addDays(d, -1);
    const p2 = (n) => String(n).padStart(2, '0');
    const dt = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T180000`;
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${p2(now.getUTCMonth() + 1)}${p2(now.getUTCDate())}T${p2(now.getUTCHours())}${p2(now.getUTCMinutes())}00Z`;
    const url = location.href.split('#')[0];
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Veganer Wochenplaner//DE', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', `UID:vegan-wochenplaner-${Date.now()}@local`, `DTSTAMP:${stamp}`,
      `DTSTART:${dt}`, 'DURATION:PT20M', 'RRULE:FREQ=WEEKLY',
      'SUMMARY:🛒 REWE bestellen + neuer veganer Wochenplan',
      `DESCRIPTION:1. Planer öffnen: ${url}\\n2. Gerichte der Woche bewerten (👍/👎)\\n3. Woche abschließen → neuer Plan\\n4. Einkaufsliste in den REWE-Warenkorb legen und Lieferung bestätigen`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:REWE-Bestellung & Wochenplan', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'REWE-Wochenplan-Erinnerung.ics';
    a.click();
    toast('📅 Datei geladen – öffnen, um sie dem Kalender hinzuzufügen');
  }

  // ---------- Rezepte ----------
  function renderRecipes(app) {
    const inPlan = new Set();
    st.plan.days.forEach((d) => P.SLOTS.forEach((s) => d.meals[s] && inPlan.add(d.meals[s].id)));
    const q = recipeFilter.q.toLowerCase();
    const list = D.RECIPES.filter((r) => (recipeFilter.meal === 'all' || r.meal === recipeFilter.meal) &&
      (!q || r.name.toLowerCase().includes(q) || r.tags.join(' ').includes(q) || r.ingredients.some((i) => D.INGREDIENTS[i.k].name.toLowerCase().includes(q))))
      .sort((a, b) => P.prefScore(b, st) - P.prefScore(a, st));
    const mealBtn = (v, l) => `<button class="${recipeFilter.meal === v ? 'on' : ''}" data-meal="${v}">${l}</button>`;
    let html = `<h1>Rezepte</h1><p class="sub">${D.RECIPES.length} vegane, proteinreiche Rezepte – sortiert nach deinen Vorlieben. Klick öffnet das Rezept.</p>
      <div class="filters"><input type="text" id="rq" placeholder="Suchen: Tofu, Curry, schnell …" value="${esc(recipeFilter.q)}"/>
      <div class="seg">${mealBtn('all', 'Alle')}${mealBtn('breakfast', '🥣 Frühstück')}${mealBtn('main', '🍲 Hauptgerichte')}${mealBtn('snack', '💪 Snacks')}</div></div>
      <div class="recipes">`;
    list.forEach((r) => {
      const v = st.prefs.recipe[r.id] || 0;
      const ok = P.isEligible(r, st);
      html += `<div class="card rcard ${ok ? '' : 'banned'}" data-recipe="${r.id}">
        <h3>${esc(r.name)}</h3>
        <div class="meta">⏱ ${r.time} Min · 💪 ${r.protein} g Protein · ~${r.kcal} kcal</div>
        <div>${inPlan.has(r.id) ? '<span class="chip green">diese Woche</span>' : ''}${v > 0 ? '<span class="chip green">👍 Favorit</span>' : ''}${v < 0 && v > -99 ? '<span class="chip amber">👎 seltener</span>' : ''}${!ok ? '<span class="chip red">ausgeschlossen</span>' : ''}${r.tags.map((t) => `<span class="chip">${t}</span>`).join('')}</div>
      </div>`;
    });
    html += '</div>';
    app.innerHTML = html;
    const rq = $('#rq');
    rq.oninput = () => { recipeFilter.q = rq.value; const pos = rq.selectionStart; render(); const n = $('#rq'); n.focus(); n.setSelectionRange(pos, pos); };
    app.onclick = (e) => {
      const m = e.target.closest('[data-meal]');
      if (m) { recipeFilter.meal = m.dataset.meal; return render(); }
      const c = e.target.closest('[data-recipe]');
      if (c) openRecipe(c.dataset.recipe, st.settings.persons);
    };
    app.onchange = null;
  }

  // ---------- Rezept-Modal ----------
  function openRecipe(id, servings) {
    const r = P.RBY[id];
    servings = servings || st.settings.persons;
    const draw = () => {
      const v = st.prefs.recipe[id] || 0;
      const ings = r.ingredients.map((i) => {
        const I = D.INGREDIENTS[i.k];
        const q = i.k === 'salzpfeffer' ? 'nach' : P.fmtQty(i.q * servings, I.unit).replace(/^(\d+) Zehe$/, (m, n) => (n === '1' ? '1 Zehe' : `${n} Zehen`));
        return `<li><b>${q}</b> ${esc(I.name.replace(/ \(.*\)$/, ''))}${i.k === 'salzpfeffer' ? ' Geschmack' : ''}</li>`;
      }).join('');
      $('#modal').innerHTML = `<button class="icon-btn close" data-close>✕</button>
        <h1 style="padding-right:30px">${esc(r.name)}</h1>
        <p class="sub">⏱ ${r.time} Min · 💪 ${r.protein} g Protein & ~${r.kcal} kcal pro Portion</p>
        <div class="row" style="margin-bottom:14px"><span class="stepper"><button data-s="-1">−</button><b>${servings} ${servings === 1 ? 'Portion' : 'Portionen'}</b><button data-s="1">+</button></span>
          <div class="spacer"></div>
          <button class="btn small ${v > 0 ? 'primary' : ''}" data-r="1">👍 Lecker</button>
          <button class="btn small" data-r="-1">${v < 0 && v > -99 ? '✓ ' : ''}👎 Seltener</button>
          <button class="btn small" data-r="ban">${v <= -99 ? '↩︎ Wieder erlauben' : '🚫 Nie wieder'}</button></div>
        <h2 style="margin-top:0">Zutaten</h2><ul class="ing-list">${ings}</ul>
        <h2>Zubereitung</h2><ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
    };
    draw();
    $('#modalBg').hidden = false;
    $('#modal').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.close != null) return closeModal();
      if (b.dataset.s) { servings = Math.max(1, servings + +b.dataset.s); return draw(); }
      if (b.dataset.r) {
        const cur = st.prefs.recipe[id] || 0;
        if (b.dataset.r === 'ban') { P.setPref(st, 'recipe', id, cur <= -99 ? 0 : -99); toast(cur <= -99 ? 'Wieder erlaubt' : '🚫 Wird nicht mehr vorgeschlagen'); }
        else if (b.dataset.r === '1') P.setPref(st, 'recipe', id, cur > 0 ? 0 : 2);
        else P.setPref(st, 'recipe', id, cur < 0 && cur > -99 ? 0 : -2);
        save(); draw(); render();
      }
    };
  }
  function closeModal() { $('#modalBg').hidden = true; }

  // ---------- Feedback ----------
  const QUICK = ['tofu', 'tempeh', 'sojaschnetzel', 'veganes_hack', 'kichererbsen', 'linsen_rot', 'belugalinsen', 'kidneybohnen', 'edamame', 'champignons', 'avocado', 'suesskartoffel', 'brokkoli', 'zucchini', 'kokosmilch', 'erdnussmus', 'hummus', 'sojaskyr', 'proteinpulver', 'kraeuter', 'quinoa', 'linsennudeln'];
  const QUICK_TAGS = [['granola', 'Granola'], ['asiatisch', 'Asiatisch'], ['curry', 'Curry'], ['pasta', 'Pasta'], ['scharf', 'Scharf'], ['eintopf', 'Suppen & Eintöpfe'], ['salat', 'Salate'], ['bowl', 'Bowls'], ['mexikanisch', 'Mexikanisch'], ['ofen', 'Ofengerichte'], ['herzhaft', 'Herzhaftes Frühstück'], ['smoothie', 'Smoothies']];
  const EXAMPLES = ['Ich mag Granola zum Frühstück', 'Mehr Tofu, keine Pilze', 'Mehr Protein', 'Max 20 Minuten unter der Woche', 'Weniger scharf', 'Mittags esse ich in der Kantine', 'Ich bin allergisch gegen Erdnüsse', 'Jeden Tag Granola zum Frühstück', 'Wir sind 3 Personen'];

  function renderFeedback(app) {
    const pr = st.prefs;
    const label = (kind, k) => kind === 'ingredient' ? D.INGREDIENTS[k].name.replace(/ \(.*\)$/, '') : kind === 'tag' ? (QUICK_TAGS.find((x) => x[0] === k) || [k, k])[1] : P.RBY[k] ? P.RBY[k].name : k;
    const chipOf = (kind, k, v) => `<span class="chip ${v > 0 ? 'green' : v <= -99 ? 'red' : 'amber'}">${v > 0 ? '👍' : v <= -99 ? '🚫' : '👎'} ${esc(label(kind, k))}<button data-del="${kind}|${k}" title="Entfernen">✕</button></span>`;
    const prefChips = ['tag', 'ingredient', 'recipe'].flatMap((kind) => Object.entries(pr[kind]).sort((a, b) => b[1] - a[1]).map(([k, v]) => chipOf(kind, k, v))).join('');
    const qBtn = (kind, k, name) => {
      const v = pr[kind][k] || 0;
      return `<div><span>${esc(name)}</span><span><button class="icon-btn ${v > 0 ? 'on' : ''}" data-q="${kind}|${k}|1" title="mag ich">👍</button><button class="icon-btn ${v < 0 && v > -99 ? 'on neg' : ''}" data-q="${kind}|${k}|-1" title="mag ich nicht">👎</button><button class="icon-btn ${v <= -99 ? 'on neg' : ''}" data-q="${kind}|${k}|ban" title="nie (z. B. Allergie)">🚫</button></span></div>`;
    };

    let html = `<h1>Feedback</h1><p class="sub">Sag einfach, was dir schmeckt oder stört – der nächste Plan passt sich an. Je mehr Feedback, desto besser die Vorschläge.</p>
      <div class="fb-grid"><div>
        <div class="card"><h3>💬 Was soll sich ändern?</h3>
          <div class="examples">${EXAMPLES.map((x) => `<button data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>
          <textarea id="fbText" placeholder="z. B. „Ich mag Granola zum Frühstück, mehr asiatisch, keine Pilze, max 25 Minuten“"></textarea>
          <div class="row" style="margin-top:10px"><button class="btn primary" data-act="send">Feedback übernehmen</button><span class="sub" style="margin:0">Versteht: mag/liebe/mehr · kein/ohne/weniger · Allergie · „max 20 Minuten“ · Personen · Mittag/Reste · Frühstück</span></div>
          ${lastEffects ? `<ul class="effects">${lastEffects.length ? lastEffects.map((e) => `<li>${esc(e)}</li>`).join('') : '<li style="background:var(--amber-2)">Nicht automatisch erkannt. Formuliere z. B. „mag Tofu“, „keine Pilze“ oder „max 20 Minuten“ – oder nutze die Schnellauswahl rechts.</li>'}</ul>
          <div class="row" style="margin-top:10px"><button class="btn primary" data-act="apply">🎲 Plan jetzt mit Feedback neu erstellen</button><span class="sub" style="margin:0">gesperrte 🔒 Gerichte bleiben</span></div>` : ''}
        </div>
        <div class="card" style="margin-top:14px"><h3>🧠 Was der Planer über dich weiß</h3>
          <div class="pref-list" style="margin-top:8px">${prefChips || '<span class="sub">Noch keine Vorlieben.</span>'}</div>
          <p class="sub" style="margin:10px 0 0">Einstellungen: ${st.settings.persons} Pers. · max. ${st.settings.maxTime} Min · Frühstück: ${st.settings.breakfast ? st.settings.breakfastVariety + ' Variante(n)/Woche' : 'aus'} · Mittag: ${{ leftovers: 'Reste vom Vorabend', cook: 'frisch kochen', none: 'nicht planen' }[st.settings.lunchMode]} · Protein-Gewichtung ${st.settings.proteinWeight}</p>
        </div>
        <div class="card log" style="margin-top:14px"><h3 style="color:var(--ink)">📜 Verlauf</h3>
          ${st.feedbackLog.map((l) => `<div><q>${esc(l.text)}</q> – ${new Date(l.at).toLocaleDateString('de-DE')}<br>${l.effects.map(esc).join(' · ') || 'nicht erkannt'}</div>`).join('') || '<div>Noch kein Feedback.</div>'}
        </div>
      </div><div>
        <div class="card"><h3>⚡ Schnellauswahl – Geschmack</h3><div class="quick" style="margin-top:8px">${QUICK_TAGS.map(([k, n]) => qBtn('tag', k, n)).join('')}</div></div>
        <div class="card" style="margin-top:14px"><h3>🥦 Schnellauswahl – Zutaten</h3><div class="quick" style="margin-top:8px">${QUICK.map((k) => qBtn('ingredient', k, D.INGREDIENTS[k].name.replace(/ \(.*\)$/, '').replace(/ \/.*$/, ''))).join('')}</div></div>
      </div></div>`;
    app.innerHTML = html;
    app.onchange = null;
    app.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.ex) { const t = $('#fbText'); t.value = (t.value ? t.value.replace(/[.,\s]*$/, '') + ', ' : '') + b.dataset.ex; t.focus(); return; }
      if (b.dataset.del) { const [kind, k] = b.dataset.del.split('|'); P.setPref(st, kind, k, 0); save(); return render(); }
      if (b.dataset.q) {
        const [kind, k, v] = b.dataset.q.split('|');
        const cur = st.prefs[kind][k] || 0;
        const target = v === 'ban' ? -99 : v === '1' ? 2 : -2;
        P.setPref(st, kind, k, cur === target ? 0 : target);
        save(); return render();
      }
      if (b.dataset.act === 'send') {
        const t = $('#fbText').value;
        if (!t.trim()) return toast('Schreib kurz, was du magst oder nicht magst 🙂');
        lastEffects = P.applyFeedback(st, t);
        save(); render();
      }
      if (b.dataset.act === 'apply') { lastEffects = null; regen(true); go('plan'); }
    };
    const ta = $('#fbText');
    ta.onkeydown = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) $('[data-act=send]').click(); };
  }

  // ---------- Einstellungen ----------
  function renderSettings(app) {
    const S = st.settings;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${S[key] === v ? 'on' : ''}" data-set="${key}" data-val='${JSON.stringify(v)}'>${l}</button>`).join('')}</div>`;
    app.innerHTML = `<h1>Einstellungen</h1><p class="sub">Änderungen wirken beim nächsten „Neu mischen“ oder beim nächsten Wochenplan.</p>
      <div class="settings">
        <div class="card">
          <div class="field"><label>Haushalt</label>${seg('persons', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']])}<small>Personen, für die gekocht wird.</small></div>
          <div class="field"><label>REWE-Liefertag</label>${seg('deliveryDay', [[1, 'Mo'], [2, 'Di'], [3, 'Mi'], [4, 'Do'], [5, 'Fr'], [6, 'Sa']])}<small>Der Wochenplan beginnt am Liefertag.</small></div>
          <div class="field"><label>Max. Kochzeit Hauptgerichte: <b id="mtv">${S.maxTime} Min</b></label><input type="range" min="15" max="45" step="5" value="${S.maxTime}" id="maxTime" style="width:100%"/></div>
          <div class="field"><label>Proteinziel pro Person/Tag: <b id="ptv">${S.proteinTarget} g</b></label><input type="range" min="50" max="180" step="5" value="${S.proteinTarget}" id="proteinTarget" style="width:100%"/><small>Faustregel: ca. 1,0–1,6 g pro kg Körpergewicht, je nach Training.</small></div>
        </div>
        <div class="card">
          <div class="field"><label>Frühstück</label>${seg('breakfast', [[true, 'planen'], [false, 'nicht planen']])}</div>
          <div class="field"><label>Frühstücks-Varianten pro Woche</label>${seg('breakfastVariety', [[1, '1 (immer gleich)'], [2, '2 (Woche/Wochenende)'], [3, '3']])}<small>Weniger Varianten = kürzere Einkaufsliste.</small></div>
          <div class="field"><label>Mittagessen</label>${seg('lunchMode', [['leftovers', '♻️ Reste vom Vorabend'], ['cook', 'frisch kochen'], ['none', 'nicht planen']])}<small>„Reste“ spart am meisten Zeit: abends doppelt kochen, mittags mitnehmen.</small></div>
          <div class="field"><label>Täglicher Protein-Snack</label>${seg('snack', [[true, 'ja'], [false, 'nein']])}</div>
        </div>
        <div class="card">
          <div class="field"><label>REWE-Suchlink</label><input type="url" id="reweUrl" value="${esc(S.reweUrl)}"/><small>Wird für die „REWE ↗“-Buttons verwendet (Suchbegriff wird angehängt).</small></div>
          <div class="field"><label>Daten</label><div class="row">
            <button class="btn" data-act="export">⬇️ Backup exportieren</button>
            <label class="btn">⬆️ Backup importieren<input type="file" id="imp" accept="application/json" hidden/></label>
            <button class="btn ghost" data-act="reset">Alles zurücksetzen</button></div>
            <small>Alles wird nur lokal in diesem Browser gespeichert.</small></div>
          <button class="btn primary" data-act="regen">🎲 Plan mit neuen Einstellungen neu erstellen</button>
        </div>
      </div>`;
    app.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.set) { S[b.dataset.set] = JSON.parse(b.dataset.val); save(); return render(); }
      const act = b.dataset.act;
      if (act === 'regen') { regen(true); go('plan'); }
      if (act === 'export') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' }));
        a.download = `wochenplaner-backup-${P.iso(today())}.json`; a.click();
      }
      if (act === 'reset' && confirm('Wirklich alle Daten, Vorlieben und Pläne löschen?')) { localStorage.removeItem(KEY); location.reload(); }
    };
    app.onchange = (e) => {
      const t = e.target;
      if (t.id === 'reweUrl') { S.reweUrl = t.value.trim() || P.defaultState().settings.reweUrl; save(); toast('Gespeichert'); }
      if (t.id === 'imp' && t.files[0]) {
        t.files[0].text().then((txt) => { try { const s = JSON.parse(txt); if (!s.plan || !s.settings) throw 0; localStorage.setItem(KEY, txt); location.reload(); } catch (err) { alert('Ungültige Backup-Datei.'); } });
      }
    };
    app.oninput = (e) => {
      const t = e.target;
      if (t.id === 'maxTime') { S.maxTime = +t.value; $('#mtv').textContent = t.value + ' Min'; save(); }
      if (t.id === 'proteinTarget') { S.proteinTarget = +t.value; $('#ptv').textContent = t.value + ' g'; save(); }
    };
  }

  init();
})();
