/*!
 * Safe External Links Guard — Settings helper
 * Fornisce i valori di default e la logica di normalizzazione
 * delle impostazioni lette dal tag <script> che carica links-guard.js.
 */
(function (global) {
  "use strict";

  // ===== Valori di default condivisi =====
  const DEFAULTS = {
    endpoint: "/links/policy",
    timeoutMs: 900,
    cacheTtlSec: 3600,
    mode: "strict",
    removeNode: false,
    showCopyButton: true,
    hoverFeedback: "title",
    rel: ["noopener", "noreferrer", "nofollow"],
    newTab: true,
    zIndex: 999999,
    maxConcurrent: 4,
    warnHighlightClass: "slg-warn-highlight",
    warnMessageDefault:
      "Questo link non è verificato. Procedi solo se ti fidi del sito.",
    excludeSelectors: []
  };

  const truthyValues = new Set(["true", "1", "yes", "on"]);
  const falsyValues = new Set(["false", "0", "no", "off"]);

  const getAttribute = (node, attribute) => {
    if (!node) return null;
    const raw = node.getAttribute(attribute);
    return raw == null ? null : raw.trim();
  };

  const parseBoolean = (value, defaultValue) => {
    if (value == null || value === "") return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (truthyValues.has(normalized)) return true;
    if (falsyValues.has(normalized)) return false;
    return defaultValue;
  };

  const parseInteger = (value, defaultValue) => {
    if (value == null || value === "") return defaultValue;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  };

  const parseList = (value) => {
    if (value == null || value === "") return [];
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const parseMode = (value, defaultValue) => {
    if (!value) return defaultValue;
    const normalized = value.trim().toLowerCase();
    return normalized === "soft" ? "soft" : "strict";
  };

  const parseHoverFeedback = (value, defaultValue) => {
    if (!value) return defaultValue;
    const normalized = value.trim().toLowerCase();
    return normalized === "tooltip" ? "tooltip" : "title";
  };

  /**
   * Costruisce l'oggetto di configurazione a partire dal tag <script>
   * e da eventuali override manuali forniti dal chiamante.
   */
  const buildSettings = (scriptEl, overrides) => {
    const cfg = {
      endpoint: getAttribute(scriptEl, "data-endpoint") || DEFAULTS.endpoint,
      timeoutMs: parseInteger(
        getAttribute(scriptEl, "data-timeout"),
        DEFAULTS.timeoutMs
      ),
      cacheTtlSec: parseInteger(
        getAttribute(scriptEl, "data-cache-ttl"),
        DEFAULTS.cacheTtlSec
      ),
      mode: parseMode(
        getAttribute(scriptEl, "data-mode") || DEFAULTS.mode,
        DEFAULTS.mode
      ),
      removeNode: parseBoolean(
        getAttribute(scriptEl, "data-remove-node"),
        DEFAULTS.removeNode
      ),
      showCopyButton: parseBoolean(
        getAttribute(scriptEl, "data-show-copy-button"),
        DEFAULTS.showCopyButton
      ),
      hoverFeedback: parseHoverFeedback(
        getAttribute(scriptEl, "data-hover-feedback"),
        DEFAULTS.hoverFeedback
      ),
      rel: [...DEFAULTS.rel],
      newTab: DEFAULTS.newTab,
      zIndex: DEFAULTS.zIndex,
      maxConcurrent: DEFAULTS.maxConcurrent,
      warnHighlightClass:
        getAttribute(scriptEl, "data-warn-highlight-class") ||
        DEFAULTS.warnHighlightClass,
      warnMessageDefault:
        getAttribute(scriptEl, "data-warn-message") ||
        DEFAULTS.warnMessageDefault,
      excludeSelectors: parseList(
        getAttribute(scriptEl, "data-exclude-selectors")
      )
    };

    if (!cfg.warnMessageDefault) {
      cfg.warnMessageDefault = DEFAULTS.warnMessageDefault;
    }
    if (cfg.hoverFeedback !== "tooltip") {
      cfg.hoverFeedback = "title";
    }

    const manualOverrides =
      overrides && typeof overrides === "object" ? overrides : null;
    if (manualOverrides) {
      const simpleKeys = [
        "endpoint",
        "timeoutMs",
        "cacheTtlSec",
        "mode",
        "removeNode",
        "showCopyButton",
        "hoverFeedback",
        "newTab",
        "zIndex",
        "maxConcurrent",
        "warnHighlightClass",
        "warnMessageDefault"
      ];
      simpleKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(manualOverrides, key)) {
          const value = manualOverrides[key];
          if (value !== undefined) {
            cfg[key] = value;
          }
        }
      });

      if (Object.prototype.hasOwnProperty.call(manualOverrides, "rel")) {
        const value = manualOverrides.rel;
        cfg.rel = Array.isArray(value) ? [...value] : [...DEFAULTS.rel];
      }

      if (
        Object.prototype.hasOwnProperty.call(
          manualOverrides,
          "excludeSelectors"
        )
      ) {
        const value = manualOverrides.excludeSelectors;
        if (Array.isArray(value)) {
          cfg.excludeSelectors = [...value];
        } else if (value != null) {
          cfg.excludeSelectors = parseList(String(value));
        } else {
          cfg.excludeSelectors = [];
        }
      }
    }

    return cfg;
  };

  const namespace = (global.SafeExternalLinksGuard =
    global.SafeExternalLinksGuard || {});

  namespace.defaults = Object.freeze({ ...DEFAULTS, rel: [...DEFAULTS.rel] });
  namespace.buildSettings = buildSettings;
  namespace.utils = {
    parseBoolean,
    parseInteger,
    parseList,
    parseMode,
    parseHoverFeedback
  };
})(typeof window !== "undefined" ? window : this);
