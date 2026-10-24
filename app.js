/* UI des veganen Wochenplaners */
(function () {
  const D = window.VPData, P = window.VPPlanner, R = window.VPReceipts, VF = window.VPVisualFeedback;
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

  let st, tab = 'plan', recipeFilter = { q: '', meal: 'all' }, invSearch = '', lastEffects = null;
  let receiptDraft = null, scanProgress = null, showRawPaste = false;

  // ---------- Speicher ----------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const def = P.defaultState();
        s.settings = Object.assign(def.settings, s.settings);
        s.inventory = s.inventory || {};
        s.prices = s.prices || {};
        s.receipts = s.receipts || [];
        s.learnedAliases = s.learnedAliases || {};
        s.extraPurchases = s.extraPurchases || {};
        s.cookedMeals = s.cookedMeals || {};
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
    if (['plan', 'shop', 'inventory', 'recipes', 'feedback', 'settings'].includes(h)) tab = h;
    window.VPRefreshFeedbackTab = () => { if (tab === 'feedback') render(); };
    render();
  }
  function go(t) { tab = t; location.hash = t; render(); window.scrollTo(0, 0); if (VF) VF.refresh(); }

  function invCount() {
    if (!st || !st.inventory) return 0;
    return Object.keys(st.inventory).filter((k) => st.inventory[k] > 0 && D.INGREDIENTS[k] && !D.INGREDIENTS[k].pantry).length;
  }

  function render() {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    const open = openItemsCount();
    $('#shopBadge').textContent = open ? open : '';
    const ic = invCount();
    const invBadge = $('#invBadge');
    if (invBadge) invBadge.textContent = ic ? ic : '';
    const app = $('#app');
    ({
      plan: renderPlan,
      shop: renderShop,
      inventory: renderInventory,
      recipes: renderRecipes,
      feedback: renderFeedback,
      settings: renderSettings,
    })[tab](app);
    if (VF) VF.refresh();
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
    const costInfo = P.planCostSummary(st);
    const delivery = P.parseIso(plan.start);
    let html = '';

    if (st.firstRun) {
      html += `<div class="banner info"><p><b>Willkommen! 👋</b> Dein erster Plan ist fertig – Granola ist schon im Frühstück eingeplant.
        <span class="steps-onboard">
          <div><b>1.</b> Plan ansehen, mit 🔄 einzelne Gerichte tauschen oder mit 🔒 behalten.</div>
          <div><b>2.</b> Unter <b>📦 Inventar & Bons</b> deinen Kassenzettel (Foto/PDF) hochladen – Vorräte & Preise werden automatisch erkannt.</div>
          <div><b>3.</b> Unter <b>🛒 Einkauf</b> die mit dem Inventar verrechnete Liste abhaken und bei REWE bestellen.</div>
          <div><b>4.</b> Jede Woche: Woche abschließen → verbrauchte Zutaten werden vom Inventar abgezogen & der nächste Plan passt sich an.</div>
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
        <button class="btn" data-act="regen" title="Neuer Vorschlag – mit 🔒 gesperrte Gerichte bleiben & vorhandenes Inventar wird bevorzugt">🎲 Neu mischen</button>
        <button class="btn" data-act="newweek" title="Aktuelle Woche archivieren, verbrauchte Zutaten vom Inventar abziehen und Plan für die nächste Lieferung erstellen">⏭️ Woche abschließen</button>
        <button class="btn primary" data-go="shop">🛒 Zur Einkaufsliste</button>
      </div></div>`;

    html += `<div class="stats">
      <div class="stat"><b>${avgProtein} g</b><span>Protein pro Person/Tag (Ziel ${S.proteinTarget} g)</span><div class="bar"><i style="width:${Math.min(100, (avgProtein / S.proteinTarget) * 100)}%"></i></div></div>
      <div class="stat"><b>~${P.fmtPrice(costInfo.shopCost)}</b><span>Einkaufskosten (${costInfo.savedByInventory > 0 ? `${P.fmtPrice(costInfo.savedByInventory)} durch Inventar gespart` : `Ø ${P.fmtPrice(costInfo.avgPerServing)} / Portion`})</span></div>
      <div class="stat"><b>${cookCount}×</b><span>kochen pro Woche${S.lunchMode === 'leftovers' ? ' (Reste = Mittagessen)' : ''}</span></div>
      <div class="stat"><b>${openItemsCount()}</b><span>Artikel noch zu kaufen (${invCount()} im Inventar)</span></div>
      <div class="stat"><b>${Object.keys(st.prefs.ingredient).length + Object.keys(st.prefs.tag).length + Object.keys(st.prefs.recipe).length + Object.keys(st.learnedAliases || {}).length}</b><span>gelernte Vorlieben & Produkte</span></div>
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
        const cookKey = `${d.date}:${slot}`;
        const isCooked = !!(st.cookedMeals && st.cookedMeals[cookKey]);
        const portionPrice = P.recipeCost(st, r, 1);
        let meta = `⏱ ${r.time} Min · 💪 ${r.protein} g · ~${P.fmtPrice(portionPrice)}/Port.`;
        if (left) meta = `Reste vom Vorabend – nur aufwärmen/einpacken · 💪 ${r.protein} g`;
        else if (slot === 'dinner' && st.settings.lunchMode === 'leftovers' && m.servings > st.settings.persons) meta += ` · <b>${m.servings} Port.</b> kochen (Hälfte für morgen)`;
        else if ((slot === 'breakfast' || slot === 'snack') && i > 0 && plan.days[i - 1].meals[slot] && plan.days[i - 1].meals[slot].id === m.id) meta = `wie gestern · ⏱ ${r.time} Min · 💪 ${r.protein} g · ~${P.fmtPrice(portionPrice)}`;
        html += `<div class="meal ${left ? 'leftover' : ''} ${isCooked ? 'cooked' : ''}">
          <div class="ico">${left ? '♻️' : SLOT[slot].ico}</div>
          <div><div class="slot">${SLOT[slot].label}${d.locks[slot] ? ' · 🔒' : ''}${isCooked ? ' · <span class="cooked-tag">✓ gekocht</span>' : ''}</div>
            <div class="name" data-recipe="${r.id}" data-servings="${left ? st.settings.persons : m.servings}">${esc(r.name)}</div>
            <div class="meta">${meta}</div></div>
          <div class="acts no-print">${left ? '' : `
            <button class="icon-btn ${isCooked ? 'on' : ''}" data-cook="${i}" data-slot="${slot}" title="${isCooked ? 'Als gekocht markiert (Zutaten vom Inventar abgezogen) – Klick macht rückgängig' : 'Als gekocht markieren & Zutaten vom Inventar abziehen'}">✅</button>
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
      const b = e.target.closest('[data-act],[data-go],[data-recipe],[data-rate],[data-swap],[data-lock],[data-cook]');
      if (!b) return;
      if (b.dataset.go) return go(b.dataset.go);
      if (b.dataset.recipe) return openRecipe(b.dataset.recipe, +b.dataset.servings);
      if (b.dataset.rate) { rate(b.dataset.rate, +b.dataset.v); return; }
      if (b.dataset.cook != null) {
        const nowCooked = P.toggleCookedMeal(st, +b.dataset.cook, b.dataset.slot);
        save();
        toast(nowCooked ? '✅ Als gekocht markiert – Zutaten wurden vom Inventar abgezogen' : '↩︎ Koch-Markierung aufgehoben – Zutaten wieder im Inventar');
        return render();
      }
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
    save(); render(); toast('🎲 Neuer Vorschlag erstellt (vorhandenes Inventar berücksichtigt)');
  }

  function newWeek() {
    if (!weekOver() && !confirm('Aktuelle Woche abschließen? Verbrauchte Zutaten werden vom Inventar abgezogen und ein neuer Plan erstellt.')) return;
    P.archivePlan(st);
    let start = P.nextDelivery(today(), st.settings.deliveryDay);
    if (!weekOver() && P.iso(start) <= st.plan.start) start = P.nextDelivery(P.addDays(P.planEnd(st.plan), 1), st.settings.deliveryDay);
    st.plan = P.generatePlan(st, { start });
    st.checked = {}; st.pantryMissing = {};
    save(); render(); toast('✨ Neuer Wochenplan – Inventar & Feedback wurden berücksichtigt');
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
    const checkedIngredientCount = Object.keys(st.checked || {}).filter((k) => k.startsWith('i:') && st.checked[k]).length;
    const delivery = P.parseIso(st.plan.start);
    let html = `<div class="row"><div><h1>Einkaufsliste</h1>
      <p class="sub">Für die REWE-Lieferung am <b>${P.WD[delivery.getDay()]}, ${delivery.getDate()}.${delivery.getMonth() + 1}.</b> · Vorhandenes Inventar ist bereits automatisch abgezogen.</p></div>
      <div class="spacer"></div>
      <div class="row no-print">
        <button class="btn" data-go="inventory">🧾 Kassenzettel hochladen</button>
        <button class="btn" data-act="copy">📋 Liste kopieren</button>
        <button class="btn" data-act="print">🖨️ Drucken</button>
        <a class="btn rewe" href="https://shop.rewe.de/" target="_blank" rel="noopener">REWE Lieferservice öffnen ↗</a>
      </div></div>
      <div class="banner info no-print">
        <p><b>Geschätzter Warenkorb: ~${P.fmtPrice(sl.totalCost)}</b>${sl.savedByInventoryCost > 0 ? ` · <span class="saved-pill">🌱 ${P.fmtPrice(sl.savedByInventoryCost)} gespart durch dein Inventar</span>` : ''}
        <br><span style="font-size:13px;color:var(--muted)">Preise basieren auf deinen hochgeladenen Kassenzetteln (🧠) bzw. REWE-Richtpreisen.</span></p>
        <div class="row">
          ${checkedIngredientCount > 0 ? `<button class="btn small primary" data-act="book-checked" title="Alle abgehakten Zutaten direkt in deinen Vorratsbestand übernehmen">📦 ${checkedIngredientCount} abgehakte ins Inventar buchen</button>` : ''}
          <span class="progress">${done}/${list.length} erledigt</span>
        </div>
      </div>
      <div class="shop-grid"><div class="card">`;

    const itemRow = (id, qty, name, extra, search, priceHtml) => `<label class="item ${st.checked[id] ? 'done' : ''}">
        <input type="checkbox" data-check="${esc(id)}" ${st.checked[id] ? 'checked' : ''}/>
        <div><span class="q">${qty}</span><span class="nm">${esc(name)}</span>${priceHtml || ''}${extra ? `<div class="for">${extra}</div>` : ''}</div>
        ${search ? `<a class="rewe-link" href="${reweLink(search)}" target="_blank" rel="noopener" title="Bei REWE suchen: ${esc(search)}">REWE ↗</a>` : '<span></span>'}
      </label>`;

    sl.groups.forEach((g) => {
      html += `<div class="group"><h3>${g.cat}</h3>`;
      g.items.forEach((it) => {
        const I = D.INGREDIENTS[it.key];
        const pack = I.pack === 1 ? '' : ` <span class="for">(${I.packLabel})</span>`;
        const priceBadge = ` <span class="price-tag" title="${it.isLearnedPrice ? 'Gelernt aus deinen Kassenbons' : 'REWE-Richtpreis'}">${it.isLearnedPrice ? '🧠 ' : '~'}${P.fmtPrice(it.estCost)}</span>`;
        const invHint = it.fromInventory > 0 ? `<span class="inv-deduct">📦 ${P.fmtQty(it.fromInventory, it.unit)} im Inventar verrechnet</span> · ` : '';
        let extra = `${invHint}für: ${it.usedIn.map(esc).join(', ')}`;
        if (I.pack !== 1) {
          extra = `${invHint}benötigt ${P.fmtQty(it.need, it.unit)}${it.fromInventory > 0 ? ` (noch ${P.fmtQty(it.netNeed, it.unit)} offen)` : ''}${it.restPct > 0.25 ? ` · Rest ${P.fmtQty(it.rest, it.unit)} wandert ins Inventar` : ''} · für: ${it.usedIn.map(esc).join(', ')}`;
        }
        html += itemRow('i:' + it.key, qtyLabel(it), I.name, extra, I.search, pack + priceBadge);
      });
      html += '</div>';
    });

    if (sl.coveredByInventory && sl.coveredByInventory.length) {
      html += `<div class="group covered-group"><h3>✅ Komplett im Inventar vorrätig (${sl.coveredByInventory.length})</h3>`;
      sl.coveredByInventory.forEach((it) => {
        html += `<div class="item done covered-item">
          <span>📦</span>
          <div><span class="nm">${esc(it.name)}</span> <span class="chip green">vorrätig: ${P.fmtQty(it.inStock, it.unit)} (benötigt: ${P.fmtQty(it.need, it.unit)})</span>
          <div class="for">für: ${it.usedIn.map(esc).join(', ')}</div></div>
          <button class="btn small ghost" data-go="inventory">Bestand ändern</button>
        </div>`;
      });
      html += '</div>';
    }

    const missing = sl.pantry.filter((p) => st.pantryMissing[p.key]);
    if (missing.length) {
      html += `<div class="group"><h3>Vorrat nachkaufen</h3>`;
      missing.forEach((p) => {
        const priceBadge = ` <span class="price-tag">~${P.fmtPrice(p.packPrice)}</span>`;
        html += itemRow('p:' + p.key, '1×', p.name, '', D.INGREDIENTS[p.key].search, priceBadge);
      });
      html += '</div>';
    }
    const ess = st.essentials.filter((e) => e.on);
    if (ess.length) {
      html += `<div class="group"><h3>Essentials (jede Woche)</h3>`;
      ess.forEach((e) => { html += itemRow('e:' + e.id, '', e.name, '', e.name.replace(/\(.*?\)/g, '').trim(), ''); });
      html += '</div>';
    }
    html += `</div><div>
      <div class="card no-print"><h3>🧂 Gewürze & Öl prüfen</h3><p class="sub" style="margin:4px 0 8px">Diese Basics brauchst du diese Woche. Kreuze an, was <b>fehlt</b> – es landet dann auf der Liste.</p>
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
      const b = e.target.closest('[data-act],[data-essdel],[data-go]');
      if (!b) return;
      if (b.dataset.go) return go(b.dataset.go);
      if (b.dataset.essdel) { st.essentials = st.essentials.filter((x) => x.id !== b.dataset.essdel); save(); return render(); }
      const act = b.dataset.act;
      if (act === 'copy') copyList(sl);
      if (act === 'print') window.print();
      if (act === 'ics') downloadIcs();
      if (act === 'book-checked') {
        const count = P.addCheckedToInventory(st);
        save(); render();
        toast(`📦 ${count} gekaufte Artikel wurden deinem Inventar hinzugefügt!`);
      }
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
    let txt = `🛒 REWE-Einkauf für ${P.WD[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}. (~${P.fmtPrice(sl.totalCost)})\n`;
    sl.groups.forEach((g) => {
      const items = g.items.filter((it) => !st.checked['i:' + it.key]);
      if (!items.length) return;
      txt += `\n${g.cat}\n` + items.map((it) => `☐ ${itemText(it)} (~${P.fmtPrice(it.estCost)})`).join('\n') + '\n';
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

  // ---------- Inventar & Kassenzettel ----------
  function buildIngredientSelectOptions(selectedKey) {
    let html = `<option value="" ${!selectedKey ? 'selected' : ''}>➕ Extra / Haushalt (kein Rezept-Bestandteil)</option>`;
    D.CATS.forEach((cat, cIdx) => {
      const ings = Object.values(D.INGREDIENTS)
        .filter((i) => i.catIndex === cIdx)
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));
      if (!ings.length) return;
      html += `<optgroup label="${esc(cat)}">`;
      ings.forEach((i) => {
        html += `<option value="${i.key}" ${selectedKey === i.key ? 'selected' : ''}>${esc(i.name)} (${i.pack ? i.packLabel : i.unit})</option>`;
      });
      html += `</optgroup>`;
    });
    return html;
  }

  async function handleReceiptFile(file) {
    if (!file) return;
    scanProgress = { text: 'Starte Analyse …', pct: 10 };
    render();
    try {
      const text = await R.extractFromFile(file, (msg, pct) => {
        scanProgress = { text: msg, pct: pct || 50 };
        const bar = $('#scanBarFill');
        const lbl = $('#scanStatusText');
        if (bar) bar.style.width = scanProgress.pct + '%';
        if (lbl) lbl.textContent = scanProgress.text;
      });
      scanProgress = null;
      receiptDraft = R.parseReceiptText(text, st);
      if (!receiptDraft.items.length) {
        toast('⚠️ Keine eindeutigen Preiszeilen erkannt – du kannst den Text unten prüfen oder Positionen ergänzen.');
      } else {
        toast(`🧾 ${receiptDraft.items.length} Positionen auf dem Bon erkannt!`);
      }
      render();
    } catch (err) {
      scanProgress = null;
      alert(err.message || 'Fehler beim Auslesen der Datei.');
      render();
    }
  }

  function renderInventory(app) {
    const analytics = R.computeAnalytics(st);
    const invEntries = Object.entries(st.inventory || {})
      .filter(([k, q]) => q > 0 && D.INGREDIENTS[k] && !D.INGREDIENTS[k].pantry)
      .map(([k, q]) => ({ key: k, qty: q, I: D.INGREDIENTS[k] }))
      .filter((x) => !invSearch || x.I.name.toLowerCase().includes(invSearch.toLowerCase()) || x.I.cat.toLowerCase().includes(invSearch.toLowerCase()))
      .sort((a, b) => a.I.catIndex - b.I.catIndex || a.I.name.localeCompare(b.I.name, 'de'));

    const cookable = P.cookableWithInventory(st).slice(0, 6);

    let html = `<div class="row">
      <div>
        <h1>Inventar & Kassenzettel</h1>
        <p class="sub">Lade deinen Kassenzettel als <b>Foto oder PDF</b> hoch: Vorräte werden automatisch verbucht, Preise für Auswertungen gespeichert und zukünftige Einkaufslisten & Wochenpläne intelligent angepasst.</p>
      </div>
      <div class="spacer"></div>
      <div class="row no-print">
        <button class="btn" data-act="sample-rewe">🧾 Beispiel-REWE-Bon laden</button>
        <button class="btn" data-act="sample-bio">🧾 Beispiel-Biomarkt-Bon</button>
        <button class="btn primary" data-act="regen-from-inv" title="Wochenplan neu mischen und vorhandene Vorräte bevorzugt verplanen">🎲 Plan an Inventar anpassen</button>
      </div>
    </div>`;

    // KPI-Leiste
    html += `<div class="stats">
      <div class="stat"><b>${invEntries.length} Zutaten</b><span>aktuell auf Vorrat (~${P.fmtPrice(analytics.inventoryValue)} Warenwert)</span></div>
      <div class="stat"><b>${P.fmtPrice(analytics.totalSpentThisMonth)}</b><span>Ausgaben diesen Monat (${analytics.receiptCount} ${analytics.receiptCount === 1 ? 'Bon' : 'Bons'} gesamt)</span></div>
      <div class="stat"><b>${analytics. receiptCount ? P.fmtPrice(analytics.avgReceiptTotal) : '–'}</b><span>Ø Einkaufssumme pro Kassenzettel</span></div>
      <div class="stat"><b>${analytics.learnedProductCount} Produkte</b><span>im selbstlernenden Produkt-Gedächtnis</span></div>
    </div>`;

    // Smart-Essentials Hinweis, falls wiederkehrende Extra-Käufe erkannt wurden
    if (analytics.suggestedEssentials.length) {
      html += `<div class="banner info">
        <p><b>💡 Selbstlernender Vorschlag für deine Essentials:</b> Du hast ${analytics.suggestedEssentials.map((e) => `<b>„${esc(e.name)}“</b> (${e.count}×)`).join(', ')} mehrfach gekauft. Soll das automatisch auf deine wöchentliche Essentials-Einkaufsliste?</p>
        <div class="row">
          ${analytics.suggestedEssentials.map((e) => `<button class="btn small primary" data-add-ess="${esc(e.norm)}">⭐ „${esc(e.name)}“ zu Essentials</button><button class="btn small ghost" data-dismiss-ess="${esc(e.norm)}">Ignorieren</button>`).join('')}
        </div>
      </div>`;
    }

    // 1. Upload-Zone & Live-Prüf-Dialog
    html += `<div class="card upload-card">
      <div class="row" style="margin-bottom:10px">
        <h3>📸 Kassenzettel hochladen (Foto oder PDF – 100 % lokal im Browser)</h3>
        <div class="spacer"></div>
        <button class="btn small" data-act="toggle-paste">${showRawPaste ? 'Texteingabe schließen' : '📋 Bon-Text manuell einfügen'}</button>
      </div>
      <label class="dropzone" id="receiptDropzone">
        <input type="file" id="receiptFileInput" accept="image/*,application/pdf,.pdf" hidden />
        <div class="dropzone-inner">
          <div class="drop-ico">🧾</div>
          <div>
            <b>Kassenzettel-Foto oder REWE-PDF hier ablegen oder klicken zum Auswählen</b>
            <div class="sub" style="margin:2px 0 0">Unterstützt: PDF-Rechnungen (z. B. REWE Lieferservice / E-Bon) sowie Fotos (JPG, PNG, WebP) mit lokaler Texterkennung</div>
          </div>
        </div>
      </label>`;

    if (scanProgress) {
      html += `<div class="scan-progress">
        <div class="row"><b id="scanStatusText">${esc(scanProgress.text)}</b></div>
        <div class="bar"><i id="scanBarFill" style="width:${scanProgress.pct}%"></i></div>
      </div>`;
    }

    if (showRawPaste) {
      html += `<div class="paste-box" style="margin-top:12px">
        <textarea id="rawReceiptText" placeholder="Kassenbon-Text oder REWE-Bestellübersicht hier einfügen …&#10;Beispiel:&#10;REWE Bio Tofu Natur 200g 1,49 B&#10;2 x 0,99&#10;Kichererbsen 400g 1,98 B">${receiptDraft ? esc(receiptDraft.rawText) : ''}</textarea>
        <div class="row" style="margin-top:8px">
          <button class="btn primary small" data-act="parse-raw">🔍 Text analysieren</button>
        </div>
      </div>`;
    }

    // Prüf-Dialog für gescannten Bon
    if (receiptDraft) {
      const draftSum = receiptDraft.items.filter((x) => x.include).reduce((s, x) => s + (parseFloat(x.price) || 0), 0);
      html += `<div class="receipt-review">
        <div class="row review-header">
          <div>
            <h3>✅ Erkannte Positionen prüfen & verbuchen (${receiptDraft.items.length})</h3>
            <p class="sub" style="margin:0">Jede Bestätigung oder Korrektur merkt sich das System automatisch für den nächsten Kassenzettel.</p>
          </div>
          <div class="spacer"></div>
          <div class="row">
            <label class="inline-field">Markt: <input type="text" id="draftStore" value="${esc(receiptDraft.store)}" style="width:150px"/></label>
            <label class="inline-field">Datum: <input type="date" id="draftDate" value="${esc(receiptDraft.date)}" style="width:145px"/></label>
          </div>
        </div>
        <div class="table-wrap">
          <table class="inv-table">
            <thead>
              <tr>
                <th style="width:36px">✓</th>
                <th>Bon-Text & Erkennung</th>
                <th>Zugeordnete Zutat im System</th>
                <th style="width:140px">Menge (Gesamt)</th>
                <th style="width:110px">Preis (€)</th>
                <th style="width:40px"></th>
              </tr>
            </thead>
            <tbody>
              ${receiptDraft.items.map((it, idx) => {
                const I = it.ingKey ? D.INGREDIENTS[it.ingKey] : null;
                const badge = it.confidence === 'learned'
                  ? '<span class="chip green" title="Aus früheren Bons gelernt">🧠 gelernt</span>'
                  : it.ingKey
                  ? '<span class="chip green">✓ erkannt</span>'
                  : '<span class="chip amber">➕ Extra / Haushalt</span>';
                return `<tr class="${it.include ? '' : 'row-muted'}">
                  <td><input type="checkbox" data-draft-check="${idx}" ${it.include ? 'checked' : ''}/></td>
                  <td>
                    <input type="text" class="draft-raw" data-draft-raw="${idx}" value="${esc(it.rawName)}"/>
                    <div style="margin-top:3px">${badge}${it.count > 1 ? `<span class="chip">${it.count}× Packung</span>` : ''}</div>
                  </td>
                  <td>
                    <select data-draft-ing="${idx}">${buildIngredientSelectOptions(it.ingKey)}</select>
                  </td>
                  <td>
                    <div class="qty-input-group">
                      <input type="number" step="any" min="0" data-draft-qty="${idx}" value="${it.qty}" ${!I || I.pantry ? 'disabled' : ''}/>
                      <span>${I ? (I.pantry ? 'Vorrat' : esc(I.unit)) : 'Stk'}</span>
                    </div>
                  </td>
                  <td>
                    <input type="number" step="0.01" min="0" data-draft-price="${idx}" value="${Number(it.price || 0).toFixed(2)}"/>
                  </td>
                  <td><button class="icon-btn" data-draft-del="${idx}" title="Zeile entfernen">✕</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn small" data-act="draft-add-row">+ Zeile hinzufügen</button>
          <div class="spacer"></div>
          <span>Erfasste Summe: <b>${P.fmtPrice(draftSum)}</b></span>
          <button class="btn ghost" data-act="draft-cancel">Verwerfen</button>
          <button class="btn primary" data-act="draft-commit">📥 Bon verbuchen & System trainieren</button>
        </div>
      </div>`;
    }
    html += `</div>`;

    // 2. Zwei-Spalten-Layout: Links Inventar & Sofort kochbar, Rechts Preis- & Ausgaben-Auswertungen
    html += `<div class="inv-grid" style="margin-top:16px">
      <div>
        <div class="card">
          <div class="row" style="margin-bottom:10px">
            <h3>📦 Aktuelles Inventar (${invEntries.length})</h3>
            <div class="spacer"></div>
            <input type="text" id="invSearchInput" placeholder="Vorrat filtern …" value="${esc(invSearch)}" style="max-width:190px"/>
          </div>
          <form class="inv-add-form" id="invAddForm">
            <select id="invAddKey">${buildIngredientSelectOptions('tofu')}</select>
            <input type="number" step="any" min="0.1" id="invAddQty" value="200" style="width:95px" placeholder="Menge"/>
            <span id="invAddUnit" class="unit-pill">g</span>
            <button class="btn small primary" type="submit">+ Bestand buchen</button>
          </form>`;

    if (!invEntries.length) {
      html += `<div class="empty-state">Dein Inventar ist noch leer. Lade oben einen Kassenzettel hoch (oder klicke auf <b>„🧾 Beispiel-REWE-Bon laden“</b>), um deinen Bestand automatisch zu füllen!</div>`;
    } else {
      let currentCat = '';
      invEntries.forEach(({ key, qty, I }) => {
        if (I.cat !== currentCat) {
          if (currentCat) html += `</div>`;
          currentCat = I.cat;
          html += `<div class="group" style="margin-top:12px"><h3>${esc(currentCat)}</h3>`;
        }
        const step = I.pack > 0 ? (I.pack >= 100 ? 50 : 1) : 1;
        const pr = P.ingredientPackPrice(st, key);
        const estVal = I.pack > 0 ? (qty / I.pack) * pr : pr;
        html += `<div class="inv-row">
          <div>
            <b>${esc(I.name)}</b>
            <div class="for">${P.fmtQty(qty, I.unit)} vorrätig · Wert ~${P.fmtPrice(estVal)}</div>
          </div>
          <div class="row">
            <button class="btn small" data-inv-delta="${key}|${-step}" title="Weniger">−${step} ${I.unit}</button>
            <button class="btn small" data-inv-delta="${key}|${step}" title="Mehr">+${step} ${I.unit}</button>
            <button class="icon-btn" data-inv-clear="${key}" title="Aufgebraucht / Entfernen">🗑️</button>
          </div>
        </div>`;
      });
      if (currentCat) html += `</div>`;
    }

    html += `</div>`;

    // Was kann ich mit dem aktuellen Inventar sofort kochen?
    html += `<div class="card" style="margin-top:14px">
      <h3>🍳 Passende Rezepte für dein aktuelles Inventar</h3>
      <p class="sub" style="margin:4px 0 10px">Diese Gerichte nutzen deine vorhandenen Vorräte optimal aus (und werden beim „Neu mischen“ bevorzugt):</p>
      ${cookable.length ? `<div class="cookable-list">
        ${cookable.map((c) => `<div class="cookable-item" data-recipe="${c.recipe.id}">
          <div>
            <b>${esc(c.recipe.name)}</b>
            <div class="for">${c.missing.length === 0 ? '✅ Alle Zutaten komplett zuhause!' : `Fehlt nur: ${c.missing.map(esc).join(', ')}`}</div>
          </div>
          <span class="chip ${c.ratio === 1 ? 'green' : 'amber'}">${Math.round(c.ratio * 100)} % da</span>
        </div>`).join('')}
      </div>` : `<div class="sub">Sobald Vorräte im Inventar liegen, siehst du hier sofort kochbare Rezepte.</div>`}
    </div>
    </div>`;

    // Rechte Spalte: Preis-Auswertungen & Bon-Archiv
    html += `<div>
      <div class="card">
        <h3>📊 Ausgaben nach Kategorie</h3>
        <p class="sub" style="margin:4px 0 10px">Verteilung deiner bisherigen Einkäufe (${P.fmtPrice(analytics.totalSpentAllTime)} gesamt):</p>
        ${analytics.catBreakdown.length ? `<div class="cat-bars">
          ${analytics.catBreakdown.map((c) => `<div class="cat-bar-row">
            <div class="row" style="justify-content:space-between;font-size:13px">
              <span>${esc(c.cat)}</span>
              <b>${P.fmtPrice(c.amount)} (${c.pct} %)</b>
            </div>
            <div class="bar"><i style="width:${Math.max(4, c.pct)}%"></i></div>
          </div>`).join('')}
        </div>` : `<div class="sub">Noch keine Kassenzettel verbucht.</div>`}
      </div>

      <div class="card" style="margin-top:14px">
        <h3>🏷️ Preis-Gedächtnis & Preisentwicklung (${analytics.priceEntries.length})</h3>
        <p class="sub" style="margin:4px 0 10px">Gelernte Preise pro Standard-Packung aus deinen Kassenzetteln:</p>
        ${analytics.priceEntries.length ? `<div class="price-list">
          ${analytics.priceEntries.map((p) => {
            const trendBadge = p.trend === 'up'
              ? '<span class="chip red" title="Zuletzt teurer als im Schnitt">📈 teurer</span>'
              : p.trend === 'down'
              ? '<span class="chip green" title="Zuletzt günstiger als im Schnitt">📉 günstiger</span>'
              : '<span class="chip" title="Preis stabil">➡️ stabil</span>';
            return `<div class="price-row">
              <div>
                <b>${esc(p.name)}</b> <small class="for">(${esc(p.packLabel)})</small>
                <div class="for">Ø ${P.fmtPrice(p.avgPrice)} · Spanne ${P.fmtPrice(p.minPrice)}–${P.fmtPrice(p.maxPrice)} · ${p.count}× gekauft${p.lastStore ? ` (${esc(p.lastStore)})` : ''}</div>
              </div>
              <div style="text-align:right">
                <b>${P.fmtPrice(p.lastPrice)}</b>
                <div>${trendBadge}</div>
              </div>
            </div>`;
          }).join('')}
        </div>` : `<div class="sub">Nach dem ersten Kassenzettel-Upload erscheinen hier die echten Produktpreise und Trends.</div>`}
      </div>

      <div class="card" style="margin-top:14px">
        <h3>🧾 Hochgeladene Kassenzettel (${(st.receipts || []).length})</h3>
        ${(st.receipts || []).length ? `<div class="receipt-history">
          ${st.receipts.map((rc) => `<details class="receipt-entry">
            <summary>
              <span><b>${esc(rc.store)}</b> · ${fmtDate(rc.date)} <small class="for">(${rc.itemCount} Pos.)</small></span>
              <span><b>${P.fmtPrice(rc.total)}</b> <button class="icon-btn" data-del-receipt="${rc.id}" title="Bon aus Verlauf löschen">✕</button></span>
            </summary>
            <ul class="receipt-items-sub">
              ${(rc.items || []).map((it) => `<li><span>${esc(it.rawName)}${it.ingKey && D.INGREDIENTS[it.ingKey] ? ` → <b>${esc(D.INGREDIENTS[it.ingKey].name)}</b> (${P.fmtQty(it.qty, it.unit)})` : ''}</span><span>${P.fmtPrice(it.price)}</span></li>`).join('')}
            </ul>
          </details>`).join('')}
        </div>` : `<div class="sub" style="margin-top:6px">Noch keine Bons gespeichert.</div>`}
      </div>
    </div></div>`;

    app.innerHTML = html;

    // Event-Listener für Datei-Upload & Drag-and-Drop
    const fileInput = $('#receiptFileInput');
    const dropzone = $('#receiptDropzone');
    if (fileInput) {
      fileInput.onchange = () => { if (fileInput.files && fileInput.files[0]) handleReceiptFile(fileInput.files[0]); };
    }
    if (dropzone) {
      dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('dragover'); };
      dropzone.ondragleave = () => dropzone.classList.remove('dragover');
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleReceiptFile(e.dataTransfer.files[0]);
        }
      };
    }

    // Suchfeld im Inventar
    const invSearchEl = $('#invSearchInput');
    if (invSearchEl) {
      invSearchEl.oninput = () => {
        invSearch = invSearchEl.value;
        const pos = invSearchEl.selectionStart;
        render();
        const next = $('#invSearchInput');
        if (next) { next.focus(); next.setSelectionRange(pos, pos); }
      };
    }

    // Manuelles Hinzufügen zum Inventar
    const invAddKey = $('#invAddKey');
    const invAddQty = $('#invAddQty');
    const invAddUnit = $('#invAddUnit');
    if (invAddKey && invAddQty && invAddUnit) {
      const syncUnit = () => {
        const I = D.INGREDIENTS[invAddKey.value];
        if (I) {
          invAddUnit.textContent = I.unit;
          invAddQty.value = I.pack > 0 ? I.pack : 1;
        }
      };
      invAddKey.onchange = syncUnit;
    }
    const invAddForm = $('#invAddForm');
    if (invAddForm) {
      invAddForm.onsubmit = (e) => {
        e.preventDefault();
        const k = $('#invAddKey').value;
        const q = parseFloat($('#invAddQty').value);
        if (!k || !D.INGREDIENTS[k] || !(q > 0)) return toast('Bitte eine Zutat und gültige Menge wählen.');
        P.adjustInventory(st, k, q);
        save(); render();
        toast(`📦 +${P.fmtQty(q, D.INGREDIENTS[k].unit)} ${D.INGREDIENTS[k].name} ins Inventar gebucht`);
      };
    }

    // Änderungen im Prüf-Dialog (receiptDraft)
    app.onchange = (e) => {
      const t = e.target;
      if (!receiptDraft) return;
      if (t.id === 'draftStore') { receiptDraft.store = t.value.trim(); return; }
      if (t.id === 'draftDate') { receiptDraft.date = t.value; return; }
      if (t.dataset.draftCheck != null) {
        receiptDraft.items[+t.dataset.draftCheck].include = t.checked;
        render();
      } else if (t.dataset.draftRaw != null) {
        receiptDraft.items[+t.dataset.draftRaw].rawName = t.value;
      } else if (t.dataset.draftIng != null) {
        const idx = +t.dataset.draftIng;
        const it = receiptDraft.items[idx];
        it.ingKey = t.value;
        const I = it.ingKey ? D.INGREDIENTS[it.ingKey] : null;
        if (I) {
          it.unit = I.unit;
          it.qty = (I.pack > 0 ? I.pack : 1) * (it.count || 1);
          it.cat = I.cat;
        } else {
          it.unit = 'Stk';
          it.cat = 'Sonstiges / Haushalt';
        }
        render();
      } else if (t.dataset.draftQty != null) {
        receiptDraft.items[+t.dataset.draftQty].qty = parseFloat(t.value) || 0;
      } else if (t.dataset.draftPrice != null) {
        receiptDraft.items[+t.dataset.draftPrice].price = parseFloat(t.value) || 0;
        render();
      }
    };

    app.onclick = (e) => {
      const b = e.target.closest('[data-act],[data-inv-delta],[data-inv-clear],[data-draft-del],[data-del-receipt],[data-recipe],[data-add-ess],[data-dismiss-ess]');
      if (!b) return;

      if (b.dataset.recipe) return openRecipe(b.dataset.recipe, st.settings.persons);

      if (b.dataset.invDelta) {
        const [k, d] = b.dataset.invDelta.split('|');
        P.adjustInventory(st, k, parseFloat(d));
        save(); return render();
      }
      if (b.dataset.invClear) {
        delete st.inventory[b.dataset.invClear];
        save(); toast('Aus dem Inventar entfernt'); return render();
      }
      if (b.dataset.draftDel != null && receiptDraft) {
        receiptDraft.items.splice(+b.dataset.draftDel, 1);
        return render();
      }
      if (b.dataset.delReceipt) {
        e.preventDefault();
        st.receipts = (st.receipts || []).filter((r) => r.id !== b.dataset.delReceipt);
        save(); return render();
      }
      if (b.dataset.addEss) {
        const norm = b.dataset.addEss;
        const ex = st.extraPurchases && st.extraPurchases[norm];
        if (ex) {
          st.essentials.push({ id: 'e' + Date.now(), name: ex.name, on: true });
          ex.dismissed = true;
          save(); toast(`⭐ „${ex.name}“ zu deinen Essentials hinzugefügt!`);
          return render();
        }
      }
      if (b.dataset.dismissEss) {
        const norm = b.dataset.dismissEss;
        if (st.extraPurchases && st.extraPurchases[norm]) {
          st.extraPurchases[norm].dismissed = true;
          save(); return render();
        }
      }

      const act = b.dataset.act;
      if (act === 'sample-rewe') {
        receiptDraft = R.parseReceiptText(R.SAMPLE_RECEIPTS[0].text, st);
        toast('🧾 Beispiel-REWE-Kassenzettel geladen – unten prüfen & verbuchen!');
        render();
      } else if (act === 'sample-bio') {
        receiptDraft = R.parseReceiptText(R.SAMPLE_RECEIPTS[1].text, st);
        toast('🧾 Beispiel-Biomarkt-Bon geladen – unten prüfen & verbuchen!');
        render();
      } else if (act === 'toggle-paste') {
        showRawPaste = !showRawPaste;
        render();
      } else if (act === 'parse-raw') {
        const txt = ($('#rawReceiptText') && $('#rawReceiptText').value) || '';
        if (!txt.trim()) return toast('Bitte zuerst Bon-Text einfügen.');
        receiptDraft = R.parseReceiptText(txt, st);
        toast(`🔍 ${receiptDraft.items.length} Positionen erkannt`);
        render();
      } else if (act === 'draft-add-row' && receiptDraft) {
        receiptDraft.items.push({
          id: 'ri_manual_' + Date.now(),
          include: true,
          rawName: 'Neuer Artikel',
          count: 1,
          ingKey: 'tofu',
          confidence: 'manual',
          qty: 200,
          unit: 'g',
          price: 1.49,
          unitPrice: 1.49,
          cat: D.INGREDIENTS.tofu.cat,
        });
        render();
      } else if (act === 'draft-cancel') {
        receiptDraft = null;
        render();
      } else if (act === 'draft-commit' && receiptDraft) {
        const res = R.commitReceipt(st, receiptDraft);
        receiptDraft = null;
        showRawPaste = false;
        save();
        render();
        toast(`✅ Bon verbucht: ${res.inventoryAddedCount} Vorräte + ${res.pricesUpdatedCount} Preise gespeichert!`);
      } else if (act === 'regen-from-inv') {
        regen(true);
        go('plan');
      }
    };
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
      const costPerPortion = P.recipeCost(st, r, 1);
      html += `<div class="card rcard ${ok ? '' : 'banned'}" data-recipe="${r.id}">
        <h3>${esc(r.name)}</h3>
        <div class="meta">⏱ ${r.time} Min · 💪 ${r.protein} g Protein · ~${r.kcal} kcal · ~${P.fmtPrice(costPerPortion)}/Port.</div>
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
      const totalRecipeCost = P.recipeCost(st, r, servings);
      const ings = r.ingredients.map((i) => {
        const I = D.INGREDIENTS[i.k];
        const needed = i.q * servings;
        const inStock = (st.inventory && st.inventory[i.k]) || 0;
        const stockBadge = !I.pantry && inStock > 0
          ? ` <span class="chip ${inStock >= needed ? 'green' : 'amber'}">📦 ${P.fmtQty(inStock, I.unit)} da</span>`
          : '';
        const q = i.k === 'salzpfeffer' ? 'nach' : P.fmtQty(needed, I.unit).replace(/^(\d+) Zehe$/, (m, n) => (n === '1' ? '1 Zehe' : `${n} Zehen`));
        return `<li><b>${q}</b> ${esc(I.name.replace(/ \(.*\)$/, ''))}${i.k === 'salzpfeffer' ? ' Geschmack' : ''}${stockBadge}</li>`;
      }).join('');
      $('#modal').innerHTML = `<button class="icon-btn close" data-close>✕</button>
        <h1 style="padding-right:30px">${esc(r.name)}</h1>
        <p class="sub">⏱ ${r.time} Min · 💪 ${r.protein} g Protein & ~${r.kcal} kcal pro Portion · <b>~${P.fmtPrice(totalRecipeCost)}</b> für ${servings} ${servings === 1 ? 'Portion' : 'Portionen'}</p>
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

    const vfItems = VF ? VF.getItems() : [];
    const vfPrompt = VF ? VF.buildPromptText() : '';

    let html = `<h1>Feedback & Weiterentwicklung</h1><p class="sub">Passe deinen Essensplan per Sprache an – oder markiere mit dem Screenshot-Werkzeug (wie <code>Cmd + Shift + 4</code>) direkt Stellen auf dem Bildschirm, um Änderungswünsche als gebündelten Prompt zu sammeln.</p>
      <div class="card" style="margin-bottom:16px;border:1px solid var(--green)">
        <div class="row">
          <div>
            <h3>🎯 Visuelles Bildschirm-Feedback (Screenshot-Markierung → Prompt)</h3>
            <p class="sub" style="margin:4px 0 0">Ziehe wie bei <code>Cmd + Shift + 4</code> ein Rechteck über einen Bereich auf jeder beliebigen Seite (auch unten rechts über den Floating-Button erreichbar). Alle Punkte werden hier als fertiger Prompt gebündelt.</p>
          </div>
          <div class="spacer"></div>
          <div class="row">
            <button class="btn primary" data-act="vf-mark">🎯 Bereich auf Bildschirm markieren</button>
            ${vfItems.length ? `<button class="btn" data-act="vf-copy">📋 Gebündelten Prompt kopieren (${vfItems.length})</button>` : ''}
          </div>
        </div>
        ${vfItems.length ? `<div style="margin-top:12px">
          <textarea readonly style="min-height:120px;font-family:monospace;font-size:12.5px;background:#f9faf7">${esc(vfPrompt)}</textarea>
        </div>` : ''}
      </div>

      <div class="fb-grid"><div>
        <div class="card"><h3>💬 Geschmack & Planer-Regeln anpassen</h3>
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
      if (b.dataset.act === 'vf-mark' && VF) { VF.startSelectionMode(); return; }
      if (b.dataset.act === 'vf-copy' && VF) { VF.copyPrompt(); return; }
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
          <div class="field"><label>Daten (inkl. Inventar, Kassenbons & Preis-Gedächtnis)</label><div class="row">
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
      if (act === 'reset' && confirm('Wirklich alle Daten, Vorlieben, Inventar und Pläne löschen?')) { localStorage.removeItem(KEY); location.reload(); }
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
