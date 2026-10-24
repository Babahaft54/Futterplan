/* Visuelles Screenshot-/Markierungs-Feedback-Tool (wie macOS Cmd+Shift+4) mit Prompt-Generator */
(function (root) {
  const STORAGE_KEY = 'veganWochenplaner.visualFeedback.v1';
  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const TAB_NAMES = {
    plan: '🗓️ Wochenplan',
    shop: '🛒 Einkauf',
    inventory: '📦 Inventar & Bons',
    recipes: '📖 Rezepte',
    feedback: '💬 Feedback',
    settings: '⚙️ Einstellungen',
  };

  let items = loadItems();
  let isSelecting = false;
  let isDrawerOpen = false;
  let showPins = true;
  let dragStart = null;
  let currentRect = null;
  let pendingCapture = null;

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { console.warn(e); }
    return [];
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) { console.warn(e); }
  }

  function currentTabKey() {
    const activeBtn = document.querySelector('#tabs button.active');
    return (activeBtn && activeBtn.dataset && activeBtn.dataset.tab) || location.hash.replace('#', '') || 'plan';
  }

  function describeElement(el) {
    if (!el || el === document.body || el === document.documentElement) return { selector: 'main#app', label: 'Hauptbereich', text: '' };
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 4) {
      let s = cur.tagName.toLowerCase();
      if (cur.id) {
        s += '#' + cur.id;
        parts.unshift(s);
        break;
      }
      if (cur.classList && cur.classList.length) {
        const cls = [...cur.classList].filter((c) => !['on', 'active'].includes(c)).slice(0, 2);
        if (cls.length) s += '.' + cls.join('.');
      }
      parts.unshift(s);
      cur = cur.parentElement;
    }

    // Sinnvolle Überschrift der umgebenden Karte / Sektion suchen
    const card = el.closest('.card, .banner, .day, .group, .stat, header, .modal');
    let sectionHeading = '';
    if (card) {
      const h = card.querySelector('h1, h2, h3, b');
      if (h) sectionHeading = h.textContent.replace(/\s+/g, ' ').trim().slice(0, 70);
    }

    const rawText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      selector: parts.join(' > '),
      section: sectionHeading || 'Ansicht',
      text: rawText.slice(0, 180) + (rawText.length > 180 ? ' …' : ''),
    };
  }

  function analyzeSelectionRect(rect) {
    const overlay = document.getElementById('vfOverlay');
    if (overlay) overlay.style.pointerEvents = 'none';

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const pts = [
      [cx, cy],
      [rect.left + Math.min(24, rect.width / 2), rect.top + Math.min(24, rect.height / 2)],
      [rect.right - Math.min(24, rect.width / 2), rect.bottom - Math.min(24, rect.height / 2)],
    ];

    let bestEl = null;
    for (const [x, y] of pts) {
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest('#vfRoot')) {
        bestEl = el;
        break;
      }
    }

    // Text aller relevanten Elemente im Auswahl-Rechteck sammeln
    const texts = [];
    if (rect.width > 15 && rect.height > 15) {
      const candidates = document.querySelectorAll('main h1, main h2, main h3, main .meal, main .item, main .stat, main .card, main button, main label, main td, main th, main p');
      candidates.forEach((node) => {
        const r = node.getBoundingClientRect();
        const overlaps =
          r.right > rect.left + 4 &&
          r.left < rect.right - 4 &&
          r.bottom > rect.top + 4 &&
          r.top < rect.bottom - 4;
        if (overlaps) {
          const t = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
          if (t && t.length <= 120 && !texts.includes(t)) texts.push(t);
        }
      });
    }

    if (overlay) overlay.style.pointerEvents = 'auto';

    const info = describeElement(bestEl);
    if (texts.length && (!info.text || texts.join(' | ').length < info.text.length * 1.5)) {
      info.text = texts.slice(0, 4).join(' · ').slice(0, 200);
    }
    return info;
  }

  function buildPromptText() {
    if (!items.length) return '';
    const lines = [
      'Bitte setze folgende Verbesserungen im Projekt "Veganer Wochenplaner" um (gesammelt über das visuelle Bereichs-Feedback):',
      '',
    ];
    items.forEach((it, idx) => {
      const tabLabel = TAB_NAMES[it.tab] || it.tab;
      lines.push(`### ${idx + 1}. [${tabLabel}] – ${it.section || 'Bereich'}`);
      lines.push(`- **Markiertes Element / Selektor**: \`${it.selector}\``);
      if (it.text) lines.push(`- **Sichtbarer Inhalt im markierten Bereich**: "${it.text}"`);
      lines.push(`- **Markierte Fläche**: ${Math.round(it.rect.width)}×${Math.round(it.rect.height)} px (Position x:${Math.round(it.rect.pageX)}, y:${Math.round(it.rect.pageY)})`);
      lines.push(`- **Gewünschte Änderung / Feedback**: ${it.comment}`);
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = msg;
      t.hidden = false;
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => (t.hidden = true), 2800);
    }
  }

  function copyPrompt() {
    const txt = buildPromptText();
    if (!txt) return showToast('Noch keine Feedback-Punkte markiert.');
    const done = () => showToast('📋 Gebündelter Feedback-Prompt kopiert – jetzt direkt im Chat einfügen!');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    } else {
      fallbackCopy(txt, done);
    }
  }

  function fallbackCopy(txt, cb) {
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) { alert(txt); }
    ta.remove();
  }

  function startSelectionMode() {
    isSelecting = true;
    isDrawerOpen = false;
    pendingCapture = null;
    currentRect = null;
    dragStart = null;
    renderWidget();
  }

  function cancelSelectionMode() {
    isSelecting = false;
    pendingCapture = null;
    currentRect = null;
    dragStart = null;
    renderWidget();
  }

  function renderPinsHtml() {
    if (!showPins || isSelecting) return '';
    const tab = currentTabKey();
    return items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => it.tab === tab && it.rect)
      .map(({ it, idx }) => {
        const left = Math.max(8, it.rect.pageX);
        const top = Math.max(56, it.rect.pageY);
        return `<div class="vf-pin-box" style="left:${left}px;top:${top}px;width:${Math.max(28, it.rect.width)}px;height:${Math.max(28, it.rect.height)}px" title="#${idx + 1}: ${esc(it.comment)}">
          <button class="vf-pin-badge" data-vf-open="${it.id}">#${idx + 1}</button>
        </div>`;
      })
      .join('');
  }

  function renderWidget() {
    let container = document.getElementById('vfRoot');
    if (!container) {
      container = document.createElement('div');
      container.id = 'vfRoot';
      container.className = 'no-print';
      document.body.appendChild(container);
    }

    const promptText = buildPromptText();
    let html = renderPinsHtml();

    // Floating Action Bar unten rechts
    html += `<div class="vf-fab-bar">
      <button class="vf-fab-btn primary ${isSelecting ? 'active' : ''}" data-vf-act="select" title="Bereich auf dem Bildschirm wie bei Cmd+Shift+4 markieren (Shortcut: Alt+Shift+F)">
        🎯 <span>Bereich markieren</span>
      </button>
      <button class="vf-fab-btn" data-vf-act="drawer" title="Gesammelte Feedback-Punkte & Prompt anzeigen">
        📋 <span>Prompt</span>
        ${items.length ? `<b class="vf-count">${items.length}</b>` : ''}
      </button>
    </div>`;

    // Crosshair-Auswahl-Overlay (Cmd + Shift + 4 Feeling)
    if (isSelecting) {
      const r = currentRect;
      const boxStyle = r
        ? `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;display:block;`
        : 'display:none;';
      const sizeLabel = r ? `${Math.round(r.width)} × ${Math.round(r.height)} px` : '';

      html += `<div class="vf-overlay" id="vfOverlay">
        <div class="vf-hud">
          <span>🎯 <b>Screenshot-Markierung aktiv:</b> Ziehe mit der Maus einen Rahmen über die Stelle, die du kommentieren möchtest</span>
          <button class="btn small" data-vf-act="cancel">Abbrechen (ESC)</button>
        </div>
        <div class="vf-crosshair-h" id="vfCrossH"></div>
        <div class="vf-crosshair-v" id="vfCrossV"></div>
        <div class="vf-coord-pill" id="vfCoordPill">0, 0</div>
        <div class="vf-selection-rect" id="vfSelRect" style="${boxStyle}">
          <span class="vf-size-tag" id="vfSizeTag">${sizeLabel}</span>
        </div>
      </div>`;

      if (pendingCapture) {
        const popLeft = Math.min(window.innerWidth - 360, Math.max(16, pendingCapture.rect.left));
        const popTop =
          pendingCapture.rect.bottom + 240 < window.innerHeight
            ? pendingCapture.rect.bottom + 12
            : Math.max(60, pendingCapture.rect.top - 225);

        html += `<div class="vf-popover card" style="left:${popLeft}px;top:${popTop}px">
          <div class="row" style="margin-bottom:6px">
            <b>🎯 Punkt #${items.length + 1} erfassen</b>
            <div class="spacer"></div>
            <span class="chip green">${esc(TAB_NAMES[pendingCapture.tab] || pendingCapture.tab)}</span>
          </div>
          <div class="vf-meta-box">
            <div><b>Bereich:</b> ${esc(pendingCapture.section)} (<code>${esc(pendingCapture.selector)}</code>)</div>
            ${pendingCapture.text ? `<div class="vf-quote">„${esc(pendingCapture.text)}“</div>` : ''}
          </div>
          <textarea id="vfCommentInput" placeholder="Was soll hier verbessert oder angepasst werden? (z. B. „Hier Preis pro kg ergänzen“ oder „Button größer machen“)"></textarea>
          <div class="row" style="margin-top:8px">
            <button class="btn small primary" data-vf-act="save-point">✓ Speichern</button>
            <button class="btn small" data-vf-act="save-and-next">➕ Speichern & noch eins</button>
            <div class="spacer"></div>
            <button class="btn small ghost" data-vf-act="cancel">Verwerfen</button>
          </div>
        </div>`;
      }
    }

    // Drawer für gesammeltes Feedback & Prompt-Ausgabe
    if (isDrawerOpen) {
      html += `<div class="vf-drawer card">
        <div class="row" style="margin-bottom:8px">
          <h3>🎯 Visuelles UI-Feedback (${items.length})</h3>
          <div class="spacer"></div>
          <label class="vf-pin-toggle"><input type="checkbox" id="vfTogglePins" ${showPins ? 'checked' : ''}/> Pins zeigen</label>
          <button class="icon-btn" data-vf-act="close-drawer" title="Schließen">✕</button>
        </div>
        <p class="sub" style="margin-bottom:10px">Markiere Stellen im Bildschirm wie mit <code>Cmd + Shift + 4</code>. Am Ende kopierst du alle Punkte gebündelt als fertigen Prompt.</p>
        <div class="row" style="margin-bottom:12px">
          <button class="btn small primary" data-vf-act="select">🎯 Neuen Bereich markieren</button>
          <button class="btn small primary" data-vf-act="copy-prompt" ${items.length ? '' : 'disabled'}>📋 Als Prompt kopieren</button>
          ${items.length ? `<button class="btn small ghost" data-vf-act="clear-all">🗑️ Alle löschen</button>` : ''}
        </div>
        <div class="vf-list">
          ${
            items.length
              ? items
                  .map(
                    (it, idx) => `<div class="vf-item">
                  <div class="row">
                    <span class="vf-badge">#${idx + 1}</span>
                    <b>${esc(TAB_NAMES[it.tab] || it.tab)} · ${esc(it.section)}</b>
                    <div class="spacer"></div>
                    <button class="icon-btn" data-vf-goto="${it.id}" title="Zur Stelle springen">↗</button>
                    <button class="icon-btn" data-vf-del="${it.id}" title="Punkt entfernen">✕</button>
                  </div>
                  <div class="vf-item-sel"><code>${esc(it.selector)}</code>${it.text ? ` · „${esc(it.text.slice(0, 70))}“` : ''}</div>
                  <div class="vf-item-comment">${esc(it.comment)}</div>
                </div>`
                  )
                  .join('')
              : '<div class="vf-empty">Noch keine Stellen markiert. Klicke auf <b>„🎯 Bereich markieren“</b> und ziehe mit der Maus einen Rahmen über ein beliebiges Element.</div>'
          }
        </div>
        ${
          items.length
            ? `<div class="vf-prompt-box">
            <div class="row" style="margin-bottom:4px">
              <small><b>Fertig gebündelter Prompt für Verbesserungen:</b></small>
              <div class="spacer"></div>
              <button class="btn small" data-vf-act="copy-prompt">📋 Kopieren</button>
            </div>
            <textarea readonly class="vf-prompt-out" id="vfPromptOut">${esc(promptText)}</textarea>
          </div>`
            : ''
        }
      </div>`;
    }

    container.innerHTML = html;

    if (pendingCapture) {
      const inp = document.getElementById('vfCommentInput');
      if (inp) {
        inp.focus();
        inp.onkeydown = (e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            saveCurrentCapture(false);
          }
        };
      }
    }

    const togglePinsEl = document.getElementById('vfTogglePins');
    if (togglePinsEl) {
      togglePinsEl.onchange = () => {
        showPins = togglePinsEl.checked;
        renderWidget();
      };
    }

    bindOverlayEvents();
  }

  function saveCurrentCapture(continueSelecting) {
    if (!pendingCapture) return;
    const inp = document.getElementById('vfCommentInput');
    const comment = inp ? inp.value.trim() : '';
    if (!comment) {
      showToast('Bitte beschreibe kurz, was an dieser Stelle angepasst werden soll.');
      if (inp) inp.focus();
      return;
    }
    items.push({
      id: 'vf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      createdAt: new Date().toISOString(),
      tab: pendingCapture.tab,
      section: pendingCapture.section,
      selector: pendingCapture.selector,
      text: pendingCapture.text,
      rect: pendingCapture.rect,
      comment,
    });
    saveItems();
    pendingCapture = null;
    currentRect = null;
    dragStart = null;
    if (continueSelecting) {
      isSelecting = true;
      showToast(`🎯 Punkt #${items.length} gespeichert – ziehe direkt den nächsten Rahmen!`);
    } else {
      isSelecting = false;
      isDrawerOpen = true;
      showToast(`✓ Feedback-Punkt #${items.length} gespeichert`);
    }
    renderWidget();
    // Falls der Feedback-Tab aktiv ist, diesen ebenfalls aktualisieren
    if (typeof root.VPRefreshFeedbackTab === 'function') root.VPRefreshFeedbackTab();
  }

  function bindOverlayEvents() {
    const overlay = document.getElementById('vfOverlay');
    if (!overlay) return;

    const crossH = document.getElementById('vfCrossH');
    const crossV = document.getElementById('vfCrossV');
    const coordPill = document.getElementById('vfCoordPill');
    const selRect = document.getElementById('vfSelRect');
    const sizeTag = document.getElementById('vfSizeTag');

    overlay.onmousedown = (e) => {
      if (e.target.closest('.vf-hud') || e.target.closest('.vf-popover')) return;
      pendingCapture = null;
      dragStart = { x: e.clientX, y: e.clientY };
      currentRect = { left: e.clientX, top: e.clientY, right: e.clientX, bottom: e.clientY, width: 0, height: 0 };
      if (selRect) {
        selRect.style.display = 'block';
        selRect.style.left = e.clientX + 'px';
        selRect.style.top = e.clientY + 'px';
        selRect.style.width = '0px';
        selRect.style.height = '0px';
      }
    };

    overlay.onmousemove = (e) => {
      if (crossH) crossH.style.top = e.clientY + 'px';
      if (crossV) crossV.style.left = e.clientX + 'px';
      if (coordPill) {
        coordPill.style.left = e.clientX + 14 + 'px';
        coordPill.style.top = e.clientY + 14 + 'px';
        coordPill.textContent = dragStart
          ? `${Math.abs(e.clientX - dragStart.x)} × ${Math.abs(e.clientY - dragStart.y)}`
          : `${e.clientX}, ${e.clientY}`;
      }
      if (!dragStart) return;
      const left = Math.min(dragStart.x, e.clientX);
      const top = Math.min(dragStart.y, e.clientY);
      const width = Math.abs(e.clientX - dragStart.x);
      const height = Math.abs(e.clientY - dragStart.y);
      currentRect = { left, top, right: left + width, bottom: top + height, width, height };
      if (selRect) {
        selRect.style.left = left + 'px';
        selRect.style.top = top + 'px';
        selRect.style.width = width + 'px';
        selRect.style.height = height + 'px';
      }
      if (sizeTag) sizeTag.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
    };

    overlay.onmouseup = (e) => {
      if (!dragStart) return;
      let rect = currentRect;
      dragStart = null;

      // Falls der Nutzer nur geklickt statt gezogen hat, das angeklickte Element einrahmen
      if (!rect || (rect.width < 12 && rect.height < 12)) {
        overlay.style.pointerEvents = 'none';
        const clickedEl = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = 'auto';
        const target = (clickedEl && clickedEl.closest('.meal, .item, .card, .stat, button, input, select, h1, h2, h3')) || clickedEl;
        if (target && target !== document.body) {
          const r = target.getBoundingClientRect();
          rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        } else {
          rect = { left: e.clientX - 40, top: e.clientY - 20, right: e.clientX + 40, bottom: e.clientY + 20, width: 80, height: 40 };
        }
        currentRect = rect;
      }

      const info = analyzeSelectionRect(rect);
      pendingCapture = {
        tab: currentTabKey(),
        section: info.section,
        selector: info.selector,
        text: info.text,
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          pageX: rect.left + window.scrollX,
          pageY: rect.top + window.scrollY,
        },
      };
      renderWidget();
    };
  }

  function initEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-vf-act],[data-vf-del],[data-vf-goto],[data-vf-open]');
      if (!btn) return;

      if (btn.dataset.vfOpen) {
        isDrawerOpen = true;
        renderWidget();
        return;
      }
      if (btn.dataset.vfDel) {
        items = items.filter((x) => x.id !== btn.dataset.vfDel);
        saveItems();
        renderWidget();
        if (typeof root.VPRefreshFeedbackTab === 'function') root.VPRefreshFeedbackTab();
        return;
      }
      if (btn.dataset.vfGoto) {
        const it = items.find((x) => x.id === btn.dataset.vfGoto);
        if (it) {
          const tabBtn = document.querySelector(`#tabs button[data-tab="${it.tab}"]`);
          if (tabBtn) tabBtn.click();
          setTimeout(() => {
            window.scrollTo({ top: Math.max(0, (it.rect && it.rect.pageY ? it.rect.pageY - 120 : 0)), behavior: 'smooth' });
          }, 60);
        }
        return;
      }

      const act = btn.dataset.vfAct;
      if (act === 'select') startSelectionMode();
      else if (act === 'cancel') cancelSelectionMode();
      else if (act === 'drawer') {
        isSelecting = false;
        pendingCapture = null;
        isDrawerOpen = !isDrawerOpen;
        renderWidget();
      } else if (act === 'close-drawer') {
        isDrawerOpen = false;
        renderWidget();
      } else if (act === 'save-point') {
        saveCurrentCapture(false);
      } else if (act === 'save-and-next') {
        saveCurrentCapture(true);
      } else if (act === 'copy-prompt') {
        copyPrompt();
      } else if (act === 'clear-all') {
        if (confirm('Alle markierten UI-Feedback-Punkte zurücksetzen?')) {
          items = [];
          saveItems();
          renderWidget();
          if (typeof root.VPRefreshFeedbackTab === 'function') root.VPRefreshFeedbackTab();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isSelecting) {
        cancelSelectionMode();
      }
      // Shortcut: Alt + Shift + F startet den Auswahlmodus
      if (e.altKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        startSelectionMode();
      }
    });

    window.addEventListener('hashchange', () => renderWidget());
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initEvents();
        renderWidget();
      });
    } else {
      initEvents();
      renderWidget();
    }
  }

  root.VPVisualFeedback = {
    getItems: () => items.slice(),
    buildPromptText,
    startSelectionMode,
    openDrawer: () => { isDrawerOpen = true; renderWidget(); },
    copyPrompt,
    refresh: renderWidget,
  };
})(typeof window !== 'undefined' ? window : this);
