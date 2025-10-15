/*!
 * Safe External Links Guard — v4.6
 * - Async, policy lato server, DENY immediato
 * - Normalizzazione action endpoint (allow|warn|deny)
 * - Blocco immediato da cache; sostituzione <a>→<span> aggiorna l’indice
 * - Modalità soft con evidenziazione configurabile e messaggi lato server
 * - Supporto a selettori esclusi definiti nell’attributo data-exclude-selectors
*/
(function () {
  "use strict";

  // ===== Config dal tag <script> =====
  const thisScript = document.currentScript || (function () {
    const s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();

  const cfg = {
    endpoint: (thisScript.getAttribute("data-endpoint") || "/links/policy").trim(),
    timeoutMs: parseInt(thisScript.getAttribute("data-timeout") || "900", 10),
    cacheTtlSec: parseInt(thisScript.getAttribute("data-cache-ttl") || "3600", 10),
    mode: (thisScript.getAttribute("data-mode") || "strict").trim().toLowerCase(), // strict|soft
    removeNode: (thisScript.getAttribute("data-remove-node") || "false") === "true",
    rel: ["noopener", "noreferrer", "nofollow"],
    newTab: true,
    zIndex: 999999,
    maxConcurrent: 4,
    warnHighlightClass: (thisScript.getAttribute("data-warn-highlight-class") || "slg-warn-highlight").trim(),
    warnMessageDefault: (thisScript.getAttribute("data-warn-message") || "Questo link non è verificato. Procedi solo se ti fidi del sito.").trim(),
    excludeSelectors: (thisScript.getAttribute("data-exclude-selectors") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  };
  if (cfg.mode !== "soft") cfg.mode = "strict";

  // ===== Stato endpoint =====
  let endpointHealthy = false;

  // ===== CSS =====
  const injectStyles = () => {
    if (document.getElementById("slg-styles")) return;
    const style = document.createElement("style");
    style.id = "slg-styles";
    style.textContent = `
      .slg--hidden{display:none!important}
      .slg-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:saturate(120%) blur(1px)}
      .slg-wrap{position:fixed;inset:0;display:grid;grid-template-columns:10px 1fr 10px;grid-template-rows:minmax(10px,1fr) auto minmax(10px,1fr);overflow:auto}
      .slg-dialog{grid-column:2;grid-row:2;max-width:640px;width:100%;margin-inline:auto;background:#fff;color:#111;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.25);outline:none;display:flex;flex-direction:column;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif}
      @media (prefers-color-scheme:dark){.slg-dialog{background:#111;color:#eee}}
      .slg-header{display:flex;justify-content:space-between;align-items:center;padding:12px 12px 0 16px}
      .slg-title{font-size:18px;font-weight:600;margin:0}
      .slg-close{border:0;background:transparent;padding:6px;cursor:pointer;border-radius:8px}
      .slg-close:hover{background:rgba(0,0,0,.05)}
      @media (prefers-color-scheme:dark){.slg-close:hover{background:rgba(255,255,255,.08)}}
      .slg-body{padding:12px 16px 16px 16px;font-size:14px;line-height:1.45}
      .slg-host{word-break:break-all;font-weight:600}
      .slg-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
      .slg-btn{appearance:none;border-radius:10px;padding:10px 14px;font-weight:600;border:1px solid rgba(0,0,0,.15);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
      .slg-btn:focus{outline:2px solid #4b9cff;outline-offset:2px}
      .slg-btn.secondary{background:#fff;color:#111}
      .slg-btn.primary{background:#0b57d0;color:#fff;border-color:transparent}
      .slg-btn.primary:hover{filter:brightness(1.05)}
      body.slg-no-scroll{overflow:hidden}
      .slg-disabled{cursor:not-allowed;opacity:.6}
      .slg-warn-highlight{outline:2px solid rgba(247,144,9,.8);border-radius:8px;padding:2px}
      .slg-warn-highlight:focus{outline-width:3px}
    `;
    document.head.appendChild(style);
  };

  // ===== Utility =====
  const ORIGIN_HOST = location.host.toLowerCase();
  const isHttpLike = (href) => /^(https?:)?\/\//i.test(href);
  const toURL = (href) => { try { return new URL(href, location.href); } catch { return null; } };
  const isExternal = (url) => url && url.host.toLowerCase() !== ORIGIN_HOST;

  const ensureAttrs = (a) => {
    if (cfg.newTab) a.setAttribute("target", "_blank");
    const cur = (a.getAttribute("rel") || "").split(/\s+/).filter(Boolean);
    const merged = Array.from(new Set([...cur, ...cfg.rel]));
    a.setAttribute("rel", merged.join(" "));
    a.dataset.safeLinkGuard = "1";
  };

  // Indice host → Set<nodo>
  const anchorsByHost = new Map();
  const mapAdd = (host, node) => {
    let set = anchorsByHost.get(host);
    if (!set) { set = new Set(); anchorsByHost.set(host, set); }
    set.add(node);
  };
  const mapReplaceNode = (host, oldNode, newNode) => {
    const set = anchorsByHost.get(host);
    if (!set) return;
    set.delete(oldNode);
    if (newNode) set.add(newNode);
  };

  const invalidExcludeSelectors = new Set();

  const shouldExclude = (node) => {
    if (!node || !node.matches) return false;
    for (const sel of cfg.excludeSelectors) {
      try {
        if (node.matches(sel)) return true;
      } catch (e) {
        if (!invalidExcludeSelectors.has(sel)) {
          invalidExcludeSelectors.add(sel);
          console.error(`[SafeLinkGuard] Selettore non valido in data-exclude-selectors: "${sel}"`, e);
        }
      }
    }
    return false;
  };

  const disableLink = (a, reason = "Dominio bloccato", hostForIndex = null) => {
    if (cfg.removeNode) {
      const span = document.createElement("span");
      span.innerHTML = a.innerHTML;
      span.className = (a.className || "") + " slg-disabled";
      span.setAttribute("title", reason);
      span.setAttribute("aria-disabled", "true");
      const parent = a.parentNode;
      if (parent) {
        parent.replaceChild(span, a);
        if (hostForIndex) mapReplaceNode(hostForIndex, a, span);
      }
      return span;
    }
    a.removeAttribute("href");
    a.setAttribute("role", "link");
    a.setAttribute("aria-disabled", "true");
    a.classList.add("slg-disabled");
    a.title = reason;
    a.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true });
    a.dataset.safeLinkGuard = "1";
    return a;
  };

  // ===== Cache =====
  const SS_KEY = "SLG_POLICY_CACHE_V3";
  const mem = new Map();
  const loadSession = () => {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      Object.entries(obj).forEach(([host, v]) => mem.set(host, v));
    } catch {}
  };
  const saveSession = () => {
    try {
      const obj = {}; mem.forEach((v, k) => obj[k] = v);
      sessionStorage.setItem(SS_KEY, JSON.stringify(obj));
    } catch {}
  };
  const nowSec = () => Math.floor(Date.now() / 1000);
  const getCached = (host) => {
    const it = mem.get(host);
    if (!it) return null;
    if (it.ts + (it.ttl || cfg.cacheTtlSec) < nowSec()) { mem.delete(host); return null; }
    return it;
  };
  const setCached = (host, action, ttl, message) => {
    mem.set(host, {
      action,
      ttl: ttl || cfg.cacheTtlSec,
      ts: nowSec(),
      message: message || null
    });
    saveSession();
  };

  // ===== Endpoint =====
  const fetchWithTimeout = (url, opts = {}, timeoutMs = 800) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
  };

  async function checkEndpointHealth() {
    if (!cfg.endpoint) {
      console.error("[SafeLinkGuard] data-endpoint non impostato.");
      endpointHealthy = false;
      return false;
    }
    const url = cfg.endpoint + (cfg.endpoint.includes("?") ? "&" : "?") + "health=1";
    try {
      const res = await fetchWithTimeout(url, { method: "GET", cache: "no-store", credentials: "same-origin" }, cfg.timeoutMs);
      if (!res.ok) {
        console.error(`[SafeLinkGuard] Endpoint non raggiungibile. HTTP ${res.status} su ${url}`);
        endpointHealthy = false;
        return false;
      }
      endpointHealthy = true;
      return true;
    } catch (e) {
      console.error(`[SafeLinkGuard] Errore di rete verso ${url}:`, e);
      endpointHealthy = false;
      return false;
    }
  }

  const normalizeAction = (val) => {
    const a = String(val || "").toLowerCase().trim();
    return (a === "allow" || a === "warn" || a === "deny") ? a : "warn";
  };

  async function getPolicy(host) {
    const cached = getCached(host);
    if (cached) return cached.action;

    if (!endpointHealthy) {
      console.error("[SafeLinkGuard] Endpoint non disponibile. Fallback 'warn'. Host:", host);
      const fallback = "warn";
      setCached(host, fallback, Math.min(300, cfg.cacheTtlSec), "Endpoint non disponibile. Procedi con cautela.");
      return fallback;
    }

    try {
      const res = await fetchWithTimeout(
        cfg.endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({ host, referer: location.origin })
        },
        cfg.timeoutMs
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const action = normalizeAction(json?.action);
      const ttl = Number.isFinite(json?.ttl) ? json.ttl : cfg.cacheTtlSec;
      const message = typeof json?.message === "string" ? json.message : null;
      setCached(host, action, ttl, message);
      return action;
    } catch (e) {
      console.error("[SafeLinkGuard] Errore policy per host:", host, e);
      const fallback = "warn";
      setCached(host, fallback, Math.min(300, cfg.cacheTtlSec), "Errore durante la verifica del dominio. Procedi con cautela.");
      return fallback;
    }
  }

  // ===== Coda policy =====
  const queue = [];
  const inFlight = new Set();
  let running = 0;

  const applyPolicyToHost = (host, action) => {
    const set = anchorsByHost.get(host);
    if (!set) return;
    const cached = getCached(host);
    const message = cached?.message || null;
    const warnMessage = message || cfg.warnMessageDefault;
    for (const node of Array.from(set)) {
      if (!node.isConnected) { set.delete(node); continue; }
      if (action === "deny") {
        const reason = message || "Dominio bloccato";
        disableLink(node, reason, host);
      } else if (action === "allow") {
        if (node.tagName === "A") {
          ensureAttrs(node);
          // reset listener: clone per sicurezza
          const clone = node.cloneNode(true);
          clone.classList?.remove(cfg.warnHighlightClass);
          if (clone.title && clone.title === warnMessage) clone.removeAttribute("title");
          node.replaceWith(clone);
          mapReplaceNode(host, node, clone);
        } else {
          node.classList?.remove(cfg.warnHighlightClass);
          if (node.title && node.title === warnMessage) node.removeAttribute("title");
        }
      } else {
        if (node.tagName === "A") ensureAttrs(node); // warn
        if (cfg.mode === "soft") {
          node.classList?.add(cfg.warnHighlightClass);
          node.title = warnMessage;
        }
      }
    }
  };

  const enqueueHost = (host) => {
    const cached = getCached(host);
    if (cached) { applyPolicyToHost(host, cached.action); return; }
    if (inFlight.has(host)) return;
    inFlight.add(host);
    queue.push(host);
    pump();
  };

  const pump = () => {
    while (running < cfg.maxConcurrent && queue.length) {
      const host = queue.shift();
      running++;
      (async () => {
        try {
          const action = await getPolicy(host);
          applyPolicyToHost(host, action);
        } finally {
          inFlight.delete(host);
          running--;
          pump();
        }
      })();
    }
  };

  // ===== Modale + apertura robusta =====
  let modalRoot = null;
  let pendingUrl = null;
  let pendingMessage = null;
  let lastFocused = null;

  const buildModal = () => {
    const root = document.createElement("div");
    root.id = "slg-modal-root";
    root.className = "slg-overlay slg--hidden";
    root.style.zIndex = String(cfg.zIndex);

    const wrap = document.createElement("div");
    wrap.className = "slg-wrap";
    root.appendChild(wrap);

    const dialog = document.createElement("div");
    dialog.className = "slg-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "slg-title");
    dialog.tabIndex = -1;
    wrap.appendChild(dialog);

    const header = document.createElement("div");
    header.className = "slg-header";
    header.innerHTML = `
      <h2 id="slg-title" class="slg-title">Controlla che questo link sia sicuro</h2>
      <button type="button" class="slg-close" aria-label="Chiudi" title="Chiudi">✕</button>
    `;
    dialog.appendChild(header);

    const body = document.createElement("div");
    body.className = "slg-body";
    body.innerHTML = `
      <p id="slg-message">${cfg.warnMessageDefault}</p>
      <p>Host: <span id="slg-host" class="slg-host"></span></p>
      <div class="slg-actions">
        <a id="slg-open" class="slg-btn primary" rel="noopener noreferrer nofollow" target="_blank">Apri link</a>
        <button id="slg-copy" class="slg-btn secondary" type="button">Copia link</button>
        <button id="slg-cancel" class="slg-btn secondary" type="button">Annulla</button>
      </div>
    `;
    dialog.appendChild(body);

    const closeBtn = header.querySelector(".slg-close");
    const cancelBtn = body.querySelector("#slg-cancel");
    const openLink = body.querySelector("#slg-open");
    const copyBtn = body.querySelector("#slg-copy");

    const hide = () => {
      root.classList.add("slg--hidden");
      document.body.classList.remove("slg-no-scroll");
      pendingUrl = null;
      pendingMessage = null;
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    };

    root.addEventListener("click", (e) => { if (e.target === root) hide(); });
    closeBtn.addEventListener("click", hide);
    cancelBtn.addEventListener("click", hide);

    openLink.addEventListener("click", (e) => {
      const href = openLink.getAttribute("href");
      if (!href) { hide(); return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      let opened = false;
      try { const w = window.open(href, "_blank", "noopener"); if (w) opened = true; } catch {}
      if (!opened) {
        const tmp = document.createElement("a");
        tmp.href = href; tmp.target = "_blank"; tmp.rel = "noopener noreferrer nofollow";
        tmp.style.position = "absolute"; tmp.style.left = "-9999px";
        document.body.appendChild(tmp);
        try { tmp.click(); opened = true; } catch {}
        tmp.remove();
      }
      if (!opened) { try { location.assign(href); } catch {} }
      hide();
    }, { capture: true });

    copyBtn.addEventListener("click", async () => {
      if (!pendingUrl) return;
      try { await navigator.clipboard.writeText(pendingUrl.href); }
      catch {
        const ta = document.createElement("textarea");
        ta.value = pendingUrl.href;
        document.body.appendChild(ta);
        ta.select(); document.execCommand("copy"); ta.remove();
      }
    });

    return { root, dialog };
  };

  const ensureModal = () => {
    if (modalRoot) return modalRoot;
    const { root } = buildModal();
    document.body.appendChild(root);
    modalRoot = root;
    return modalRoot;
  };

  const showModal = (url, message) => {
    ensureModal();
    pendingUrl = url;
    pendingMessage = message || cfg.warnMessageDefault;
    modalRoot.querySelector("#slg-host").textContent = url.host;
    const openEl = modalRoot.querySelector("#slg-open");
    openEl.setAttribute("href", url.href);
    openEl.setAttribute("target", "_blank");
    openEl.setAttribute("rel", "noopener noreferrer nofollow");
    modalRoot.querySelector("#slg-message").textContent = pendingMessage;
    lastFocused = document.activeElement;
    modalRoot.classList.remove("slg--hidden");
    document.body.classList.add("slg-no-scroll");
    const dialog = modalRoot.querySelector(".slg-dialog");
    dialog.focus();
  };

  // ===== Scansione =====
  const processAnchor = (a) => {
    if (!a || a.dataset.safeLinkGuard === "1") return;

    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#")) { a.dataset.safeLinkGuard = "1"; return; }
    if (/^(mailto:|tel:|javascript:|blob:|data:)/i.test(href)) { a.dataset.safeLinkGuard = "1"; return; }

    const url = toURL(href);
    if (!url || !isHttpLike(url.href)) { a.dataset.safeLinkGuard = "1"; return; }
    if (!isExternal(url)) { a.dataset.safeLinkGuard = "1"; return; }

    const host = url.host.toLowerCase();
    mapAdd(host, a);

    // Se già in cache come DENY, blocca SUBITO (e sostituisci <a>→<span> se richiesto)
    const cached = getCached(host);
    if (cached && cached.action === "deny") {
      const denyMsg = cached.message || "Dominio bloccato";
      disableLink(a, denyMsg, host);
      return;
    }

    // Altrimenti impone attributi e chiede la policy in background
    ensureAttrs(a);
    enqueueHost(host);

    // Click: se policy non nota, chiedi e applica prima di navigare
    a.addEventListener("click", async (e) => {
      const isModified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1;
      if (isModified) return;

      const cached2 = getCached(host);
      if (!cached2) {
        e.preventDefault();
        e.stopPropagation();
        const action = await getPolicy(host);
        applyPolicyToHost(host, action);
        if (action === "allow") {
          const tmp = document.createElement("a");
          tmp.href = url.href; tmp.target = "_blank"; tmp.rel = "noopener noreferrer nofollow";
          tmp.style.position = "absolute"; tmp.style.left = "-9999px";
          document.body.appendChild(tmp);
          try { tmp.click(); } catch { try { window.open(url.href, "_blank", "noopener"); } catch { location.assign(url.href); } }
          tmp.remove();
        } else if (action === "warn") {
          if (cfg.mode === "strict") {
            showModal(url, getCached(host)?.message);
          }
        }
        // deny: già applicato a tutti i link dell’host
        return;
      }

      if (cached2.action === "deny") {
        e.preventDefault(); e.stopPropagation();
        return;
      }
      if (cached2.action === "warn") {
        if (cfg.mode === "strict") {
          e.preventDefault(); e.stopPropagation();
          showModal(url, cached2.message);
        }
      }
      // allow: passa
    }, { capture: true });
  };

  const processAll = (root = document) => {
    root.querySelectorAll("a[href]:not([data-safe-link-guard])").forEach((node) => {
      if (shouldExclude(node)) {
        node.dataset.safeLinkGuard = "1";
        return;
      }
      processAnchor(node);
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.tagName === "A") {
          if (shouldExclude(node)) { node.dataset.safeLinkGuard = "1"; return; }
          processAnchor(node);
        } else {
          node.querySelectorAll?.("a[href]")?.forEach((anchor) => {
            if (shouldExclude(anchor)) { anchor.dataset.safeLinkGuard = "1"; return; }
            processAnchor(anchor);
          });
        }
      });
    }
  });

  // ===== Init =====
  const init = async () => {
    injectStyles();
    loadSession();
    await checkEndpointHealth();
    if (!endpointHealthy) {
      console.error(`[SafeLinkGuard] Verifica fallita per data-endpoint="${cfg.endpoint}". Fallback "warn".`);
    }
    processAll(document);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  // ===== API =====
  window.SafeLinkGuard = {
    rescan(root) { processAll(root || document); },
    clearCache() { mem.clear(); saveSession(); },
    setMode(m) { cfg.mode = m === "soft" ? "soft" : "strict"; }
  };
})();
