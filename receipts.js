/* Lokaler Kassenzettel-Scanner (PDF & Foto-OCR), Parser, Preis-Tracking & Selbstlernendes Produkt-Gedächtnis */
(function (root) {
  const D = root.VPData;
  const P = root.VPPlanner;

  // Spezifische Kassenbon-Abkürzungen & typische REWE-/Supermarkt-Bezeichnungen
  const RECEIPT_KEYWORDS = [
    { rx: /\b(r[äa]ucher\s*tofu)\b/i, key: 'raeuchertofu' },
    { rx: /\b(seiden\s*tofu)\b/i, key: 'seidentofu' },
    { rx: /\b(tofu\s*natur|natur\s*tofu|\btofu\b)\b/i, key: 'tofu' },
    { rx: /\b(tempeh)\b/i, key: 'tempeh' },
    { rx: /\b(soja\s*skyr|soja\s*joghurt|alpro\s*skyr|high\s*protein\s*joghurt|provamel)\b/i, key: 'sojaskyr' },
    { rx: /\b(veganes?\s*hack|mühlen\s*hack|beyond\s*mince|sensational\s*hack|hack\s*vegan)\b/i, key: 'veganes_hack' },
    { rx: /\b(hummus)\b/i, key: 'hummus' },
    { rx: /\b(soja\s*schnetzel|soja\s*granulat)\b/i, key: 'sojaschnetzel' },
    { rx: /\b(rote\s*linsen\s*nudeln|linsen\s*nudeln|linsen\s*pasta|linsen\s*fusilli)\b/i, key: 'linsennudeln' },
    { rx: /\b(beluga\s*linsen)\b/i, key: 'belugalinsen' },
    { rx: /\b(rote\s*linsen|linsen\s*rot)\b/i, key: 'linsen_rot' },
    { rx: /\b(kicher\s*erbsen)\b/i, key: 'kichererbsen' },
    { rx: /\b(kidney\s*bohnen)\b/i, key: 'kidneybohnen' },
    { rx: /\b(schwarze\s*bohnen)\b/i, key: 'schwarzebohnen' },
    { rx: /\b(wei[ßs]e\s*bohnen|riesen\s*bohnen|cannellini)\b/i, key: 'weissebohnen' },
    { rx: /\b(passierte\s*tomaten|tomaten\s*passiert|passata)\b/i, key: 'passata' },
    { rx: /\b(gehackte\s*tomaten|stückige\s*tomaten|stueckige\s*tomaten|dosentomaten|geschälte\s*tomaten)\b/i, key: 'tomaten_dose' },
    { rx: /\b(cherry\s*tomaten|rispentomaten\s*mini|datteltomaten|cocktailtomaten)\b/i, key: 'cherrytomaten' },
    { rx: /\b(tomaten\s*mark)\b/i, key: 'tomatenmark' },
    { rx: /\b(tomaten)\b/i, key: 'tomaten' },
    { rx: /\b(kokos\s*milch)\b/i, key: 'kokosmilch' },
    { rx: /\b(mais\b|gemüse\s*mais|goldmais)\b/i, key: 'mais' },
    { rx: /\b(granola|knusper\s*m[üu]sli|protein\s*m[üu]sli)\b/i, key: 'granola' },
    { rx: /\b(hafer\s*flocken|zarte\s*flocken|kernige\s*flocken)\b/i, key: 'haferflocken' },
    { rx: /\b(protein\s*pulver|vegan\s*protein|soy\s*protein|pea\s*protein)\b/i, key: 'proteinpulver' },
    { rx: /\b(chia\s*samen|\bchia\b)\b/i, key: 'chia' },
    { rx: /\b(hanf\s*samen)\b/i, key: 'hanfsamen' },
    { rx: /\b(k[üu]rbis\s*kerne)\b/i, key: 'kuerbiskerne' },
    { rx: /\b(erdnuss\s*mus|erdnuss\s*butter|peanut\s*butter)\b/i, key: 'erdnussmus' },
    { rx: /\b(tahin|tahini|sesam\s*mus)\b/i, key: 'tahini' },
    { rx: /\b(cashew\s*kerne|cashews)\b/i, key: 'cashews' },
    { rx: /\b(soja\s*drink|soja\s*milch)\b/i, key: 'sojamilch' },
    { rx: /\b(edamame)\b/i, key: 'edamame' },
    { rx: /\b(tk\s*erbsen|junge\s*erbsen|erbsen\s*tk)\b/i, key: 'erbsen' },
    { rx: /\b(blatt\s*spinat|spinat\s*tk)\b/i, key: 'tk_spinat' },
    { rx: /\b(baby\s*spinat|junger\s*spinat)\b/i, key: 'babyspinat' },
    { rx: /\b(beeren\s*mischung|tk\s*beeren|wald\s*beeren|himbeeren\s*tk|heidelbeeren\s*tk)\b/i, key: 'beeren' },
    { rx: /\b(vollkorn\s*brot|eiwei[ßs]\s*brot|saaten\s*brot)\b/i, key: 'vollkornbrot' },
    { rx: /\b(tortilla|wraps|weizen\s*wraps|vollkorn\s*wraps)\b/i, key: 'tortillas' },
    { rx: /\b(basmati\s*reis|vollkorn\s*reis|jasmin\s*reis|\breis\b)\b/i, key: 'reis' },
    { rx: /\b(quinoa)\b/i, key: 'quinoa' },
    { rx: /\b(vollkorn\s*nudeln|vollkorn\s*spaghetti|vollkorn\s*penne|vollkorn\s*fusilli)\b/i, key: 'vollkornnudeln' },
    { rx: /\b(fr[üu]hlings\s*zwiebel|lauch\s*zwiebel)\b/i, key: 'fruehlingszwiebel' },
    { rx: /\b(rote\s*zwiebel)\b/i, key: 'rote_zwiebel' },
    { rx: /\b(speise\s*zwiebel|\bzwiebeln?\b)\b/i, key: 'zwiebel' },
    { rx: /\b(knoblauch)\b/i, key: 'knoblauch' },
    { rx: /\b(ingwer)\b/i, key: 'ingwer' },
    { rx: /\b(paprika\s*pulver)\b/i, key: 'paprikapulver' },
    { rx: /\b(paprika)\b/i, key: 'paprika' },
    { rx: /\b(zucchini)\b/i, key: 'zucchini' },
    { rx: /\b(brokkoli|broccoli)\b/i, key: 'brokkoli' },
    { rx: /\b(karotte|m[öo]hre|speisem[öo]hre)\b/i, key: 'karotte' },
    { rx: /\b(s[üu][ßs]\s*kartoffel)\b/i, key: 'suesskartoffel' },
    { rx: /\b(kartoffel)\b/i, key: 'kartoffeln' },
    { rx: /\b(salat\s*gurke|schlangen\s*gurke|\bgurke\b)\b/i, key: 'gurke' },
    { rx: /\b(avocado)\b/i, key: 'avocado' },
    { rx: /\b(zitrone)\b/i, key: 'zitrone' },
    { rx: /\b(limette)\b/i, key: 'limette' },
    { rx: /\b(banane)\b/i, key: 'banane' },
    { rx: /\b([äa]pfel|apfel)\b/i, key: 'apfel' },
    { rx: /\b(champignon|egerling)\b/i, key: 'champignons' },
    { rx: /\b(petersilie|koriander|schnittlauch|kr[äa]uter)\b/i, key: 'kraeuter' },
    { rx: /\b(raps\s*[öo]l|oliven\s*[öo]l|brat\s*[öo]l)\b/i, key: 'oel' },
    { rx: /\b(soja\s*sauce|tamari|shoyu)\b/i, key: 'sojasauce' },
    { rx: /\b(gem[üu]se\s*br[üu]he)\b/i, key: 'gemuesebruehe' },
    { rx: /\b(curry\s*paste)\b/i, key: 'currypaste' },
    { rx: /\b(curry\s*pulver)\b/i, key: 'currypulver' },
    { rx: /\b(hefe\s*flocken|edel\s*hefe)\b/i, key: 'hefeflocken' },
    { rx: /\b(ahorn\s*sirup|agaven\s*dicksaft)\b/i, key: 'ahornsirup' },
  ];

  const SAMPLE_RECEIPTS = [
    {
      title: 'REWE Lieferservice – Wocheneinkauf',
      text: `REWE Markt GmbH - Lieferservice
Datum: ${new Date().toLocaleDateString('de-DE')}
----------------------------------------
2 x 1,49
REWE Bio Tofu Natur 200g           2,98 B
REWE Bio Räuchertofu 200g          1,79 B
Alpro Skyr Style Natur 400g        1,89 B
REWE Bio Kichererbsen 400g         0,99 B
2 x 0,99
REWE Bio Gehackte Tomaten 400g     1,98 B
REWE Bio Kokosmilch 400ml          1,49 B
REWE Bio Rote Linsen 500g          1,89 B
Babyspinat 200g                    1,69 B
Champignons braun 400g             1,99 B
Brokkoli 1 Stk                     1,49 B
2 x 1,19
Süßkartoffel                       2,38 B
REWE Bio Sojadrink ungesüßt 1L     1,19 B
Knuspermüsli Protein Granola 400g  2,99 B
Edamame geschält TK 400g           2,99 B
Oatly Haferdrink Barista 1L        2,19 B
----------------------------------------
SUMME EUR                         29,92
Kartenzahlung                     29,92`,
    },
    {
      title: 'Biomarkt / Alnatura – Nachkauf',
      text: `Alnatura Super Natur Markt
Datum: ${new Date().toLocaleDateString('de-DE')}
----------------------------------------
Alnatura Tempeh Natur 200g         2,69 A
Alnatura Erdnussmus Crunchy 350g   2,99 A
Alnatura Tahin Sesammus 300g       3,49 A
Alnatura Quinoa Tricolore 400g     2,89 A
Haferflocken Feinblatt 500g        0,89 A
Avocado Hass 2 Stk                 2,58 A
Limetten 3 Stk                     1,29 A
Oatly Haferdrink Barista 1L        2,29 A
----------------------------------------
SUMME                             19,11 EUR`,
    },
  ];

  function normalizeAliasKey(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/\b\d+([.,]\d+)?\s*(g|kg|ml|l|stk|st|st[üu]ck|er|pack|tl|el)\b/gi, '')
      .replace(/[^a-zäöüß0-9]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function detectQuantityFromText(text, ingKey) {
    const I = ingKey ? D.INGREDIENTS[ingKey] : null;
    const t = String(text || '');

    // Explizite Gramm/Kilogramm/Milliliter/Liter im Artikelnamen (z. B. "200g", "0,5 kg", "1L")
    const mWeight = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
    if (mWeight) {
      let val = parseFloat(mWeight[1].replace(',', '.'));
      const u = mWeight[2].toLowerCase();
      if (u === 'kg') val *= 1000;
      if (u === 'l') val *= 1000;
      if (I) {
        if (I.unit === 'Dose') return 1;
        if (I.unit === 'g' || I.unit === 'ml') return val;
      } else {
        return val;
      }
    }

    // Stückzahl im Namen (z. B. "3 Stk", "8er")
    const mPieces = t.match(/(\d+)\s*(stk|st[üu]ck|er\b|bund|knolle)/i);
    if (mPieces && (!I || I.unit === 'Stk' || I.unit === 'Bund' || I.unit === 'Zehe')) {
      return parseInt(mPieces[1], 10);
    }

    if (I) {
      return I.pack > 0 ? I.pack : 1;
    }
    return 1;
  }

  function matchIngredient(rawName, st) {
    const norm = normalizeAliasKey(rawName);
    if (!norm) return { ingKey: '', confidence: 'none' };

    // 1. Gelerntes Produkt-Gedächtnis (exakt oder Teil-Match)
    const aliases = (st && st.learnedAliases) || {};
    if (aliases[norm] && aliases[norm].ingKey && D.INGREDIENTS[aliases[norm].ingKey]) {
      return {
        ingKey: aliases[norm].ingKey,
        packQty: aliases[norm].packQty,
        confidence: 'learned',
      };
    }
    for (const [k, val] of Object.entries(aliases)) {
      if (k.length >= 4 && (norm.includes(k) || k.includes(norm)) && val.ingKey && D.INGREDIENTS[val.ingKey]) {
        return {
          ingKey: val.ingKey,
          packQty: val.packQty,
          confidence: 'learned',
        };
      }
    }

    // 2. Explizite Haushalts-/Extra-Artikel (z. B. Haferdrink Barista, Kaffee, Spülmittel), die nicht als Rezept-Haferflocken verwechselt werden dürfen
    if (/\b(hafer\s*drink|hafer\s*milch|barista|mandel\s*drink|mandel\s*milch|kaffee|espresso|sp[üu]lmittel|k[üu]chenrolle|toilettenpapier|zahnpasta|seife)\b/i.test(rawName)) {
      return { ingKey: '', confidence: 'none' };
    }

    // 3. Spezifische Kassenbon-Regeln
    for (const rule of RECEIPT_KEYWORDS) {
      if (rule.rx.test(rawName)) {
        return { ingKey: rule.key, confidence: 'high' };
      }
    }

    // 4. Zutaten-Namen & Suchbegriffe
    for (const [key, I] of Object.entries(D.INGREDIENTS)) {
      const searchNorm = normalizeAliasKey(I.search);
      if (searchNorm && norm.includes(searchNorm)) {
        return { ingKey: key, confidence: 'medium' };
      }
    }

    // 5. Synonyme aus data.js (nur vollständige Wörter)
    const wordsInNorm = new Set(norm.split(' '));
    for (const syn of D.SYNONYMS) {
      if (!syn.ing || !syn.ing.length) continue;
      for (const w of syn.w) {
        if (w.length >= 4 && wordsInNorm.has(w.toLowerCase())) {
          return { ingKey: syn.ing[0], confidence: 'low' };
        }
      }
    }

    return { ingKey: '', confidence: 'none' };
  }

  const IGNORE_LINE_RX = /^(\s*$|[-=*_.\s]{3,}|summe|gesamt|zwischensumme|zu zahlen|betrag|gegeben|r[üu]ckgeld|bar\b|ec-cash|kartenzahlung|girocard|kreditkarte|mastercard|visa|maestro|kontaktlos|mwst|ust\b|netto|brutto|steuer|tse\b|bon-nr|kassen-nr|filiale|telefon|tel\.|uid\b|ust-id|vielen dank|danke f[üu]r|auf wiedersehen|payback|punkte|rabatt\s*gesamt|pfand\s*rück|leergut)/i;

  function detectStore(text) {
    const t = String(text || '');
    const stores = [
      [/rewe\s*lieferservice/i, 'REWE Lieferservice'],
      [/\brewe\b/i, 'REWE'],
      [/\balnatura\b/i, 'Alnatura'],
      [/\bdm[-\s]*drogerie|\bdm\b/i, 'dm'],
      [/\bedeka\b/i, 'EDEKA'],
      [/\blidl\b/i, 'Lidl'],
      [/\baldi\b/i, 'ALDI'],
      [/\bkaufland\b/i, 'Kaufland'],
      [/\bdenn'?s\b/i, 'Denns BioMarkt'],
      [/\bnetto\b/i, 'Netto'],
      [/\bpenny\b/i, 'Penny'],
    ];
    for (const [rx, name] of stores) {
      if (rx.test(t)) return name;
    }
    return 'Supermarkt';
  }

  function detectDate(text, fallbackIso) {
    const t = String(text || '');
    const mDe = t.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2}|\d{2})\b/);
    if (mDe) {
      const d = String(mDe[1]).padStart(2, '0');
      const m = String(mDe[2]).padStart(2, '0');
      const y = mDe[3].length === 2 ? '20' + mDe[3] : mDe[3];
      const numM = +m, numD = +d;
      if (numM >= 1 && numM <= 12 && numD >= 1 && numD <= 31) return `${y}-${m}-${d}`;
    }
    const mIso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
    return fallbackIso || P.iso(new Date());
  }

  function parseReceiptText(rawText, st) {
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const store = detectStore(rawText);
    const date = detectDate(rawText);
    const items = [];
    let pendingMultiplier = null;
    let detectedTotal = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Gesamtsumme erkennen
      const mSum = line.match(/^(?:summe|gesamt(?:\s*betrag)?|zu\s*zahlen)(?:\s+eur|\s*€)?\s*[:\s]*(\d{1,4}[.,]\d{2})/i);
      if (mSum) {
        detectedTotal = parseFloat(mSum[1].replace(',', '.'));
        continue;
      }

      if (IGNORE_LINE_RX.test(line)) continue;

      // Reine Multiplikator-Zeile wie "2 x 1,49" oder "3 Stk x 0,99 EUR"
      const mMultOnly = line.match(/^(\d{1,2})\s*(?:stk|st|x|\*)?\s*[x*]\s*(\d{1,3}[.,]\d{2})(?:\s*(?:eur|€|[ab]))?$/i);
      if (mMultOnly) {
        pendingMultiplier = {
          count: parseInt(mMultOnly[1], 10),
          unitPrice: parseFloat(mMultOnly[2].replace(',', '.')),
        };
        continue;
      }

      // Gewichts-Zeile wie "0,450 kg x 3,99 EUR/kg"
      const mWeightLine = line.match(/^(\d+[.,]\d+)\s*kg\s*[x*]\s*(\d+[.,]\d{2})/i);
      if (mWeightLine) {
        pendingMultiplier = {
          count: 1,
          weightGrams: Math.round(parseFloat(mWeightLine[1].replace(',', '.')) * 1000),
        };
        continue;
      }

      // Artikelzeile mit Preis am Ende: z. B. "REWE Bio Tofu Natur 200g 1,49 B" oder "2x Hafermilch 2,38 €"
      const mItem = line.match(/^(.+?)\s+(-?\d{1,3}[.,]\d{2})\s*(?:€|eur|[ab12]\b|\*)?$/i);
      if (!mItem) continue;

      let rawName = mItem[1].trim();
      const linePrice = parseFloat(mItem[2].replace(',', '.'));

      // Rabatt-/Pfand-Zeilen überspringen oder separat behandeln
      if (linePrice <= 0 || /\b(pfand|leergut|rabatt|coupon)\b/i.test(rawName)) {
        pendingMultiplier = null;
        continue;
      }

      // Prüfen, ob am Zeilenanfang ein Multiplikator steht ("2x REWE Bio..." oder "2 x ...")
      let count = 1;
      const mInlineMult = rawName.match(/^(\d{1,2})\s*[x*]\s+(.+)$/i);
      if (mInlineMult) {
        count = parseInt(mInlineMult[1], 10);
        rawName = mInlineMult[2].trim();
      } else if (pendingMultiplier && pendingMultiplier.count) {
        count = pendingMultiplier.count;
      }

      // Prüfen, ob in der NÄCHSTEN Zeile ein Multiplikator steht (manche Bons haben erst Text, dann "2 x 1,49   2,98")
      const match = matchIngredient(rawName, st);
      const ingKey = match.ingKey;
      const I = ingKey ? D.INGREDIENTS[ingKey] : null;

      let singleQty = match.packQty || detectQuantityFromText(rawName, ingKey);
      if (pendingMultiplier && pendingMultiplier.weightGrams && I && I.unit === 'g') {
        singleQty = pendingMultiplier.weightGrams;
      }
      const totalQty = Math.round(singleQty * count * 100) / 100;
      const unitPrice = Math.round((linePrice / Math.max(1, count)) * 100) / 100;

      items.push({
        id: 'ri_' + i + '_' + Math.random().toString(36).slice(2, 6),
        include: true,
        rawName,
        count,
        ingKey,
        confidence: match.confidence,
        qty: totalQty,
        singleQty,
        unit: I ? I.unit : 'Stk',
        price: linePrice,
        unitPrice,
        cat: I ? I.cat : 'Sonstiges / Haushalt',
      });

      pendingMultiplier = null;
    }

    const sumItems = Math.round(items.reduce((s, x) => s + (x.price || 0), 0) * 100) / 100;
    return {
      date,
      store,
      total: detectedTotal > 0 ? detectedTotal : sumItems,
      items,
      rawText,
    };
  }

  // Verbucht den geprüften Bon in Inventar, Preis-Historie & Produkt-Gedächtnis
  function commitReceipt(st, draft) {
    if (!st.inventory) st.inventory = {};
    if (!st.prices) st.prices = {};
    if (!st.receipts) st.receipts = [];
    if (!st.learnedAliases) st.learnedAliases = {};
    if (!st.extraPurchases) st.extraPurchases = {};

    const activeItems = (draft.items || []).filter((it) => it.include);
    let inventoryAddedCount = 0;
    let pricesUpdatedCount = 0;
    let learnedCount = 0;

    for (const it of activeItems) {
      const norm = normalizeAliasKey(it.rawName);
      const ingKey = it.ingKey && D.INGREDIENTS[it.ingKey] ? it.ingKey : '';

      if (ingKey) {
        const I = D.INGREDIENTS[ingKey];
        const qty = Math.max(0, parseFloat(it.qty) || I.pack || 1);
        const count = Math.max(1, parseInt(it.count, 10) || 1);
        const singlePackQty = Math.round((qty / count) * 100) / 100 || I.pack || 1;

        // 1. Inventar erhöhen (für alle Nicht-Gewürz-Zutaten)
        if (!I.pantry) {
          P.adjustInventory(st, ingKey, qty);
          inventoryAddedCount++;
        } else if (st.pantryMissing && st.pantryMissing[ingKey]) {
          delete st.pantryMissing[ingKey];
        }

        // 2. Preis-Gedächtnis aktualisieren (normiert auf Standard-Packung)
        if (it.price > 0) {
          const packFactor = I.pack > 0 && qty > 0 ? qty / I.pack : count;
          const normalizedPackPrice = Math.round((it.price / Math.max(0.25, packFactor)) * 100) / 100;
          const existing = st.prices[ingKey] || {
            lastPrice: normalizedPackPrice,
            avgPrice: normalizedPackPrice,
            minPrice: normalizedPackPrice,
            maxPrice: normalizedPackPrice,
            history: [],
          };
          const prevAvg = existing.avgPrice || normalizedPackPrice;
          existing.history = existing.history || [];
          existing.history.unshift({
            date: draft.date || P.iso(new Date()),
            price: normalizedPackPrice,
            rawPrice: it.price,
            store: draft.store || 'REWE',
          });
          existing.history = existing.history.slice(0, 20);
          const sum = existing.history.reduce((s, h) => s + h.price, 0);
          existing.prevPrice = existing.lastPrice;
          existing.lastPrice = normalizedPackPrice;
          existing.avgPrice = Math.round((sum / existing.history.length) * 100) / 100;
          existing.minPrice = Math.min(...existing.history.map((h) => h.price));
          existing.maxPrice = Math.max(...existing.history.map((h) => h.price));
          existing.trend = normalizedPackPrice > prevAvg * 1.05 ? 'up' : normalizedPackPrice < prevAvg * 0.95 ? 'down' : 'flat';
          existing.updatedAt = new Date().toISOString();
          st.prices[ingKey] = existing;
          pricesUpdatedCount++;
        }

        // 3. Produkt-Gedächtnis (Selbstlernendes Alias-Wörterbuch)
        if (norm && norm.length >= 3) {
          st.learnedAliases[norm] = {
            ingKey,
            packQty: singlePackQty,
            label: it.rawName,
            lastPrice: it.unitPrice || it.price,
            count: ((st.learnedAliases[norm] && st.learnedAliases[norm].count) || 0) + 1,
          };
          learnedCount++;
        }

        // 4. Implizites positives Zutaten-Feedback bei wiederholtem Kauf
        if (!st.prefs.ingredient[ingKey]) {
          // sanfter Hinweis: Wer eine Zutat aktiv kauft, schließt sie nicht aus
        }
      } else if (norm && norm.length >= 3) {
        // Extra-Artikel (kein Rezept-Bestandteil) -> für Smart-Essentials merken
        const ex = st.extraPurchases[norm] || { name: it.rawName, count: 0, lastPrice: it.price, dismissed: false };
        ex.count += 1;
        ex.lastPrice = it.price;
        ex.name = it.rawName;
        st.extraPurchases[norm] = ex;
      }
    }

    const total = Math.round(activeItems.reduce((s, x) => s + (parseFloat(x.price) || 0), 0) * 100) / 100;
    const receiptRecord = {
      id: 'rc_' + Date.now(),
      date: draft.date || P.iso(new Date()),
      store: draft.store || 'REWE',
      total: draft.total > 0 ? draft.total : total,
      itemCount: activeItems.length,
      items: activeItems.map((x) => ({
        rawName: x.rawName,
        ingKey: x.ingKey || '',
        qty: x.qty,
        unit: x.unit,
        price: x.price,
        cat: x.ingKey && D.INGREDIENTS[x.ingKey] ? D.INGREDIENTS[x.ingKey].cat : 'Sonstiges / Haushalt',
      })),
    };
    st.receipts.unshift(receiptRecord);
    st.receipts = st.receipts.slice(0, 100);

    return {
      receipt: receiptRecord,
      inventoryAddedCount,
      pricesUpdatedCount,
      learnedCount,
    };
  }

  // ---------- PDF- & Bild-Extraktion (100% lokal im Browser) ----------
  function loadScriptOnce(src, globalName) {
    if (root[globalName]) return Promise.resolve(root[globalName]);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(root[globalName]);
      s.onerror = () => reject(new Error('Bibliothek konnte nicht geladen werden: ' + src));
      document.head.appendChild(s);
    });
  }

  async function extractPdfText(file, onProgress) {
    if (onProgress) onProgress('PDF wird geladen …', 15);
    const arrayBuffer = await file.arrayBuffer();

    try {
      const pdfjsLib = await loadScriptOnce(
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        'pdfjsLib'
      );
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      if (onProgress) onProgress('PDF-Seiten werden analysiert …', 40);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const allLines = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (onProgress) onProgress(`Lese Seite ${pageNum} von ${pdf.numPages} …`, 40 + Math.round((pageNum / pdf.numPages) * 50));
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        // Gruppiere Text-Items anhand ihrer Y-Koordinate in Zeilen
        const rows = [];
        for (const item of content.items) {
          if (!item.str || !item.str.trim()) continue;
          const y = Math.round(item.transform[5]);
          const x = Math.round(item.transform[4]);
          let row = rows.find((r) => Math.abs(r.y - y) <= 4);
          if (!row) {
            row = { y, parts: [] };
            rows.push(row);
          }
          row.parts.push({ x, str: item.str });
        }
        rows.sort((a, b) => b.y - a.y);
        for (const r of rows) {
          r.parts.sort((a, b) => a.x - b.x);
          allLines.push(r.parts.map((p) => p.str).join(' '));
        }
      }
      const resultText = allLines.join('\n').trim();
      if (resultText) {
        if (onProgress) onProgress('PDF erfolgreich ausgelesen!', 100);
        return resultText;
      }
    } catch (err) {
      console.warn('PDF.js Fallback aktiv:', err);
    }

    // Fallback: Text-Streams direkt aus dem PDF-Buffer extrahieren
    const raw = new TextDecoder('latin1').decode(arrayBuffer);
    const extracted = [];
    const rx = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
    let m;
    while ((m = rx.exec(raw)) !== null) {
      extracted.push(m[1].replace(/\\([()\\])/g, '$1'));
    }
    if (onProgress) onProgress('Fertig', 100);
    return extracted.join('\n');
  }

  // Bild für bessere Kassenbon-OCR vorverarbeiten (Kontrast & Graustufen)
  function preprocessReceiptImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = 2000;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const imgData = ctx.getImageData(0, 0, w, h);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            // Leichte Kontrastspreizung für Thermopapier
            const c = gray < 165 ? Math.max(0, (gray - 30) * 0.85) : Math.min(255, gray * 1.12);
            d[i] = d[i + 1] = d[i + 2] = c;
          }
          ctx.putImageData(imgData, 0, 0);
          canvas.toBlob((blob) => resolve(blob || file), 'image/png');
        } catch (e) {
          resolve(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Bilddatei konnte nicht geladen werden.'));
      };
      img.src = url;
    });
  }

  async function extractImageText(file, onProgress) {
    if (onProgress) onProgress('Optimiere Bildkontrast für Kassenbon …', 10);
    const processedBlob = await preprocessReceiptImage(file);

    if (onProgress) onProgress('Lade lokale Texterkennung (Tesseract OCR) …', 20);
    const Tesseract = await loadScriptOnce(
      'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
      'Tesseract'
    );

    const res = await Tesseract.recognize(processedBlob, 'deu', {
      logger: (m) => {
        if (m && m.status && onProgress) {
          const pct = Math.min(98, 25 + Math.round((m.progress || 0) * 70));
          const statusMap = {
            'loading tesseract core': 'Lade OCR-Engine …',
            'initializing tesseract': 'Initialisiere OCR …',
            'loading language traineddata': 'Lade deutsches Sprachpaket …',
            'initializing api': 'Starte Texterkennung …',
            'recognizing text': 'Erkenne Kassenbon-Zeilen …',
          };
          onProgress(statusMap[m.status] || m.status, pct);
        }
      },
    });
    if (onProgress) onProgress('Kassenbon erfolgreich ausgelesen!', 100);
    return (res && res.data && res.data.text) || '';
  }

  async function extractFromFile(file, onProgress) {
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      return extractPdfText(file, onProgress);
    }
    if (type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(name)) {
      return extractImageText(file, onProgress);
    }
    if (type.startsWith('text/') || name.endsWith('.txt')) {
      return file.text();
    }
    throw new Error('Bitte lade ein Foto (JPG, PNG, WebP) oder eine PDF-Datei hoch.');
  }

  // ---------- Auswertungs-Statistiken ----------
  function computeAnalytics(st) {
    const receipts = (st && st.receipts) || [];
    const prices = (st && st.prices) || {};
    const inv = (st && st.inventory) || {};

    const now = new Date();
    const curMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let totalSpentAllTime = 0;
    let totalSpentThisMonth = 0;
    const catTotals = {};

    for (const r of receipts) {
      const t = Number(r.total) || 0;
      totalSpentAllTime += t;
      if (String(r.date || '').startsWith(curMonthPrefix)) {
        totalSpentThisMonth += t;
      }
      for (const it of r.items || []) {
        const cat = it.cat || (it.ingKey && D.INGREDIENTS[it.ingKey] ? D.INGREDIENTS[it.ingKey].cat : 'Sonstiges / Haushalt');
        catTotals[cat] = Math.round(((catTotals[cat] || 0) + (Number(it.price) || 0)) * 100) / 100;
      }
    }

    // Warenwert des aktuellen Inventars berechnen
    let inventoryValue = 0;
    let inventoryItemCount = 0;
    for (const [k, qty] of Object.entries(inv)) {
      const I = D.INGREDIENTS[k];
      if (!I || I.pantry || qty <= 0) continue;
      inventoryItemCount++;
      const packPrice = P.ingredientPackPrice(st, k);
      const packs = I.pack > 0 ? qty / I.pack : qty;
      inventoryValue += packs * packPrice;
    }

    const catBreakdown = Object.entries(catTotals)
      .map(([cat, amount]) => ({
        cat,
        amount,
        pct: totalSpentAllTime > 0 ? Math.round((amount / totalSpentAllTime) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const priceEntries = Object.entries(prices)
      .filter(([k]) => D.INGREDIENTS[k])
      .map(([k, p]) => ({
        key: k,
        name: D.INGREDIENTS[k].name,
        packLabel: D.INGREDIENTS[k].packLabel || D.INGREDIENTS[k].unit,
        lastPrice: p.lastPrice,
        avgPrice: p.avgPrice,
        minPrice: p.minPrice,
        maxPrice: p.maxPrice,
        trend: p.trend || 'flat',
        count: (p.history && p.history.length) || 1,
        lastDate: p.history && p.history[0] ? p.history[0].date : '',
        lastStore: p.history && p.history[0] ? p.history[0].store : '',
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'));

    // Smart-Essentials-Vorschläge (mind. 2x gekauft, noch nicht in st.essentials)
    const existingEssNames = new Set(((st && st.essentials) || []).map((e) => normalizeAliasKey(e.name)));
    const suggestedEssentials = Object.entries((st && st.extraPurchases) || {})
      .filter(([norm, ex]) => ex.count >= 2 && !ex.dismissed && !existingEssNames.has(norm))
      .map(([norm, ex]) => ({ norm, name: ex.name, count: ex.count, lastPrice: ex.lastPrice }));

    return {
      receiptCount: receipts.length,
      totalSpentAllTime: Math.round(totalSpentAllTime * 100) / 100,
      totalSpentThisMonth: Math.round(totalSpentThisMonth * 100) / 100,
      avgReceiptTotal: receipts.length ? Math.round((totalSpentAllTime / receipts.length) * 100) / 100 : 0,
      inventoryValue: Math.round(inventoryValue * 100) / 100,
      inventoryItemCount,
      learnedProductCount: Object.keys((st && st.learnedAliases) || {}).length,
      catBreakdown,
      priceEntries,
      suggestedEssentials,
    };
  }

  root.VPReceipts = {
    SAMPLE_RECEIPTS,
    normalizeAliasKey,
    detectQuantityFromText,
    matchIngredient,
    parseReceiptText,
    commitReceipt,
    extractFromFile,
    computeAnalytics,
  };
})(typeof window !== 'undefined' ? window : this);
