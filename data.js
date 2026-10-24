/* Zutaten-Katalog & Rezeptdatenbank für den veganen Wochenplaner.
 * Mengen in Rezepten sind PRO PORTION angegeben.
 * Proteinangaben sind Schätzwerte pro Portion (g).
 */
(function (root) {
  const CATS = [
    'Obst & Gemüse',
    'Kühlregal',
    'Brot & Backwaren',
    'Nudeln, Reis & Getreide',
    'Hülsenfrüchte & Konserven',
    'Müsli & Frühstück',
    'Nüsse, Samen & Aufstriche',
    'Pflanzendrinks',
    'Tiefkühl',
    'Vorrat (Gewürze, Öle, Saucen)',
  ];

  // key: [Name, Kategorie-Index, Einheit, Packungsgröße, Packungsbezeichnung, REWE-Suchbegriff, Vorrat?]
  const RAW = {
    // Obst & Gemüse
    zwiebel: ['Zwiebeln', 0, 'Stk', 1, 'Stück', 'Zwiebeln'],
    rote_zwiebel: ['Rote Zwiebeln', 0, 'Stk', 1, 'Stück', 'rote Zwiebeln'],
    knoblauch: ['Knoblauch', 0, 'Zehe', 8, 'Knolle', 'Knoblauch'],
    ingwer: ['Ingwer', 0, 'g', 50, 'Stück (~50 g)', 'Ingwer'],
    paprika: ['Paprika', 0, 'Stk', 1, 'Stück', 'Paprika rot'],
    zucchini: ['Zucchini', 0, 'Stk', 1, 'Stück', 'Zucchini'],
    brokkoli: ['Brokkoli', 0, 'Stk', 1, 'Kopf', 'Brokkoli'],
    karotte: ['Karotten', 0, 'Stk', 1, 'Stück', 'Karotten'],
    suesskartoffel: ['Süßkartoffeln', 0, 'Stk', 1, 'Stück', 'Süßkartoffel'],
    kartoffeln: ['Kartoffeln (festkochend)', 0, 'g', 1000, '1-kg-Netz', 'Kartoffeln festkochend'],
    tomaten: ['Tomaten', 0, 'Stk', 1, 'Stück', 'Tomaten'],
    cherrytomaten: ['Cherrytomaten', 0, 'g', 250, '250-g-Schale', 'Cherrytomaten'],
    gurke: ['Salatgurke', 0, 'Stk', 1, 'Stück', 'Salatgurke'],
    avocado: ['Avocado', 0, 'Stk', 1, 'Stück', 'Avocado'],
    zitrone: ['Zitronen', 0, 'Stk', 1, 'Stück', 'Zitronen'],
    limette: ['Limetten', 0, 'Stk', 1, 'Stück', 'Limetten'],
    banane: ['Bananen', 0, 'Stk', 1, 'Stück', 'Bananen'],
    apfel: ['Äpfel', 0, 'Stk', 1, 'Stück', 'Äpfel'],
    babyspinat: ['Babyspinat', 0, 'g', 200, '200-g-Beutel', 'Babyspinat'],
    champignons: ['Champignons', 0, 'g', 400, '400-g-Schale', 'Champignons braun'],
    fruehlingszwiebel: ['Frühlingszwiebeln', 0, 'Bund', 1, 'Bund', 'Frühlingszwiebeln'],
    kraeuter: ['Petersilie oder Koriander', 0, 'Bund', 1, 'Bund', 'Petersilie glatt'],

    // Kühlregal
    tofu: ['Naturtofu', 1, 'g', 200, '200-g-Packung', 'Tofu natur'],
    raeuchertofu: ['Räuchertofu', 1, 'g', 200, '200-g-Packung', 'Räuchertofu'],
    tempeh: ['Tempeh', 1, 'g', 200, '200-g-Packung', 'Tempeh'],
    sojaskyr: ['High-Protein Soja-Joghurt / Soja-Skyr natur', 1, 'g', 400, '400-g-Becher', 'Soja Skyr vegan'],
    veganes_hack: ['Veganes Hack', 1, 'g', 200, '200-g-Packung', 'veganes Hack'],
    hummus: ['Hummus', 1, 'g', 200, '200-g-Becher', 'Hummus'],

    // Brot
    vollkornbrot: ['Vollkornbrot', 2, 'g', 500, '500-g-Laib', 'Vollkornbrot'],
    tortillas: ['Weizen-Tortillas (Wraps)', 2, 'Stk', 8, '8er-Packung', 'Tortilla Wraps'],

    // Nudeln, Reis, Getreide
    reis: ['Basmati- oder Vollkornreis', 3, 'g', 500, '500-g-Packung', 'Basmati Reis'],
    quinoa: ['Quinoa', 3, 'g', 400, '400-g-Packung', 'Quinoa'],
    vollkornnudeln: ['Vollkornnudeln', 3, 'g', 500, '500-g-Packung', 'Vollkorn Spaghetti'],
    linsennudeln: ['Rote-Linsen-Nudeln', 3, 'g', 250, '250-g-Packung', 'Linsen Nudeln'],

    // Hülsenfrüchte & Konserven
    linsen_rot: ['Rote Linsen', 4, 'g', 500, '500-g-Packung', 'rote Linsen'],
    belugalinsen: ['Belugalinsen', 4, 'g', 500, '500-g-Packung', 'Beluga Linsen'],
    sojaschnetzel: ['Sojaschnetzel (fein)', 4, 'g', 200, '200-g-Packung', 'Soja Schnetzel'],
    kichererbsen: ['Kichererbsen (Dose)', 4, 'Dose', 1, 'Dose (400 g)', 'Kichererbsen Dose'],
    kidneybohnen: ['Kidneybohnen (Dose)', 4, 'Dose', 1, 'Dose (400 g)', 'Kidneybohnen'],
    schwarzebohnen: ['Schwarze Bohnen (Dose)', 4, 'Dose', 1, 'Dose (400 g)', 'schwarze Bohnen'],
    weissebohnen: ['Weiße Bohnen (Dose)', 4, 'Dose', 1, 'Dose (400 g)', 'weiße Bohnen'],
    tomaten_dose: ['Gehackte Tomaten (Dose)', 4, 'Dose', 1, 'Dose (400 g)', 'gehackte Tomaten'],
    passata: ['Passierte Tomaten', 4, 'g', 500, '500-g-Packung', 'passierte Tomaten'],
    kokosmilch: ['Kokosmilch', 4, 'Dose', 1, 'Dose (400 ml)', 'Kokosmilch'],
    mais: ['Mais (Dose)', 4, 'Dose', 1, 'Dose (285 g)', 'Mais Dose'],
    seidentofu: ['Seidentofu', 4, 'g', 400, '400-g-Packung', 'Seidentofu'],

    // Müsli & Frühstück
    granola: ['Granola / Knuspermüsli (gern Protein-Granola)', 5, 'g', 400, '400-g-Packung', 'Granola'],
    haferflocken: ['Haferflocken (zart)', 5, 'g', 500, '500-g-Packung', 'Haferflocken'],
    proteinpulver: ['Veganes Proteinpulver (neutral/Vanille)', 5, 'g', 500, '500-g-Dose', 'veganes Proteinpulver'],

    // Nüsse, Samen, Aufstriche
    chia: ['Chiasamen', 6, 'g', 200, '200-g-Beutel', 'Chiasamen'],
    hanfsamen: ['Hanfsamen geschält', 6, 'g', 200, '200-g-Beutel', 'Hanfsamen geschält'],
    kuerbiskerne: ['Kürbiskerne', 6, 'g', 200, '200-g-Beutel', 'Kürbiskerne'],
    erdnussmus: ['Erdnussmus', 6, 'g', 350, '350-g-Glas', 'Erdnussmus'],
    tahini: ['Tahin (Sesammus)', 6, 'g', 300, '300-g-Glas', 'Tahin'],
    cashews: ['Cashewkerne', 6, 'g', 200, '200-g-Beutel', 'Cashewkerne'],

    // Pflanzendrinks
    sojamilch: ['Sojadrink ungesüßt', 7, 'ml', 1000, '1-L-Packung', 'Sojadrink ungesüßt'],

    // Tiefkühl
    edamame: ['Edamame geschält (TK)', 8, 'g', 400, '400-g-Beutel', 'Edamame tiefgekühlt'],
    erbsen: ['Erbsen (TK)', 8, 'g', 450, '450-g-Beutel', 'Erbsen tiefgekühlt'],
    tk_spinat: ['Blattspinat (TK)', 8, 'g', 450, '450-g-Packung', 'Blattspinat tiefgekühlt'],
    beeren: ['Beerenmischung (TK)', 8, 'g', 500, '500-g-Beutel', 'Beerenmischung tiefgekühlt'],

    // Vorrat
    oel: ['Oliven- oder Rapsöl', 9, 'EL', 0, '', 'Rapsöl', true],
    sojasauce: ['Sojasauce', 9, 'EL', 0, '', 'Sojasauce', true],
    gemuesebruehe: ['Gemüsebrühe (Pulver)', 9, 'TL', 0, '', 'Gemüsebrühe', true],
    paprikapulver: ['Paprikapulver edelsüß', 9, 'TL', 0, '', 'Paprikapulver', true],
    kreuzkuemmel: ['Kreuzkümmel', 9, 'TL', 0, '', 'Kreuzkümmel', true],
    currypulver: ['Currypulver', 9, 'TL', 0, '', 'Currypulver', true],
    currypaste: ['Rote Currypaste (vegan)', 9, 'EL', 0, '', 'rote Currypaste', true],
    kurkuma: ['Kurkuma', 9, 'TL', 0, '', 'Kurkuma', true],
    oregano: ['Oregano', 9, 'TL', 0, '', 'Oregano', true],
    hefeflocken: ['Hefeflocken', 9, 'EL', 0, '', 'Hefeflocken', true],
    ahornsirup: ['Ahornsirup', 9, 'EL', 0, '', 'Ahornsirup', true],
    senf: ['Senf', 9, 'TL', 0, '', 'Senf mittelscharf', true],
    tomatenmark: ['Tomatenmark', 9, 'EL', 0, '', 'Tomatenmark', true],
    sesam: ['Sesam', 9, 'EL', 0, '', 'Sesam', true],
    zimt: ['Zimt', 9, 'TL', 0, '', 'Zimt', true],
    chili: ['Chiliflocken', 9, 'TL', 0, '', 'Chiliflocken', true],
    salzpfeffer: ['Salz & Pfeffer', 9, 'Prise', 0, '', 'Salz', true],
  };

  // Richtpreise (Euro je Packung/Einheit bei REWE) als Ausgangsbasis vor echten Kassenbons
  const DEFAULT_PRICES = {
    zwiebel: 0.25, rote_zwiebel: 0.35, knoblauch: 0.89, ingwer: 0.79,
    paprika: 0.99, zucchini: 0.89, brokkoli: 1.49, karotte: 0.20,
    suesskartoffel: 1.19, kartoffeln: 1.99, tomaten: 0.45, cherrytomaten: 1.49,
    gurke: 0.99, avocado: 1.49, zitrone: 0.59, limette: 0.49,
    banane: 0.35, apfel: 0.45, babyspinat: 1.79, champignons: 1.99,
    fruehlingszwiebel: 0.89, kraeuter: 1.19,
    tofu: 1.49, raeuchertofu: 1.79, tempeh: 2.79, sojaskyr: 1.69,
    veganes_hack: 2.49, hummus: 1.49,
    vollkornbrot: 1.89, tortillas: 1.69,
    reis: 1.79, quinoa: 2.99, vollkornnudeln: 1.29, linsennudeln: 2.29,
    linsen_rot: 1.89, belugalinsen: 2.49, sojaschnetzel: 1.99,
    kichererbsen: 0.99, kidneybohnen: 0.99, schwarzebohnen: 1.19,
    weissebohnen: 0.99, tomaten_dose: 0.89, passata: 0.99,
    kokosmilch: 1.49, mais: 0.99, seidentofu: 2.49,
    granola: 2.99, haferflocken: 0.89, proteinpulver: 14.99,
    chia: 2.29, hanfsamen: 3.49, kuerbiskerne: 2.19,
    erdnussmus: 2.79, tahini: 3.29, cashews: 2.79,
    sojamilch: 1.19,
    edamame: 2.99, erbsen: 1.69, tk_spinat: 1.29, beeren: 2.99,
    oel: 2.49, sojasauce: 1.99, gemuesebruehe: 1.49, paprikapulver: 1.29,
    kreuzkuemmel: 1.79, currypulver: 1.49, currypaste: 2.29, kurkuma: 1.49,
    oregano: 1.19, hefeflocken: 3.49, ahornsirup: 3.99, senf: 0.99,
    tomatenmark: 0.89, sesam: 1.49, zimt: 1.29, chili: 1.29, salzpfeffer: 0.99,
  };

  const INGREDIENTS = {};
  for (const [key, r] of Object.entries(RAW)) {
    INGREDIENTS[key] = {
      key,
      name: r[0],
      cat: CATS[r[1]],
      catIndex: r[1],
      unit: r[2],
      pack: r[3],
      packLabel: r[4],
      search: r[5],
      pantry: !!r[6],
      defaultPrice: DEFAULT_PRICES[key] || 1.49,
    };
  }

  // Rezept-Helfer: i = [[key, menge], ...]
  const R = (o) => Object.assign({ tags: [], kcal: 0 }, o, {
    ingredients: o.i.map(([k, q]) => ({ k, q })),
  });

  const RECIPES = [
    // ---------- FRÜHSTÜCK ----------
    R({
      id: 'b_granola_skyr', meal: 'breakfast', name: 'Granola-Bowl mit Soja-Skyr & Beeren',
      time: 3, protein: 29, kcal: 520, tags: ['granola', 'schnell', 'süß'],
      i: [['granola', 60], ['sojaskyr', 200], ['beeren', 80], ['hanfsamen', 10]],
      steps: [
        'Beeren am Vorabend im Kühlschrank auftauen lassen (oder kurz in der Mikrowelle).',
        'Soja-Skyr in eine Schale geben, Beeren darauf verteilen.',
        'Mit Granola und Hanfsamen toppen – fertig.',
      ],
    }),
    R({
      id: 'b_granola_pb', meal: 'breakfast', name: 'Erdnuss-Granola mit Banane & Sojadrink',
      time: 3, protein: 20, kcal: 560, tags: ['granola', 'schnell', 'süß'],
      i: [['granola', 70], ['sojamilch', 250], ['banane', 1], ['erdnussmus', 15]],
      steps: [
        'Granola in eine Schale geben, Banane in Scheiben darüber schneiden.',
        'Erdnussmus darüber träufeln (bei Bedarf kurz anwärmen).',
        'Mit kaltem Sojadrink aufgießen.',
      ],
    }),
    R({
      id: 'b_granola_home', meal: 'breakfast', name: 'Hausgemachtes Protein-Granola mit Joghurt & Apfel',
      time: 25, protein: 30, kcal: 560, tags: ['granola', 'mealprep', 'süß'],
      i: [['haferflocken', 45], ['kuerbiskerne', 10], ['erdnussmus', 10], ['ahornsirup', 1], ['zimt', 0.5], ['sojaskyr', 200], ['apfel', 0.5]],
      steps: [
        'Ofen auf 170 °C Umluft vorheizen. Die Granola-Menge für die ganze Woche auf einmal machen.',
        'Haferflocken, Kürbiskerne und Zimt mischen. Erdnussmus mit Ahornsirup verrühren und unterheben, bis alles leicht klebt.',
        'Auf einem Blech mit Backpapier verteilen, 15–18 Min. backen, nach der Hälfte einmal wenden.',
        'Abkühlen lassen (wird dann knusprig) und in einem Glas aufbewahren.',
        'Morgens Soja-Skyr in eine Schale, Apfel klein schneiden, Granola darüber.',
      ],
    }),
    R({
      id: 'b_granola_chia', meal: 'breakfast', name: 'Chia-Pudding mit Granola-Topping',
      time: 5, protein: 19, kcal: 470, tags: ['granola', 'mealprep', 'süß'],
      i: [['chia', 30], ['sojamilch', 250], ['granola', 35], ['beeren', 80], ['hanfsamen', 5]],
      steps: [
        'Am Vorabend Chiasamen mit Sojadrink in ein Glas geben, gut verrühren, nach 5 Min. nochmal rühren.',
        'Über Nacht in den Kühlschrank stellen.',
        'Morgens Beeren und Granola darauf geben, mit Hanfsamen bestreuen.',
      ],
    }),
    R({
      id: 'b_oats', meal: 'breakfast', name: 'Protein-Overnight-Oats mit Beeren',
      time: 5, protein: 27, kcal: 500, tags: ['mealprep', 'süß'],
      i: [['haferflocken', 60], ['sojamilch', 200], ['chia', 10], ['sojaskyr', 100], ['beeren', 80]],
      steps: [
        'Am Vorabend Haferflocken, Chiasamen, Sojadrink und Soja-Skyr in einem Glas verrühren.',
        'Gefrorene Beeren obendrauf geben, Deckel drauf, ab in den Kühlschrank.',
        'Morgens umrühren und kalt genießen.',
      ],
    }),
    R({
      id: 'b_scramble', meal: 'breakfast', name: 'Tofu-Rührei mit Spinat auf Vollkornbrot',
      time: 15, protein: 28, kcal: 480, tags: ['herzhaft', 'wochenende'],
      i: [['tofu', 150], ['babyspinat', 30], ['tomaten', 1], ['vollkornbrot', 100], ['kurkuma', 0.25], ['hefeflocken', 1], ['oel', 1], ['salzpfeffer', 1]],
      steps: [
        'Öl in einer Pfanne erhitzen, Tofu mit der Hand hineinbröseln.',
        'Kurkuma, Hefeflocken, Salz und Pfeffer zugeben und 5 Min. braten.',
        'Babyspinat und gewürfelte Tomate unterheben, bis der Spinat zusammenfällt.',
        'Auf getoastetem Vollkornbrot servieren.',
      ],
    }),
    R({
      id: 'b_smoothie', meal: 'breakfast', name: 'Beeren-Protein-Smoothie',
      time: 5, protein: 35, kcal: 450, tags: ['schnell', 'süß', 'smoothie'],
      i: [['sojamilch', 300], ['banane', 1], ['beeren', 100], ['proteinpulver', 30], ['haferflocken', 20]],
      steps: [
        'Alle Zutaten in den Mixer geben.',
        '30–60 Sek. fein mixen. Bei Bedarf etwas Wasser zugeben.',
      ],
    }),
    R({
      id: 'b_hummus_bread', meal: 'breakfast', name: 'Herzhafte Brote mit Hummus & Räuchertofu',
      time: 5, protein: 22, kcal: 470, tags: ['herzhaft', 'schnell'],
      i: [['vollkornbrot', 100], ['hummus', 50], ['raeuchertofu', 60], ['gurke', 0.25], ['salzpfeffer', 1]],
      steps: [
        'Brot mit Hummus bestreichen.',
        'Räuchertofu in dünne Scheiben schneiden (optional kurz anbraten) und mit Gurkenscheiben belegen.',
        'Mit Pfeffer würzen.',
      ],
    }),

    // ---------- HAUPTGERICHTE ----------
    R({
      id: 'm_dal', meal: 'main', name: 'Rote-Linsen-Dal mit Spinat & Reis',
      time: 30, protein: 24, kcal: 620, tags: ['curry', 'indisch', 'mealprep', 'eintopf'],
      i: [['linsen_rot', 80], ['kokosmilch', 0.25], ['tomaten_dose', 0.25], ['zwiebel', 0.5], ['knoblauch', 1], ['ingwer', 5], ['tk_spinat', 75], ['reis', 60], ['currypulver', 1], ['oel', 0.5], ['gemuesebruehe', 0.5]],
      steps: [
        'Reis nach Packungsanleitung kochen.',
        'Zwiebel, Knoblauch und Ingwer fein hacken und in Öl 3 Min. anschwitzen. Currypulver kurz mitrösten.',
        'Linsen abspülen, mit Tomaten, Kokosmilch und ca. 200 ml Wasser pro Portion plus Brühe zugeben.',
        '15 Min. köcheln lassen, bis die Linsen zerfallen. Spinat zugeben und 3 Min. mitziehen lassen.',
        'Mit Salz abschmecken und mit Reis servieren.',
      ],
    }),
    R({
      id: 'm_chili', meal: 'main', name: 'Chili sin Carne mit Sojaschnetzeln',
      time: 35, protein: 35, kcal: 610, tags: ['mexikanisch', 'mealprep', 'scharf', 'eintopf'],
      i: [['sojaschnetzel', 40], ['kidneybohnen', 0.5], ['mais', 0.25], ['tomaten_dose', 0.5], ['paprika', 0.5], ['zwiebel', 0.5], ['knoblauch', 1], ['reis', 60], ['kreuzkuemmel', 0.5], ['paprikapulver', 1], ['tomatenmark', 1], ['gemuesebruehe', 0.5], ['oel', 0.5], ['chili', 0.25]],
      steps: [
        'Sojaschnetzel 10 Min. in heißer Gemüsebrühe einweichen, dann gut ausdrücken.',
        'Reis nach Packungsanleitung kochen.',
        'Zwiebel, Knoblauch und Paprika würfeln. Schnetzel in Öl kräftig anbraten, Gemüse dazu.',
        'Tomatenmark und Gewürze 1 Min. mitrösten, dann Tomaten, abgespülte Bohnen und Mais zugeben.',
        '15 Min. köcheln lassen, abschmecken und mit Reis servieren.',
      ],
    }),
    R({
      id: 'm_tofu_brokkoli', meal: 'main', name: 'Knusprige Tofu-Brokkoli-Pfanne mit Erdnusssauce',
      time: 25, protein: 29, kcal: 640, tags: ['asiatisch', 'pfanne'],
      i: [['tofu', 150], ['brokkoli', 0.5], ['reis', 70], ['erdnussmus', 20], ['sojasauce', 1.5], ['limette', 0.25], ['knoblauch', 1], ['oel', 1], ['sesam', 0.5]],
      steps: [
        'Reis kochen. Tofu trocken tupfen, würfeln und in Öl rundum goldbraun braten (ca. 8 Min.).',
        'Brokkoli in Röschen teilen, zum Tofu geben und mit einem Schuss Wasser 4 Min. dünsten.',
        'Sauce: Erdnussmus, Sojasauce, gepressten Knoblauch, Limettensaft und 2 EL warmes Wasser pro Portion verrühren.',
        'Sauce in die Pfanne geben, durchschwenken, mit Sesam bestreuen und mit Reis servieren.',
      ],
    }),
    R({
      id: 'm_kichererbsen_curry', meal: 'main', name: 'Süßkartoffel-Kichererbsen-Curry mit Edamame',
      time: 30, protein: 25, kcal: 650, tags: ['curry', 'mealprep', 'eintopf'],
      i: [['kichererbsen', 0.5], ['suesskartoffel', 0.5], ['edamame', 60], ['kokosmilch', 0.25], ['babyspinat', 40], ['currypaste', 1], ['zwiebel', 0.5], ['quinoa', 60], ['oel', 0.5]],
      steps: [
        'Quinoa abspülen und nach Packungsanleitung kochen.',
        'Zwiebel würfeln und in Öl anschwitzen, Currypaste 1 Min. mitrösten.',
        'Süßkartoffel in 1-cm-Würfel schneiden, mit Kokosmilch und 100 ml Wasser pro Portion zugeben, 12 Min. köcheln.',
        'Kichererbsen (abgespült) und Edamame zugeben, weitere 5 Min. köcheln. Spinat unterheben.',
        'Mit Salz abschmecken und mit Quinoa servieren.',
      ],
    }),
    R({
      id: 'm_bolognese', meal: 'main', name: 'Protein-Bolognese mit Linsennudeln',
      time: 25, protein: 42, kcal: 620, tags: ['pasta', 'italienisch'],
      i: [['veganes_hack', 100], ['linsennudeln', 100], ['passata', 150], ['zwiebel', 0.5], ['karotte', 0.5], ['knoblauch', 1], ['oregano', 0.5], ['tomatenmark', 1], ['oel', 0.5], ['salzpfeffer', 1]],
      steps: [
        'Zwiebel, Karotte und Knoblauch fein würfeln.',
        'Hack in Öl krümelig anbraten, Gemüse zugeben und 3 Min. mitbraten.',
        'Tomatenmark kurz mitrösten, Passata und Oregano dazu, 10 Min. köcheln.',
        'Linsennudeln nach Packungsanleitung kochen (nicht zu lange – sie werden schnell weich).',
        'Mit der Sauce mischen und servieren.',
      ],
    }),
    R({
      id: 'm_tempeh_bowl', meal: 'main', name: 'Tempeh-Bowl mit Quinoa, Edamame & Gurke',
      time: 25, protein: 34, kcal: 610, tags: ['bowl', 'asiatisch', 'mealprep'],
      i: [['tempeh', 100], ['quinoa', 60], ['edamame', 50], ['karotte', 0.5], ['gurke', 0.25], ['sojasauce', 1.5], ['ahornsirup', 0.5], ['sesam', 0.5], ['oel', 0.5]],
      steps: [
        'Quinoa kochen, Edamame die letzten 3 Min. mitgaren.',
        'Tempeh in Scheiben schneiden und in Öl von beiden Seiten knusprig braten.',
        'Sojasauce und Ahornsirup zugeben und den Tempeh darin glasieren.',
        'Karotte raspeln, Gurke in Scheiben schneiden.',
        'Alles in Schalen anrichten und mit Sesam bestreuen.',
      ],
    }),
    R({
      id: 'm_ofengemuese', meal: 'main', name: 'Ofengemüse mit Kichererbsen, Räuchertofu & Tahin-Dip',
      time: 35, protein: 27, kcal: 630, tags: ['ofen', 'orientalisch'],
      i: [['kichererbsen', 0.5], ['raeuchertofu', 75], ['suesskartoffel', 0.5], ['paprika', 0.5], ['rote_zwiebel', 0.5], ['tahini', 20], ['zitrone', 0.25], ['paprikapulver', 1], ['kreuzkuemmel', 0.5], ['oel', 1]],
      steps: [
        'Ofen auf 210 °C Umluft vorheizen.',
        'Süßkartoffel, Paprika, Zwiebel und Räuchertofu würfeln, mit abgetropften Kichererbsen, Öl und Gewürzen mischen.',
        'Auf einem Blech 25 Min. rösten, nach der Hälfte wenden.',
        'Dip: Tahin mit Zitronensaft, Salz und Wasser glatt rühren.',
        'Gemüse mit Dip servieren.',
      ],
    }),
    R({
      id: 'm_burrito', meal: 'main', name: 'Burrito-Wraps mit schwarzen Bohnen & Räuchertofu',
      time: 20, protein: 31, kcal: 650, tags: ['mexikanisch', 'schnell', 'wraps'],
      i: [['tortillas', 2], ['schwarzebohnen', 0.5], ['raeuchertofu', 75], ['avocado', 0.5], ['tomaten', 1], ['mais', 0.25], ['limette', 0.25], ['kreuzkuemmel', 0.5], ['oel', 0.5]],
      steps: [
        'Räuchertofu würfeln und in Öl anbraten. Abgespülte Bohnen, Mais und Kreuzkümmel zugeben, 3 Min. erhitzen.',
        'Avocado mit Limettensaft und Salz zerdrücken, Tomate würfeln.',
        'Tortillas kurz in einer trockenen Pfanne erwärmen.',
        'Mit Avocado bestreichen, Füllung und Tomate darauf geben, einrollen.',
      ],
    }),
    R({
      id: 'm_linsensalat', meal: 'main', name: 'Belugalinsen-Salat mit Räuchertofu',
      time: 25, protein: 30, kcal: 540, tags: ['salat', 'mealprep', 'kalt'],
      i: [['belugalinsen', 70], ['raeuchertofu', 75], ['gurke', 0.25], ['cherrytomaten', 80], ['rote_zwiebel', 0.25], ['kraeuter', 0.25], ['zitrone', 0.25], ['senf', 0.5], ['oel', 1], ['salzpfeffer', 1]],
      steps: [
        'Belugalinsen in Wasser ca. 20 Min. bissfest kochen, abgießen und abkühlen lassen.',
        'Räuchertofu würfeln und anbraten (optional).',
        'Gurke, Tomaten, Zwiebel und Kräuter klein schneiden.',
        'Dressing aus Zitronensaft, Senf, Öl, Salz und Pfeffer verrühren.',
        'Alles mischen – hält sich 3 Tage im Kühlschrank, ideal fürs Mittagessen.',
      ],
    }),
    R({
      id: 'm_fried_rice', meal: 'main', name: 'Gebratener Reis mit Tofu & Erbsen',
      time: 20, protein: 28, kcal: 600, tags: ['asiatisch', 'schnell', 'pfanne'],
      i: [['tofu', 150], ['reis', 70], ['erbsen', 80], ['karotte', 0.5], ['fruehlingszwiebel', 0.25], ['knoblauch', 1], ['sojasauce', 2], ['oel', 1]],
      steps: [
        'Reis kochen (am besten schon am Vortag – kalter Reis brät besser).',
        'Tofu zerbröseln und in Öl goldbraun braten, an den Rand schieben.',
        'Karotte würfeln und mit Knoblauch 2 Min. braten, Erbsen und Reis zugeben.',
        'Mit Sojasauce ablöschen und alles 3–4 Min. kräftig braten.',
        'Mit Frühlingszwiebeln bestreuen.',
      ],
    }),
    R({
      id: 'm_bohnen_pasta', meal: 'main', name: 'Cremige Tomaten-Bohnen-Pasta mit Spinat',
      time: 20, protein: 30, kcal: 620, tags: ['pasta', 'italienisch', 'schnell'],
      i: [['vollkornnudeln', 100], ['weissebohnen', 0.5], ['seidentofu', 100], ['passata', 100], ['babyspinat', 40], ['knoblauch', 1], ['hefeflocken', 1], ['oregano', 0.5], ['oel', 0.5]],
      steps: [
        'Nudeln nach Packungsanleitung kochen.',
        'Seidentofu, Passata, Hefeflocken und Knoblauch mit dem Pürierstab glatt mixen.',
        'Sauce in einer Pfanne erhitzen, abgespülte Bohnen und Oregano zugeben, 5 Min. köcheln.',
        'Spinat unterheben, Nudeln dazugeben und mit Salz und Pfeffer abschmecken.',
      ],
    }),
    R({
      id: 'm_linsensuppe', meal: 'main', name: 'Rote-Linsen-Tomatensuppe mit Brot',
      time: 25, protein: 24, kcal: 520, tags: ['suppe', 'mealprep', 'eintopf'],
      i: [['linsen_rot', 70], ['tomaten_dose', 0.5], ['karotte', 0.5], ['zwiebel', 0.5], ['knoblauch', 1], ['gemuesebruehe', 1], ['vollkornbrot', 50], ['hanfsamen', 5], ['kreuzkuemmel', 0.5], ['oel', 0.5]],
      steps: [
        'Zwiebel, Knoblauch und Karotte würfeln und in Öl anschwitzen.',
        'Linsen, Tomaten, Kreuzkümmel und 300 ml Brühe pro Portion zugeben.',
        '15 Min. köcheln, dann fein pürieren.',
        'Mit Hanfsamen bestreuen und mit Brot servieren.',
      ],
    }),
    R({
      id: 'm_gyros', meal: 'main', name: 'Soja-Gyros mit Reis & Soja-Tzatziki',
      time: 25, protein: 39, kcal: 630, tags: ['griechisch', 'pfanne'],
      i: [['sojaschnetzel', 50], ['sojaskyr', 100], ['gurke', 0.25], ['knoblauch', 1], ['reis', 60], ['tomaten', 1], ['rote_zwiebel', 0.25], ['paprikapulver', 1], ['oregano', 0.5], ['gemuesebruehe', 0.5], ['oel', 1]],
      steps: [
        'Sojaschnetzel 10 Min. in heißer Brühe einweichen, dann sehr gut ausdrücken.',
        'Reis kochen.',
        'Tzatziki: Gurke reiben, ausdrücken, mit Soja-Skyr, ½ Knoblauchzehe und Salz verrühren.',
        'Schnetzel mit Paprika, Oregano und restlichem Knoblauch in Öl scharf und knusprig anbraten.',
        'Mit Reis, Tomaten, Zwiebelringen und Tzatziki servieren.',
      ],
    }),
    R({
      id: 'm_shakshuka', meal: 'main', name: 'Bohnen-Shakshuka mit Tofu-Bröseln & Brot',
      time: 25, protein: 26, kcal: 540, tags: ['orientalisch', 'pfanne'],
      i: [['weissebohnen', 0.5], ['tofu', 100], ['tomaten_dose', 0.5], ['paprika', 0.5], ['zwiebel', 0.5], ['vollkornbrot', 50], ['kreuzkuemmel', 0.5], ['paprikapulver', 0.5], ['kraeuter', 0.25], ['oel', 0.5]],
      steps: [
        'Zwiebel und Paprika würfeln und in Öl 5 Min. anbraten, Gewürze kurz mitrösten.',
        'Tomaten und abgespülte Bohnen zugeben, 10 Min. köcheln.',
        'Tofu darüber bröseln, salzen und 3 Min. mitziehen lassen.',
        'Mit Kräutern bestreuen und mit Brot zum Dippen servieren.',
      ],
    }),
    R({
      id: 'm_stroganoff', meal: 'main', name: 'Champignon-Stroganoff mit Räuchertofu & Nudeln',
      time: 25, protein: 32, kcal: 610, tags: ['pilze', 'pasta'],
      i: [['champignons', 150], ['raeuchertofu', 100], ['zwiebel', 0.5], ['vollkornnudeln', 90], ['sojamilch', 120], ['senf', 1], ['paprikapulver', 1], ['oel', 1], ['kraeuter', 0.25]],
      steps: [
        'Nudeln kochen.',
        'Räuchertofu und Zwiebel würfeln, Champignons in Scheiben schneiden.',
        'Tofu in Öl knusprig braten, Zwiebel und Pilze zugeben und 5 Min. braten.',
        'Paprikapulver und Senf einrühren, mit Sojadrink ablöschen, 3 Min. einköcheln lassen.',
        'Mit Nudeln mischen und mit Kräutern bestreuen.',
      ],
    }),
    R({
      id: 'm_nudelsalat', meal: 'main', name: 'Asia-Nudelsalat mit Edamame & Erdnussdressing',
      time: 20, protein: 27, kcal: 600, tags: ['salat', 'asiatisch', 'kalt', 'mealprep'],
      i: [['vollkornnudeln', 80], ['edamame', 90], ['karotte', 0.5], ['gurke', 0.25], ['erdnussmus', 20], ['sojasauce', 1], ['limette', 0.25], ['fruehlingszwiebel', 0.25]],
      steps: [
        'Nudeln kochen, Edamame die letzten 3 Min. mitkochen, abgießen und kalt abschrecken.',
        'Karotte und Gurke in feine Streifen schneiden.',
        'Dressing: Erdnussmus, Sojasauce, Limettensaft und etwas warmes Wasser verrühren.',
        'Alles mischen und mit Frühlingszwiebeln bestreuen. Schmeckt auch kalt am nächsten Tag.',
      ],
    }),
    R({
      id: 'm_kartoffel_tofu', meal: 'main', name: 'Kartoffel-Tofu-Pfanne mit Brokkoli',
      time: 30, protein: 27, kcal: 580, tags: ['pfanne', 'hausmannskost'],
      i: [['kartoffeln', 250], ['tofu', 150], ['brokkoli', 0.33], ['zwiebel', 0.5], ['paprikapulver', 1], ['hefeflocken', 1], ['oel', 1.5], ['salzpfeffer', 1]],
      steps: [
        'Kartoffeln in Würfel schneiden und 8 Min. in Salzwasser vorkochen, Brokkoli die letzten 2 Min. mitgaren.',
        'Tofu würfeln und in Öl knusprig braten, herausnehmen.',
        'Kartoffeln und Zwiebel in der Pfanne 10 Min. goldbraun braten.',
        'Tofu, Brokkoli, Paprikapulver und Hefeflocken zugeben, durchschwenken, abschmecken.',
      ],
    }),
    R({
      id: 'm_thai_curry', meal: 'main', name: 'Rotes Thai-Curry mit Tofu & Gemüse',
      time: 25, protein: 25, kcal: 640, tags: ['curry', 'asiatisch', 'scharf'],
      i: [['tofu', 150], ['kokosmilch', 0.25], ['currypaste', 1], ['paprika', 0.5], ['zucchini', 0.5], ['reis', 60], ['limette', 0.25], ['sojasauce', 0.5], ['oel', 0.5]],
      steps: [
        'Reis kochen. Tofu würfeln und in Öl anbraten, herausnehmen.',
        'Currypaste im Topf 1 Min. anrösten, Kokosmilch und 50 ml Wasser pro Portion zugeben.',
        'Paprika und Zucchini in Stücke schneiden und 6 Min. darin köcheln.',
        'Tofu zurückgeben, mit Sojasauce und Limettensaft abschmecken, mit Reis servieren.',
      ],
    }),
    R({
      id: 'm_quinoa_hummus', meal: 'main', name: 'Quinoa-Bowl mit Hummus & Röst-Kichererbsen',
      time: 25, protein: 26, kcal: 620, tags: ['bowl', 'orientalisch', 'mealprep'],
      i: [['quinoa', 60], ['kichererbsen', 0.5], ['hummus', 60], ['gurke', 0.25], ['cherrytomaten', 80], ['babyspinat', 30], ['hanfsamen', 10], ['zitrone', 0.25], ['paprikapulver', 0.5], ['oel', 0.5]],
      steps: [
        'Quinoa kochen.',
        'Kichererbsen abtropfen, trocken tupfen und mit Öl und Paprikapulver in der Pfanne 8 Min. knusprig rösten.',
        'Gurke und Tomaten schneiden.',
        'Spinat, Quinoa, Gemüse und Kichererbsen in Schalen anrichten, Hummus dazu.',
        'Mit Zitronensaft beträufeln und Hanfsamen bestreuen.',
      ],
    }),
    R({
      id: 'm_zucchini_bolo', meal: 'main', name: 'Zucchini-Linsen-Bolognese mit Vollkornnudeln',
      time: 25, protein: 27, kcal: 590, tags: ['pasta', 'italienisch', 'mealprep'],
      i: [['linsen_rot', 50], ['zucchini', 0.5], ['passata', 150], ['vollkornnudeln', 90], ['zwiebel', 0.5], ['knoblauch', 1], ['oregano', 0.5], ['tomatenmark', 1], ['oel', 0.5]],
      steps: [
        'Zwiebel, Knoblauch und Zucchini fein würfeln und in Öl 5 Min. anbraten.',
        'Tomatenmark kurz mitrösten, Linsen, Passata, Oregano und 100 ml Wasser pro Portion zugeben.',
        '15 Min. köcheln, bis die Linsen weich sind. Mit Salz und Pfeffer abschmecken.',
        'Nudeln kochen und mit der Sauce servieren.',
      ],
    }),
    R({
      id: 'm_tempeh_wrap', meal: 'main', name: 'Tempeh-Wraps mit Erdnusssauce & Rohkost',
      time: 20, protein: 28, kcal: 620, tags: ['wraps', 'asiatisch', 'schnell'],
      i: [['tortillas', 2], ['tempeh', 75], ['karotte', 0.5], ['gurke', 0.25], ['erdnussmus', 15], ['sojasauce', 1], ['limette', 0.25], ['oel', 0.5]],
      steps: [
        'Tempeh in Streifen schneiden, in Öl knusprig braten und mit ½ EL Sojasauce ablöschen.',
        'Karotte raspeln, Gurke in Streifen schneiden.',
        'Erdnussmus mit restlicher Sojasauce, Limettensaft und etwas Wasser verrühren.',
        'Tortillas erwärmen, mit Sauce bestreichen, füllen und aufrollen.',
      ],
    }),
    R({
      id: 'm_suesskartoffel', meal: 'main', name: 'Gefüllte Ofen-Süßkartoffel mit schwarzen Bohnen',
      time: 40, protein: 24, kcal: 600, tags: ['ofen', 'mexikanisch'],
      i: [['suesskartoffel', 1], ['schwarzebohnen', 0.5], ['sojaskyr', 75], ['mais', 0.25], ['avocado', 0.25], ['limette', 0.25], ['hanfsamen', 10], ['kreuzkuemmel', 0.5], ['oel', 0.5]],
      steps: [
        'Ofen auf 200 °C vorheizen. Süßkartoffel längs halbieren, mit Öl einreiben und 30–35 Min. backen.',
        'Bohnen und Mais mit Kreuzkümmel in einem Topf erwärmen.',
        'Soja-Skyr mit Limettensaft und Salz verrühren.',
        'Süßkartoffel aufdrücken, mit Bohnen-Mais, Avocado, Skyr und Hanfsamen füllen.',
      ],
    }),
  ];

  // ---------- PROTEIN-SNACKS ----------
  RECIPES.push(
    R({
      id: 's_skyr', meal: 'snack', name: 'Soja-Skyr mit Hanfsamen & Zimt',
      time: 2, protein: 18, kcal: 220, tags: ['süß', 'schnell'],
      i: [['sojaskyr', 150], ['hanfsamen', 10], ['zimt', 0.25]],
      steps: ['Soja-Skyr in eine Schale geben, mit Hanfsamen und Zimt bestreuen.'],
    }),
    R({
      id: 's_edamame', meal: 'snack', name: 'Edamame mit Meersalz & Limette',
      time: 5, protein: 14, kcal: 160, tags: ['herzhaft', 'schnell'],
      i: [['edamame', 120], ['limette', 0.25], ['salzpfeffer', 1]],
      steps: ['Edamame 3–4 Min. in kochendem Wasser garen, abgießen.', 'Mit grobem Salz und Limettensaft würzen. Warm oder kalt genießen.'],
    }),
    R({
      id: 's_shake', meal: 'snack', name: 'Protein-Shake mit Sojadrink',
      time: 2, protein: 32, kcal: 230, tags: ['süß', 'schnell', 'smoothie'],
      i: [['sojamilch', 300], ['proteinpulver', 30]],
      steps: ['Proteinpulver mit kaltem Sojadrink in einem Shaker oder Glas kräftig verrühren.'],
    }),
    R({
      id: 's_hummus', meal: 'snack', name: 'Hummus-Teller mit Karotten & Räuchertofu',
      time: 5, protein: 14, kcal: 260, tags: ['herzhaft', 'schnell'],
      i: [['hummus', 50], ['karotte', 1], ['raeuchertofu', 50]],
      steps: ['Karotte in Sticks schneiden, Räuchertofu in Würfel.', 'Mit Hummus zum Dippen servieren.'],
    }),
  );

  // Synonyme für das Freitext-Feedback (Wort -> betroffene Zutaten/Tags)
  const SYNONYMS = [
    { w: ['granola', 'knuspermüsli', 'knuspermuesli', 'crunchy', 'müsli', 'muesli'], tag: 'granola', ing: ['granola'], label: 'Granola' },
    { w: ['räuchertofu', 'raeuchertofu'], ing: ['raeuchertofu'], label: 'Räuchertofu' },
    { w: ['seidentofu'], ing: ['seidentofu'], label: 'Seidentofu' },
    { w: ['tofu'], ing: ['tofu', 'raeuchertofu', 'seidentofu'], label: 'Tofu' },
    { w: ['tempeh'], ing: ['tempeh'], label: 'Tempeh' },
    { w: ['soja'], ing: ['tofu', 'raeuchertofu', 'seidentofu', 'tempeh', 'sojamilch', 'sojaskyr', 'edamame', 'sojaschnetzel'], label: 'Soja' },
    { w: ['sojaschnetzel', 'schnetzel'], ing: ['sojaschnetzel'], label: 'Sojaschnetzel' },
    { w: ['hack'], ing: ['veganes_hack'], label: 'veganes Hack' },
    { w: ['erdnuss', 'erdnüsse', 'erdnussmus'], ing: ['erdnussmus'], label: 'Erdnuss' },
    { w: ['nüsse', 'nuesse', 'nuss'], ing: ['erdnussmus', 'cashews'], label: 'Nüsse' },
    { w: ['sesam', 'tahin', 'tahini'], ing: ['tahini', 'sesam'], label: 'Sesam/Tahin' },
    { w: ['gluten', 'weizen'], ing: ['vollkornnudeln', 'vollkornbrot', 'tortillas', 'granola', 'haferflocken'], label: 'Gluten' },
    { w: ['pilze', 'champignons', 'champignon'], ing: ['champignons'], label: 'Pilze' },
    { w: ['koriander', 'petersilie', 'kräuter', 'kraeuter'], ing: ['kraeuter'], label: 'Kräuter' },
    { w: ['kichererbse', 'kichererbsen'], ing: ['kichererbsen'], label: 'Kichererbsen' },
    { w: ['linsennudeln', 'linsenpasta'], ing: ['linsennudeln'], label: 'Linsennudeln' },
    { w: ['linse', 'linsen', 'dal'], ing: ['linsen_rot', 'belugalinsen', 'linsennudeln'], label: 'Linsen' },
    { w: ['bohne', 'bohnen'], ing: ['kidneybohnen', 'schwarzebohnen', 'weissebohnen'], label: 'Bohnen' },
    { w: ['edamame'], ing: ['edamame'], label: 'Edamame' },
    { w: ['avocado', 'avocados'], ing: ['avocado'], label: 'Avocado' },
    { w: ['aubergine'], ing: [], label: 'Aubergine' },
    { w: ['zucchini'], ing: ['zucchini'], label: 'Zucchini' },
    { w: ['paprika'], ing: ['paprika'], label: 'Paprika' },
    { w: ['brokkoli', 'broccoli'], ing: ['brokkoli'], label: 'Brokkoli' },
    { w: ['süßkartoffel', 'suesskartoffel', 'süßkartoffeln'], ing: ['suesskartoffel'], label: 'Süßkartoffel' },
    { w: ['kartoffel', 'kartoffeln'], ing: ['kartoffeln'], label: 'Kartoffeln' },
    { w: ['reis'], ing: ['reis'], label: 'Reis' },
    { w: ['quinoa'], ing: ['quinoa'], label: 'Quinoa' },
    { w: ['kokos', 'kokosmilch'], ing: ['kokosmilch'], label: 'Kokosmilch' },
    { w: ['spinat'], ing: ['babyspinat', 'tk_spinat'], label: 'Spinat' },
    { w: ['tomate', 'tomaten'], ing: ['tomaten', 'cherrytomaten', 'tomaten_dose', 'passata'], label: 'Tomaten' },
    { w: ['zwiebel', 'zwiebeln'], ing: ['zwiebel', 'rote_zwiebel', 'fruehlingszwiebel'], label: 'Zwiebeln' },
    { w: ['knoblauch'], ing: ['knoblauch'], label: 'Knoblauch' },
    { w: ['ingwer'], ing: ['ingwer'], label: 'Ingwer' },
    { w: ['gurke', 'gurken'], ing: ['gurke'], label: 'Gurke' },
    { w: ['banane', 'bananen'], ing: ['banane'], label: 'Banane' },
    { w: ['beeren', 'blaubeeren', 'himbeeren'], ing: ['beeren'], label: 'Beeren' },
    { w: ['oats', 'haferflocken', 'hafer', 'porridge'], ing: ['haferflocken'], label: 'Haferflocken' },
    { w: ['chia'], ing: ['chia'], label: 'Chia' },
    { w: ['proteinpulver', 'proteinshake', 'shake'], ing: ['proteinpulver'], label: 'Proteinpulver' },
    { w: ['joghurt', 'skyr', 'yoghurt'], ing: ['sojaskyr'], label: 'Soja-Joghurt' },
    { w: ['hummus'], ing: ['hummus'], label: 'Hummus' },
    { w: ['karotte', 'karotten', 'möhre', 'möhren'], ing: ['karotte'], label: 'Karotten' },
    { w: ['erbsen'], ing: ['erbsen'], label: 'Erbsen' },
    { w: ['brot'], ing: ['vollkornbrot'], label: 'Brot' },
    { w: ['wraps', 'wrap', 'tortilla', 'burrito'], tag: 'wraps', ing: [], label: 'Wraps' },
    { w: ['nudeln', 'pasta', 'spaghetti'], tag: 'pasta', ing: [], label: 'Pasta' },
    { w: ['scharf', 'chili'], tag: 'scharf', ing: [], label: 'scharfes Essen' },
    { w: ['asiatisch', 'asia'], tag: 'asiatisch', ing: [], label: 'Asiatisch' },
    { w: ['curry', 'currys'], tag: 'curry', ing: [], label: 'Curry' },
    { w: ['suppe', 'suppen', 'eintopf', 'eintöpfe'], tag: 'eintopf', ing: [], label: 'Suppen/Eintöpfe' },
    { w: ['salat', 'salate'], tag: 'salat', ing: [], label: 'Salate' },
    { w: ['bowl', 'bowls'], tag: 'bowl', ing: [], label: 'Bowls' },
    { w: ['ofen', 'ofengemüse'], tag: 'ofen', ing: [], label: 'Ofengerichte' },
    { w: ['mexikanisch'], tag: 'mexikanisch', ing: [], label: 'Mexikanisch' },
    { w: ['indisch'], tag: 'indisch', ing: [], label: 'Indisch' },
    { w: ['italienisch'], tag: 'italienisch', ing: [], label: 'Italienisch' },
    { w: ['griechisch'], tag: 'griechisch', ing: [], label: 'Griechisch' },
    { w: ['orientalisch'], tag: 'orientalisch', ing: [], label: 'Orientalisch' },
    { w: ['herzhaft'], tag: 'herzhaft', ing: [], label: 'herzhaftes Frühstück' },
    { w: ['süß', 'suess', 'süsses'], tag: 'süß', ing: [], label: 'süßes Frühstück' },
    { w: ['smoothie', 'smoothies'], tag: 'smoothie', ing: [], label: 'Smoothies' },
  ];

  root.VPData = { CATS, INGREDIENTS, RECIPES, SYNONYMS };
})(typeof window !== 'undefined' ? window : this);
