(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = function bootstrapFactory(win, doc) {
      return factory(win || globalThis, doc);
    };
  } else {
    factory(root, root.document);
  }
})(typeof window !== "undefined" ? window : globalThis, function (win, doc) {
  "use strict";

  const MAX_REL_PARTS = 8;
  const DEFAULT_MESSAGE =
    "Stai per aprire un sito esterno. Continua solo se ti fidi della destinazione.";

  const protocolIgnore = /^(mailto:|tel:|javascript:|data:|blob:)/i;

  const normalizeList = (list, fallback) => {
    if (!list) {
      return fallback.slice();
    }
    if (Array.isArray(list)) {
      return list
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
    if (typeof list === "string") {
      return list
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return fallback.slice();
  };

  const matchDomain = (host, pattern) => {
    if (!host || !pattern) return false;
    const normalizedHost = host.toLowerCase();
    const normalizedPattern = pattern.toLowerCase();
    if (normalizedPattern === normalizedHost) return true;
    if (normalizedPattern.startsWith("*.")) {
      const suffix = normalizedPattern.slice(1); // mantiene il punto iniziale
      return (
        normalizedHost === normalizedPattern.slice(2) ||
        normalizedHost.endsWith(suffix)
      );
    }
    return false;
  };

  const applySeoAttributes = (anchor) => {
    if (!anchor || anchor.tagName !== "A") {
      return;
    }
    if (typeof anchor.getAttribute !== "function") {
      return;
    }
    const href = anchor.getAttribute("href");
    if (!href || protocolIgnore.test(href)) {
      return;
    }
    let url;
    try {
      url = new URL(href, doc.baseURI || win.location.href);
    } catch (err) {
      return;
    }
    if (!url || !url.host || !url.protocol || !/^https?:$/i.test(url.protocol)) {
      return;
    }
    if (state.allowlist.length && state.allowlist.some((pattern) => matchDomain(url.hostname, pattern))) {
      return;
    }
    if (state.enforceNewTab) {
      const currentTarget = anchor.getAttribute("target");
      if (currentTarget !== "_blank") {
        anchor.setAttribute("target", "_blank");
      }
    }
    const currentRel = anchor.getAttribute("rel");
    const tokens = currentRel
      ? currentRel
          .split(/\s+/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
    const required = state.relTokens;
    for (let i = 0; i < required.length; i += 1) {
      if (!tokens.includes(required[i])) {
        tokens.push(required[i]);
      }
    }
    if (tokens.length > MAX_REL_PARTS) {
      tokens.length = MAX_REL_PARTS;
    }
    anchor.setAttribute("rel", tokens.join(" "));
  };

  const state = {
    enabled: true,
    allowlist: [],
    relTokens: ["noopener", "noreferrer", "nofollow"],
    enforceNewTab: true,
    enforceSeo: true,
    debug: false,
    externalPolicy: { action: "warn", message: DEFAULT_MESSAGE },
    clickListener: null,
    readyHandler: null,
    released: false
  };

  const ns = (win.SafeExternalLinksGuardBootstrap =
    win.SafeExternalLinksGuardBootstrap || {});

  ns.version = "1.0.0";

  const log = (type, message, payload) => {
    if (!state.debug || typeof win.console !== "object") {
      return;
    }
    const method =
      type === "error"
        ? "error"
        : type === "warn"
        ? "warn"
        : type === "info"
        ? "info"
        : "log";
    try {
      if (payload !== undefined) {
        win.console[method](`[SELG:bootstrap] ${message}`, payload);
      } else {
        win.console[method](`[SELG:bootstrap] ${message}`);
      }
    } catch (err) {
      /* noop */
    }
  };

  const updateConfig = (config) => {
    const cfg = config && typeof config === "object" ? config : {};
    state.enabled = cfg.enabled !== false;
    state.allowlist = normalizeList(cfg.allowlist, []);
    if (cfg.externalPolicy && typeof cfg.externalPolicy === "object") {
      const { action, message } = cfg.externalPolicy;
      state.externalPolicy = {
        action: typeof action === "string" ? action : "warn",
        message:
          typeof message === "string" && message.trim()
            ? message.trim()
            : DEFAULT_MESSAGE
      };
    }
    const seo = cfg.seo && typeof cfg.seo === "object" ? cfg.seo : {};
    state.enforceSeo = seo.enforceAttributes !== false;
    state.enforceNewTab = seo.enforceNewTab !== false;
    if (Array.isArray(cfg.relTokens)) {
      state.relTokens = normalizeList(cfg.relTokens, state.relTokens);
    }
    state.debug = Boolean(cfg.debug);
    ns.config = {
      enabled: state.enabled,
      allowlist: state.allowlist.slice(),
      externalPolicy: { ...state.externalPolicy },
      seo: { enforceAttributes: state.enforceSeo },
      debug: state.debug
    };
  };

  ns.updateConfig = updateConfig;

  const shouldIgnoreAnchor = (anchor) => {
    if (!anchor || anchor.tagName !== "A") {
      return true;
    }
    if (typeof anchor.getAttribute !== "function") {
      return true;
    }
    const href = anchor.getAttribute("href");
    if (!href || href.charAt(0) === "#" || protocolIgnore.test(href)) {
      return true;
    }
    let url;
    try {
      url = new URL(href, doc.baseURI || win.location.href);
    } catch (err) {
      return true;
    }
    if (!url.host || !/^https?:$/i.test(url.protocol)) {
      return true;
    }
    if (url.hostname.toLowerCase() === win.location.hostname.toLowerCase()) {
      return true;
    }
    if (
      state.allowlist.length &&
      state.allowlist.some((pattern) => matchDomain(url.hostname, pattern))
    ) {
      return true;
    }
    return false;
  };

  const fallbackNavigate = (anchor) => {
    const href = anchor && typeof anchor.getAttribute === "function"
      ? anchor.getAttribute("href")
      : anchor && anchor.href
      ? anchor.href
      : null;
    if (!href) {
      return;
    }
    const message = state.externalPolicy.message || DEFAULT_MESSAGE;
    let proceed = true;
    try {
      if (typeof win.SafeExternalLinksGuardBootstrap.confirm === "function") {
        proceed = win.SafeExternalLinksGuardBootstrap.confirm(message, anchor);
      } else if (typeof win.confirm === "function") {
        proceed = win.confirm(message);
      }
    } catch (err) {
      log("error", "Errore durante la conferma fallback", err);
    }
    if (!proceed) {
      return;
    }
    if (typeof win.open === "function") {
      const target = anchor.getAttribute("target") || "_blank";
      try {
        const opened = win.open(href, target);
        if (opened && opened.focus) {
          opened.focus();
        }
        return;
      } catch (errOpen) {
        log("warn", "Impossibile aprire la finestra via window.open", errOpen);
      }
    }
    try {
      win.location.assign(href);
    } catch (errAssign) {
      log("error", "Impossibile navigare al link esterno", errAssign);
    }
  };

  const clickHandler = (event) => {
    if (!state.enabled || state.released) {
      return;
    }
    if (!event) {
      return;
    }
    const target = event.target;
    if (!target) {
      return;
    }
    let anchor = null;
    if (target.tagName === "A") {
      anchor = target;
    } else if (typeof target.closest === "function") {
      try {
        anchor = target.closest("a[href]");
      } catch (errClosest) {
        /* noop */
      }
    }
    if (!anchor) {
      let node = target.parentNode;
      while (node && !anchor) {
        if (node.tagName === "A") {
          anchor = node;
          break;
        }
        node = node.parentNode;
      }
    }
    if (!anchor || shouldIgnoreAnchor(anchor)) {
      return;
    }
    if (state.enforceSeo) {
      applySeoAttributes(anchor);
    }
    if (state.readyHandler) {
      event.__slgBootstrapForwarded = { anchor };
      event.__slgBootstrapHandled = true;
      try {
        state.readyHandler(event, anchor);
      } catch (errHandler) {
        log("error", "Errore durante il forward dell'evento", errHandler);
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    fallbackNavigate(anchor);
  };

  ns.forwardTo = (handler) => {
    if (typeof handler === "function") {
      state.readyHandler = handler;
    } else {
      state.readyHandler = null;
    }
  };

  ns.release = () => {
    if (state.released || !state.clickListener) {
      return;
    }
    doc.removeEventListener("click", state.clickListener, true);
    state.released = true;
  };

  if (!doc || typeof doc.addEventListener !== "function") {
    return ns;
  }

  const bootstrapConfig = ns.config || {};
  updateConfig(bootstrapConfig);

  if (state.enforceSeo && typeof doc.getElementsByTagName === "function") {
    const anchors = doc.getElementsByTagName("a");
    for (let i = 0; i < anchors.length; i += 1) {
      applySeoAttributes(anchors[i]);
    }
  }

  state.clickListener = clickHandler;
  doc.addEventListener("click", state.clickListener, {
    capture: true,
    passive: false
  });

  ns.applySeoAttributes = applySeoAttributes;

  return ns;
});
