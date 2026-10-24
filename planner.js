/* Planungslogik (DOM-frei, testbar). */
(function (root) {
  const D = root.VPData;
  const RBY = Object.fromEntries(D.RECIPES.map((r) => [r.id, r]));
  const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
  const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  // ---------- Hilfsfunktionen ----------
  function rngFrom(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function nextDelivery(today, deliveryDay) {
    let d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (let i = 0; i < 7 && d.getDay() !== deliveryDay; i++) d = addDays(d, 1);
    return d;
  }

  function defaultState() {
    return {
      version: 1,
      settings: {
        persons: 2,
        deliveryDay: 6, // Samstag
        breakfast: true,
        lunchMode: 'leftovers', // leftovers | cook | none
        maxTime: 40,
        breakfastVariety: 2,
        snack: true,
        proteinTarget: 100,
        proteinWeight: 1,
        reweUrl: 'https://shop.rewe.de/productList?search=',
      },
      prefs: { recipe: {}, ingredient: {}, tag: {} },
      feedbackLog: [],
      history: [], // [{start, ids:[]}]
      essentials: [
        { id: 'e1', name: 'Obst zum Snacken (z. B. Äpfel, Mandarinen)', on: true },
        { id: 'e2', name: 'Kaffee / Tee', on: false },
        { id: 'e3', name: 'Haushalt: Spülmittel, Küchenrolle …', on: false },
      ],
      checked: {},
      pantryMissing: {},
      inventory: {},       // { [ingKey]: mengeInBasiseinheit }
      prices: {},          // { [ingKey]: { lastPrice, avgPrice, minPrice, maxPrice, packSize, updatedAt, history: [{date, price, store}] } }
      receipts: [],        // [{ id, date, store, total, itemCount, items: [...] }]
      learnedAliases: {},  // { [normText]: { ingKey, packQty, label, lastPrice, count } }
      extraPurchases: {},  // { [normText]: { name, count, lastPrice, dismissed } }
      cookedMeals: {},     // { ["YYYY-MM-DD:slot"]: true }
      plan: null,
    };
  }

  // ---------- Bewertung ----------
  function isEligible(r, st) {
    const p = st.prefs;
    if ((p.recipe[r.id] || 0) <= -99) return false;
    if (r.time > st.settings.maxTime && r.meal === 'main') return false;
    for (const ing of r.ingredients) if ((p.ingredient[ing.k] || 0) <= -99) return false;
    for (const t of r.tags) if ((p.tag[t] || 0) <= -99) return false;
    return true;
  }

  function prefScore(r, st) {
    const p = st.prefs;
    let s = 0;
    s += 2.5 * (p.recipe[r.id] || 0);
    const seen = new Set();
    for (const ing of r.ingredients) {
      if (seen.has(ing.k)) continue; seen.add(ing.k);
      const v = p.ingredient[ing.k] || 0;
      s += v > 0 ? v * 1.2 : v * 1.5;
    }
    for (const t of r.tags) s += (p.tag[t] || 0) * 1.6;
    s += (r.protein - 25) * 0.08 * (st.settings.proteinWeight || 1);
    s -= (r.time / 60) * 0.6;
    const h = st.history || [];
    if (h[0] && h[0].ids.includes(r.id)) s -= 2.5;
    if (h[1] && h[1].ids.includes(r.id)) s -= 1.0;
    return s;
  }

  // Zusätzliche Packungen, die ein Rezept mit n Portionen zum bisherigen Einkauf hinzufügt (unter Berücksichtigung des Inventars)
  function addedPacks(r, servings, need, st) {
    let added = 0;
    const inv = (st && st.inventory) || {};
    for (const ing of r.ingredients) {
      const I = D.INGREDIENTS[ing.k];
      if (!I || I.pantry || !I.pack) continue;
      const inStock = inv[ing.k] || 0;
      const before = Math.max(0, (need[ing.k] || 0) - inStock);
      const after = Math.max(0, (need[ing.k] || 0) + ing.q * servings - inStock);
      added += packsFor(after, I.pack) - packsFor(before, I.pack);
    }
    return added;
  }

  // Bonus, wenn ein Rezept vorhandenes Inventar sinnvoll aufbraucht
  function inventoryBonus(r, servings, need, st) {
    const inv = (st && st.inventory) || {};
    let bonus = 0;
    for (const ing of r.ingredients) {
      const I = D.INGREDIENTS[ing.k];
      if (!I || I.pantry) continue;
      const inStock = inv[ing.k] || 0;
      const alreadyUsed = need[ing.k] || 0;
      const avail = Math.max(0, inStock - alreadyUsed);
      if (avail > 0) {
        const covered = Math.min(avail, ing.q * servings) / (ing.q * servings);
        bonus += covered * 0.85;
      }
    }
    return bonus;
  }

  function packsFor(q, pack) { return q <= 0 ? 0 : Math.max(1, Math.ceil(q / pack - 0.05)); }
  function addNeed(r, servings, need) {
    for (const ing of r.ingredients) need[ing.k] = (need[ing.k] || 0) + ing.q * servings;
  }

  function pickBest(cands, st, servings, need, rng, extra) {
    let best = null, bestS = -Infinity;
    for (const r of cands) {
      let s = prefScore(r, st) - 0.55 * addedPacks(r, servings, need, st) + inventoryBonus(r, servings, need, st) + rng() * 1.6;
      if (extra) s += extra(r);
      if (s > bestS) { bestS = s; best = r; }
    }
    return best;
  }

  // ---------- Plan erzeugen ----------
  function generatePlan(st, opts) {
    opts = opts || {};
    const rng = rngFrom(opts.seed != null ? opts.seed : Date.now());
    const S = st.settings;
    const start = opts.start || (st.plan && opts.keepStart ? parseIso(st.plan.start) : nextDelivery(opts.today || new Date(), S.deliveryDay));
    const old = opts.keepLocks && st.plan ? st.plan : null;
    const nDays = 7;
    const P = S.persons;
    const need = {};
    const days = [];
    for (let i = 0; i < nDays; i++) {
      const date = addDays(start, i);
      days.push({ date: iso(date), weekday: date.getDay(), meals: { breakfast: null, lunch: null, dinner: null, snack: null }, locks: {} });
    }

    // Gesperrte Mahlzeiten übernehmen
    const used = new Set();
    if (old) {
      old.days.forEach((od, i) => {
        if (!days[i]) return;
        for (const slot of SLOTS) {
          if (od.locks && od.locks[slot] && od.meals[slot]) {
            days[i].meals[slot] = Object.assign({}, od.meals[slot]);
            days[i].locks[slot] = true;
            if (slot !== 'breakfast') used.add(od.meals[slot].id);
          }
        }
      });
    }

    let mains = D.RECIPES.filter((r) => r.meal === 'main' && isEligible(r, st));
    if (mains.length < 4) {
      // zu streng gefiltert (z. B. sehr kurze Kochzeit) -> Zeitlimit lockern statt leerem Plan
      const relaxed = Object.assign({}, st, { settings: Object.assign({}, S, { maxTime: 999 }) });
      mains = D.RECIPES.filter((r) => r.meal === 'main' && isEligible(r, relaxed));
    }
    const breakfasts = D.RECIPES.filter((r) => r.meal === 'breakfast' && isEligible(r, st));
    const leftovers = S.lunchMode === 'leftovers';

    const tagCount = {};
    const countTags = (r) => r.tags.forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; });
    const NEUTRAL = ['mealprep', 'schnell', 'kalt'];
    const varietyPenalty = (c) => c.tags.reduce((s, t) => s - (NEUTRAL.includes(t) ? 0 : 0.9 * (tagCount[t] || 0)), 0);
    days.forEach((d) => d.locks.dinner && d.meals.dinner && countTags(RBY[d.meals.dinner.id]));

    // Abendessen
    for (let i = 0; i < nDays; i++) {
      const d = days[i];
      const servings = leftovers && i < nDays - 1 ? P * 2 : P;
      if (d.locks.dinner) {
        d.meals.dinner.servings = servings;
        addNeed(RBY[d.meals.dinner.id], servings, need);
        continue;
      }
      let pool = mains.filter((r) => !used.has(r.id));
      if (!pool.length) pool = mains.slice();
      if (!pool.length) break;
      const prevTag = i > 0 && d && days[i - 1].meals.dinner ? RBY[days[i - 1].meals.dinner.id].tags : [];
      const r = pickBest(pool, st, servings, need, rng, (c) => {
        let s = 0;
        if (leftovers && c.tags.includes('mealprep')) s += 0.6;
        if (c.tags.some((t) => prevTag.includes(t) && t !== 'mealprep' && t !== 'schnell')) s -= 0.8;
        return s + varietyPenalty(c);
      });
      d.meals.dinner = { id: r.id, servings };
      countTags(r);
      used.add(r.id);
      addNeed(r, servings, need);
    }

    // Mittagessen
    for (let i = 0; i < nDays; i++) {
      const d = days[i];
      if (S.lunchMode === 'none') { d.meals.lunch = null; continue; }
      if (leftovers && i > 0) {
        const prev = days[i - 1].meals.dinner;
        d.meals.lunch = prev ? { id: prev.id, servings: 0, leftoverOf: i - 1 } : null;
        d.locks.lunch = false;
        continue;
      }
      if (d.locks.lunch && d.meals.lunch && !d.meals.lunch.leftoverOf) {
        d.meals.lunch.servings = P;
        addNeed(RBY[d.meals.lunch.id], P, need);
        continue;
      }
      let pool = mains.filter((r) => !used.has(r.id));
      if (!pool.length) pool = mains.slice();
      if (!pool.length) break;
      const r = pickBest(pool, st, P, need, rng, (c) => (c.time <= 20 ? 1.2 : 0) + (c.tags.includes('kalt') ? 0.5 : 0) + varietyPenalty(c));
      countTags(r);
      d.meals.lunch = { id: r.id, servings: P };
      used.add(r.id);
      addNeed(r, P, need);
    }

    // Frühstück
    if (S.breakfast) {
      const v = clamp(S.breakfastVariety || 2, 1, 4);
      const groups = []; // Liste von Tagesindizes je Frühstücksvariante
      if (v === 1) groups.push(days.map((_, i) => i));
      else {
        const wk = [], we = [];
        days.forEach((d, i) => ((d.weekday === 0 || d.weekday === 6) ? we : wk).push(i));
        const nWk = v - 1;
        for (let g = 0; g < nWk; g++) groups.push(wk.filter((_, j) => j % nWk === g));
        groups.push(we);
      }
      const usedB = new Set();
      for (const g of groups) {
        if (!g.length) continue;
        const free = g.filter((i) => !days[i].locks.breakfast);
        g.filter((i) => days[i].locks.breakfast).forEach((i) => { days[i].meals.breakfast.servings = P; addNeed(RBY[days[i].meals.breakfast.id], P, need); });
        if (!free.length) continue;
        let pool = breakfasts.filter((r) => !usedB.has(r.id));
        if (!pool.length) pool = breakfasts.slice();
        if (!pool.length) break;
        const servings = P * free.length;
        const isWeekend = free.every((i) => days[i].weekday === 0 || days[i].weekday === 6);
        const r = pickBest(pool, st, servings, need, rng, (c) => (isWeekend ? (c.tags.includes('wochenende') ? 0.8 : 0) : (c.time > 10 && !c.tags.includes('mealprep') ? -1.5 : 0)));
        usedB.add(r.id);
        free.forEach((i) => { days[i].meals.breakfast = { id: r.id, servings: P }; });
        addNeed(r, servings, need);
      }
    }

    // Protein-Snack (eine Sorte für die ganze Woche)
    if (S.snack) {
      const snacks = D.RECIPES.filter((r) => r.meal === 'snack' && isEligible(r, st));
      const lockedSnack = days.find((d) => d.locks.snack && d.meals.snack);
      const r = lockedSnack ? RBY[lockedSnack.meals.snack.id] : (snacks.length ? pickBest(snacks, st, P * nDays, need, rng) : null);
      if (r) {
        days.forEach((d) => { d.meals.snack = { id: r.id, servings: P }; d.locks.snack = !!lockedSnack; });
        addNeed(r, P * nDays, need);
      }
    }

    return { start: iso(start), createdAt: new Date().toISOString(), days, rated: {} };
  }

  // Einzelne Mahlzeit tauschen (nächstbeste Alternative)
  function swapMeal(st, dayIdx, slot, seed) {
    const plan = st.plan;
    const d = plan.days[dayIdx];
    const cur = d.meals[slot];
    if (!cur || cur.leftoverOf != null) return false;
    const rng = rngFrom(seed != null ? seed : Date.now());
    const need = shoppingNeed(plan, { skipDay: dayIdx, skipSlot: slot });
    const meal = slot === 'breakfast' || slot === 'snack' ? slot : 'main';
    const inPlan = new Set();
    plan.days.forEach((x) => SLOTS.forEach((s) => x.meals[s] && inPlan.add(x.meals[s].id)));
    let pool = D.RECIPES.filter((r) => r.meal === meal && isEligible(r, st) && !inPlan.has(r.id));
    if (!pool.length) pool = D.RECIPES.filter((r) => r.meal === meal && isEligible(r, st) && r.id !== cur.id);
    if (!pool.length) return false;
    if (slot === 'breakfast' || slot === 'snack') {
      const idxs = plan.days.map((x, i) => (x.meals[slot] && x.meals[slot].id === cur.id ? i : -1)).filter((i) => i >= 0);
      const r = pickBest(pool, st, st.settings.persons * idxs.length, need, rng);
      idxs.forEach((i) => { plan.days[i].meals[slot] = { id: r.id, servings: st.settings.persons }; });
      return r;
    }
    const r = pickBest(pool, st, cur.servings, need, rng);
    d.meals[slot] = { id: r.id, servings: cur.servings };
    if (slot === 'dinner' && plan.days[dayIdx + 1] && plan.days[dayIdx + 1].meals.lunch && plan.days[dayIdx + 1].meals.lunch.leftoverOf === dayIdx) {
      plan.days[dayIdx + 1].meals.lunch.id = r.id;
    }
    return r;
  }

  // ---------- Einkauf ----------
  function shoppingNeed(plan, skip) {
    const need = {};
    if (!plan) return need;
    plan.days.forEach((d, i) => {
      for (const slot of SLOTS) {
        const m = d.meals[slot];
        if (!m || !m.servings) continue;
        if (skip && skip.skipDay === i && skip.skipSlot === slot) continue;
        if (skip && (skip.skipSlot === 'breakfast' || skip.skipSlot === 'snack') && slot === skip.skipSlot && plan.days[skip.skipDay].meals[slot] && m.id === plan.days[skip.skipDay].meals[slot].id) continue;
        addNeed(RBY[m.id], m.servings, need);
      }
    });
    return need;
  }

  // ---------- Preise & Kosten ----------
  function ingredientPackPrice(st, key) {
    const I = D.INGREDIENTS[key];
    if (!I) return 1.49;
    const pr = st && st.prices && st.prices[key];
    if (pr && pr.lastPrice > 0) return pr.lastPrice;
    return I.defaultPrice || 1.49;
  }

  function recipeCost(st, r, servings) {
    servings = servings || 1;
    let cost = 0;
    for (const ing of r.ingredients) {
      const I = D.INGREDIENTS[ing.k];
      if (!I || I.pantry || !I.pack) continue;
      const packPrice = ingredientPackPrice(st, ing.k);
      cost += ((ing.q * servings) / I.pack) * packPrice;
    }
    return Math.round(cost * 100) / 100;
  }

  function fmtPrice(v) {
    return (Number(v) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function shoppingList(st) {
    const plan = st.plan;
    const inv = (st && st.inventory) || {};
    const need = {}, usedIn = {};
    if (plan) plan.days.forEach((d) => {
      for (const slot of SLOTS) {
        const m = d.meals[slot];
        if (!m || !m.servings) continue;
        const r = RBY[m.id];
        for (const ing of r.ingredients) {
          need[ing.k] = (need[ing.k] || 0) + ing.q * m.servings;
          (usedIn[ing.k] = usedIn[ing.k] || new Set()).add(r.name);
        }
      }
    });
    const groups = {}, pantry = [], coveredByInventory = [];
    let totalCost = 0, savedByInventoryCost = 0;

    for (const [k, q] of Object.entries(need)) {
      const I = D.INGREDIENTS[k];
      const inStock = Math.max(0, inv[k] || 0);
      const fromInventory = Math.min(q, inStock);
      const netNeed = Math.max(0, q - fromInventory);
      const packPrice = ingredientPackPrice(st, k);

      const item = {
        key: k,
        name: I.name,
        need: q,
        inStock,
        fromInventory,
        netNeed,
        unit: I.unit,
        search: I.search,
        usedIn: [...usedIn[k]],
        packPrice,
        isLearnedPrice: !!(st.prices && st.prices[k] && st.prices[k].lastPrice > 0),
      };

      if (I.pantry) {
        if (k !== 'salzpfeffer') {
          item.estCost = st.pantryMissing && st.pantryMissing[k] ? packPrice : 0;
          if (item.estCost) totalCost += item.estCost;
          pantry.push(item);
        }
        continue;
      }

      const grossPacks = packsFor(q, I.pack);
      item.packs = netNeed > 0 ? packsFor(netNeed, I.pack) : 0;
      item.savedPacks = Math.max(0, grossPacks - item.packs);
      item.packLabel = I.packLabel;
      item.rest = Math.max(0, item.packs * I.pack - netNeed);
      item.restPct = item.packs > 0 ? item.rest / (item.packs * I.pack) : 0;
      item.estCost = Math.round(item.packs * packPrice * 100) / 100;
      totalCost += item.estCost;
      savedByInventoryCost += item.savedPacks * packPrice;

      if (item.packs === 0) {
        coveredByInventory.push(item);
      } else {
        (groups[I.cat] = groups[I.cat] || []).push(item);
      }
    }
    const out = D.CATS.filter((c) => groups[c]).map((c) => ({ cat: c, items: groups[c].sort((a, b) => a.name.localeCompare(b.name, 'de')) }));
    pantry.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    coveredByInventory.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return {
      groups: out,
      pantry,
      coveredByInventory,
      totalCost: Math.round(totalCost * 100) / 100,
      savedByInventoryCost: Math.round(savedByInventoryCost * 100) / 100,
    };
  }

  function planCostSummary(st) {
    const sl = shoppingList(st);
    let totalServings = 0, mealTheoreticalCost = 0;
    if (st.plan) {
      st.plan.days.forEach((d) => {
        for (const slot of SLOTS) {
          const m = d.meals[slot];
          if (!m || !m.servings) continue;
          const r = RBY[m.id];
          totalServings += m.servings;
          mealTheoreticalCost += recipeCost(st, r, m.servings);
        }
      });
    }
    return {
      shopCost: sl.totalCost,
      savedByInventory: sl.savedByInventoryCost,
      mealTheoreticalCost: Math.round(mealTheoreticalCost * 100) / 100,
      avgPerPersonDay: st.plan && st.settings.persons ? Math.round((mealTheoreticalCost / (st.plan.days.length * st.settings.persons)) * 100) / 100 : 0,
      avgPerServing: totalServings ? Math.round((mealTheoreticalCost / totalServings) * 100) / 100 : 0,
    };
  }

  function fmtQty(q, unit) {
    let v = Math.round(q * 100) / 100;
    if (unit === 'g' && v >= 1000) return `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg`;
    if (unit === 'ml' && v >= 1000) return `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} l`;
    if (unit === 'g' || unit === 'ml') v = Math.round(v / 5) * 5 || Math.round(q);
    const frac = { 0.25: '¼', 0.5: '½', 0.75: '¾', 0.33: '⅓', 0.67: '⅔' };
    const whole = Math.floor(v), f = Math.round((v - whole) * 100) / 100;
    let s = frac[f] ? (whole ? whole + ' ' : '') + frac[f] : v.toLocaleString('de-DE', { maximumFractionDigits: 1 });
    return `${s} ${unit}`;
  }

  // ---------- Statistik ----------
  function dayProtein(st, d) {
    let p = 0;
    for (const slot of SLOTS) if (d.meals[slot]) p += RBY[d.meals[slot].id].protein;
    return p;
  }

  // ---------- Feedback ----------
  function setPref(st, kind, key, val) {
    const m = st.prefs[kind];
    if (val === 0) delete m[key]; else m[key] = val;
  }
  function bumpPref(st, kind, key, delta) {
    const m = st.prefs[kind];
    const old = m[key] || 0;
    let nv;
    if (delta <= -99) nv = -99;
    else if (old <= -99) nv = delta > 0 ? 1 : -99;
    else nv = clamp(old + delta, -3, 3);
    setPref(st, kind, key, nv);
    return nv;
  }
  function rateRecipe(st, id, delta) { return bumpPref(st, 'recipe', id, delta); }

  const RX = {
    ban: /(allergi|unvertr[äa]glich|vertrag(e|en) (ich |wir )?(kein|nicht)|nie wieder|niemals|ekel|hasse|gar nicht|überhaupt nicht|ueberhaupt nicht)/,
    soft: /\b(weniger|seltener|nicht so oft|zu oft|zu viel)\b/,
    neg: /\b(kein|keine|keinen|keinem|keiner|nicht|ohne|schlecht|nicht so)\b/,
    pos: /\b(mag|m[öo]gen|liebe|lieben|gern|gerne|mehr|lecker|super|toll|klasse|immer|[öo]fter|favorit|lieblings\w*|bitte|will|wollen|h[äa]tte)\b/,
  };
  const WORDS = [];
  D.SYNONYMS.forEach((s) => s.w.forEach((w) => WORDS.push({ w, s })));
  // explizite Soja-Produkte, damit "kein Sojajoghurt" nicht alles mit Soja sperrt
  WORDS.push({ w: 'sojajoghurt', s: { ing: ['sojaskyr'], label: 'Soja-Joghurt' } });
  WORDS.push({ w: 'sojaskyr', s: { ing: ['sojaskyr'], label: 'Soja-Skyr' } });
  WORDS.push({ w: 'sojamilch', s: { ing: ['sojamilch'], label: 'Sojadrink' } });
  WORDS.push({ w: 'sojadrink', s: { ing: ['sojamilch'], label: 'Sojadrink' } });
  WORDS.sort((a, b) => b.w.length - a.w.length);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function findEntities(clause) {
    let c = ' ' + clause + ' ';
    const found = [];
    for (const { w, s } of WORDS) {
      const rx = new RegExp('(^|[^a-zäöüß])' + esc(w), 'i');
      const m = c.match(rx);
      if (m) {
        found.push(s);
        const at = m.index + m[1].length;
        c = c.slice(0, at) + ' '.repeat(w.length) + c.slice(at + w.length);
      }
    }
    return found;
  }

  function applyFeedback(st, text) {
    const effects = [];
    const t = (text || '').toLowerCase().trim();
    if (!t) return effects;
    const S = st.settings;

    // Spezielle Einstellungen
    let m;
    if ((m = t.match(/(max(imal)?|h[öo]chstens|unter|bis zu|bis)\s*(\d{1,3})\s*(min|minuten)/))) {
      S.maxTime = clamp(parseInt(m[3], 10), 10, 90);
      effects.push(`⏱ Hauptgerichte dauern jetzt höchstens ${S.maxTime} Min.`);
    } else if (/(schneller|weniger zeit|keine zeit|schnelle(re)? (rezepte|gerichte)|zu aufw[äa]ndig|zu lange)/.test(t)) {
      S.maxTime = Math.min(S.maxTime, 25);
      effects.push(`⏱ Schnellere Rezepte: höchstens ${S.maxTime} Min.`);
    }
    if (/(mehr protein|proteinreicher|mehr eiwei[ßs]|mehr proteine)/.test(t)) {
      S.proteinWeight = clamp((S.proteinWeight || 1) + 1, 0, 4);
      effects.push('💪 Proteinreiche Rezepte werden stärker bevorzugt.');
    }
    if ((m = t.match(/(\d+)\s*(personen|leute|menschen|pers\b|esser)/))) {
      S.persons = clamp(parseInt(m[1], 10), 1, 8);
      effects.push(`👥 Haushaltsgröße: ${S.persons} Personen.`);
    }
    const mentionsBreakfast = /fr[üu]+h?st[üu]+ck/.test(t);
    if (/kein(en)? fr[üu]h?st[üu]ck/.test(t)) {
      S.breakfast = false; effects.push('🍳 Frühstück wird nicht mehr geplant.');
    } else if (mentionsBreakfast && /(immer|jeden (tag|morgen)|t[äa]glich|nur noch|jeden fr)/.test(t)) {
      S.breakfastVariety = 1; S.breakfast = true; effects.push('🍳 Jeden Tag dasselbe Frühstück (weniger Einkauf, mehr Routine).');
    } else if (mentionsBreakfast && /(abwechslung|abwechslungsreich)/.test(t)) {
      S.breakfastVariety = 3; effects.push('🍳 Mehr Abwechslung beim Frühstück (3 Varianten pro Woche).');
    }
    if (/kein(en)? mittag|mittags? (esse ich |essen wir )?(au[ßs]er haus|in der kantine|ausw[äa]rts|unterwegs)/.test(t)) {
      S.lunchMode = 'none'; effects.push('🥡 Mittagessen wird nicht mehr geplant.');
    } else if (/mittag\w*.{0,30}(frisch|extra kochen|selbst kochen)/.test(t) || /keine reste/.test(t)) {
      S.lunchMode = 'cook'; effects.push('🥡 Mittagessen wird separat gekocht statt Reste.');
    } else if (/reste/.test(t) && !RX.neg.test(t)) {
      S.lunchMode = 'leftovers'; effects.push('🥡 Abendessen wird doppelt gekocht – Reste gibt’s am nächsten Mittag.');
    }

    // Zutaten / Vorlieben
    const sentences = t.split(/[.;!?\n]+/);
    for (const sent of sentences) {
      const clauses = sent.split(/,|\bund\b|\baber\b|\bsowie\b|\bdafür\b|\bstatt\b/);
      let inherited = null;
      for (const cl of clauses) {
        if (!cl.trim()) continue;
        let mood = null;
        if (RX.ban.test(cl)) mood = 'ban';
        else if (RX.soft.test(cl)) mood = 'soft';
        else if (RX.neg.test(cl)) mood = 'neg';
        else if (RX.pos.test(cl)) mood = 'pos';
        if (!mood) mood = inherited || 'pos';
        inherited = mood;
        const ents = findEntities(cl);
        for (const e of ents) {
          const delta = { ban: -99, soft: -1, neg: -2, pos: 1 }[mood];
          let nv = 0;
          if (e.tag) nv = bumpPref(st, 'tag', e.tag, mood === 'pos' ? 2 : delta);
          (e.ing || []).forEach((k) => { if (D.INGREDIENTS[k]) nv = bumpPref(st, 'ingredient', k, delta); });
          if (!e.tag && !(e.ing || []).length) {
            effects.push(`ℹ️ „${e.label}“ kommt in den Rezepten aktuell nicht vor.`);
            continue;
          }
          const txt = {
            ban: `🚫 Ausgeschlossen: ${e.label}`,
            soft: `↘️ Seltener: ${e.label}`,
            neg: `👎 Wird gemieden: ${e.label}`,
            pos: `👍 Bevorzugt: ${e.label}${e.tag === 'granola' ? ' (kommt regelmäßig ins Frühstück)' : ''}`,
          }[mood];
          effects.push(txt);
        }
      }
    }

    st.feedbackLog.unshift({ at: new Date().toISOString(), text: text.trim(), effects: effects.slice() });
    st.feedbackLog = st.feedbackLog.slice(0, 50);
    return effects;
  }

  // ---------- Inventar & Verbrauchs-Automatisierung ----------
  function adjustInventory(st, key, delta) {
    if (!st.inventory) st.inventory = {};
    const I = D.INGREDIENTS[key];
    if (!I || I.pantry) return 0;
    const next = Math.max(0, Math.round(((st.inventory[key] || 0) + delta) * 100) / 100);
    if (next <= 0) delete st.inventory[key];
    else st.inventory[key] = next;
    return next;
  }

  function toggleCookedMeal(st, dayIdx, slot) {
    if (!st.plan || !st.plan.days[dayIdx]) return false;
    if (!st.cookedMeals) st.cookedMeals = {};
    const d = st.plan.days[dayIdx];
    const m = d.meals[slot];
    if (!m || !m.servings) return false;
    const cookKey = `${d.date}:${slot}`;
    const r = RBY[m.id];
    const wasCooked = !!st.cookedMeals[cookKey];
    const sign = wasCooked ? 1 : -1;
    for (const ing of r.ingredients) {
      const I = D.INGREDIENTS[ing.k];
      if (!I || I.pantry) continue;
      adjustInventory(st, ing.k, sign * ing.q * m.servings);
    }
    if (wasCooked) delete st.cookedMeals[cookKey];
    else st.cookedMeals[cookKey] = true;
    return !wasCooked;
  }

  function consumeWeekPlan(st) {
    if (!st.plan) return 0;
    if (!st.cookedMeals) st.cookedMeals = {};
    let consumedCount = 0;
    st.plan.days.forEach((d, idx) => {
      for (const slot of SLOTS) {
        const m = d.meals[slot];
        if (!m || !m.servings) continue;
        const cookKey = `${d.date}:${slot}`;
        if (!st.cookedMeals[cookKey]) {
          toggleCookedMeal(st, idx, slot);
          consumedCount++;
        }
      }
    });
    return consumedCount;
  }

  function addCheckedToInventory(st) {
    const sl = shoppingList(st);
    let added = 0;
    sl.groups.forEach((g) => {
      g.items.forEach((it) => {
        const id = 'i:' + it.key;
        if (st.checked && st.checked[id]) {
          const I = D.INGREDIENTS[it.key];
          if (I && !I.pantry && I.pack > 0) {
            adjustInventory(st, it.key, it.packs * I.pack);
            delete st.checked[id];
            added++;
          }
        }
      });
    });
    return added;
  }

  function cookableWithInventory(st) {
    const inv = (st && st.inventory) || {};
    const P = (st && st.settings && st.settings.persons) || 2;
    const results = [];
    for (const r of D.RECIPES) {
      if (!isEligible(r, st)) continue;
      const nonPantry = r.ingredients.filter((i) => D.INGREDIENTS[i.k] && !D.INGREDIENTS[i.k].pantry);
      if (!nonPantry.length) continue;
      let haveCount = 0;
      const missing = [];
      for (const ing of nonPantry) {
        const needed = ing.q * P;
        const avail = inv[ing.k] || 0;
        if (avail >= needed * 0.8) haveCount++;
        else missing.push(D.INGREDIENTS[ing.k].name.replace(/ \(.*\)$/, ''));
      }
      const ratio = haveCount / nonPantry.length;
      if (ratio >= 0.5) {
        results.push({ recipe: r, ratio, haveCount, total: nonPantry.length, missing });
      }
    }
    return results.sort((a, b) => b.ratio - a.ratio || prefScore(b.recipe, st) - prefScore(a.recipe, st));
  }

  function archivePlan(st) {
    if (!st.plan) return;
    consumeWeekPlan(st);
    const ids = [];
    st.plan.days.forEach((d) => SLOTS.forEach((s) => d.meals[s] && !ids.includes(d.meals[s].id) && ids.push(d.meals[s].id)));
    st.history.unshift({ start: st.plan.start, ids });
    st.history = st.history.slice(0, 6);
    st.cookedMeals = {};
  }

  function planEnd(plan) { return addDays(parseIso(plan.start), plan.days.length - 1); }

  root.VPPlanner = {
    RBY, WD, SLOTS, iso, parseIso, addDays, nextDelivery, defaultState, generatePlan, swapMeal,
    shoppingList, fmtQty, fmtPrice, dayProtein, applyFeedback, rateRecipe, setPref, bumpPref,
    isEligible, archivePlan, planEnd, prefScore, ingredientPackPrice, recipeCost, planCostSummary,
    adjustInventory, toggleCookedMeal, consumeWeekPlan, addCheckedToInventory, cookableWithInventory,
  };
})(typeof window !== 'undefined' ? window : this);
