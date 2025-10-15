/*!
 * Safe External Links Guard — Settings helper
 * Fornisce i valori di default e la logica di normalizzazione
 * delle impostazioni lette dal tag <script> che carica links-guard.js.
 */
(function (global) {
  "use strict";

  // ===== Valori di default condivisi =====
  const DEFAULTS = {
    endpoint: "/links/policy", // Endpoint server: accetta URL relativo o assoluto.
    timeoutMs: 900, // Timeout in millisecondi per la richiesta API (default 0,9s).
    cacheTtlSec: 3600, // TTL cache client in secondi; può essere personalizzato via il campo `ttl` della risposta API.
    mode: "strict", // Varianti: "strict" mostra modale bloccante, "soft" evidenzia soltanto.
    removeNode: false, // true per sostituire link negati con <span>, false per lasciarli ma disabilitati.
    showCopyButton: true, // false nasconde pulsante "Copia link" nella modale di avviso.
    hoverFeedback: "title", // "title" usa tooltip nativo, "tooltip" abilita overlay custom.
    rel: ["noopener", "noreferrer", "nofollow"], // Attributi rel aggiunti ai link aperti in nuova scheda.
    newTab: true, // true imposta target="_blank", false lascia il comportamento originale del link.
    zIndex: 999999, // Ordine di sovrapposizione per modale/tooltip (utile in presenza di overlay complessi).
    maxConcurrent: 4, // Numero massimo di richieste contemporanee verso l'endpoint.
    warnHighlightClass: "slg-warn-highlight", // Classe CSS applicata ai link warn in modalità soft.
    warnMessageDefault:
      "Questo link non è verificato. Procedi solo se ti fidi del sito.", // Messaggio fallback se l'API non fornisce testo.
    excludeSelectors: [] // Array di selettori CSS da ignorare (es. [".footer a", "#nav a"]).
  };

  const truthyValues = new Set(["true", "1", "yes", "on"]);
  const falsyValues = new Set(["false", "0", "no", "off"]);

  const getAttribute = (node, attribute) => {
    if (!node) return null;
    const raw = node.getAttribute(attribute);
    return raw == null ? null : raw.trim();
  }; // Legge un attributo `data-*` e restituisce il valore normalizzato.

  const parseBoolean = (value, defaultValue) => {
    if (value == null || value === "") return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (truthyValues.has(normalized)) return true;
    if (falsyValues.has(normalized)) return false;
    return defaultValue;
  }; // Converte gli attributi stringa in booleani rispettando i default.

  const parseInteger = (value, defaultValue) => {
    if (value == null || value === "") return defaultValue;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }; // Interpreta i valori numerici mantenendo fallback sicuri.

  const parseList = (value) => {
    if (value == null || value === "") return [];
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }; // Trasforma una lista CSV in array pulito di stringhe.

  const parseMode = (value, defaultValue) => {
    if (!value) return defaultValue;
    const normalized = value.trim().toLowerCase();
    return normalized === "soft" ? "soft" : "strict";
  }; // Garantisce che la modalità sia solo "strict" o "soft".

  const parseHoverFeedback = (value, defaultValue) => {
    if (!value) return defaultValue;
    const normalized = value.trim().toLowerCase();
    return normalized === "tooltip" ? "tooltip" : "title";
  }; // Gestisce la strategia di feedback su hover.

  const hasDataAttribute = (scriptEl, attribute) => {
    if (!scriptEl || typeof scriptEl.hasAttribute !== "function") return false;
    return scriptEl.hasAttribute(attribute);
  }; // Verifica se il tag <script> espone l'attributo richiesto.

  const cloneDefaults = () => ({
    ...DEFAULTS,
    rel: [...DEFAULTS.rel],
    excludeSelectors: [...DEFAULTS.excludeSelectors]
  }); // Produce una copia isolata dei valori di default.

  const applyScriptAttributes = (cfg, scriptEl) => {
    if (!scriptEl) return cfg;

    if (hasDataAttribute(scriptEl, "data-endpoint")) {
      cfg.endpoint = getAttribute(scriptEl, "data-endpoint") || cfg.endpoint;
    }
    if (hasDataAttribute(scriptEl, "data-timeout")) {
      cfg.timeoutMs = parseInteger(
        getAttribute(scriptEl, "data-timeout"),
        cfg.timeoutMs
      );
    }
    if (hasDataAttribute(scriptEl, "data-cache-ttl")) {
      cfg.cacheTtlSec = parseInteger(
        getAttribute(scriptEl, "data-cache-ttl"),
        cfg.cacheTtlSec
      );
    }
    if (hasDataAttribute(scriptEl, "data-mode")) {
      cfg.mode = parseMode(getAttribute(scriptEl, "data-mode"), cfg.mode);
    }
    if (hasDataAttribute(scriptEl, "data-remove-node")) {
      cfg.removeNode = parseBoolean(
        getAttribute(scriptEl, "data-remove-node"),
        cfg.removeNode
      );
    }
    if (hasDataAttribute(scriptEl, "data-show-copy-button")) {
      cfg.showCopyButton = parseBoolean(
        getAttribute(scriptEl, "data-show-copy-button"),
        cfg.showCopyButton
      );
    }
    if (hasDataAttribute(scriptEl, "data-hover-feedback")) {
      cfg.hoverFeedback = parseHoverFeedback(
        getAttribute(scriptEl, "data-hover-feedback"),
        cfg.hoverFeedback
      );
    }
    if (hasDataAttribute(scriptEl, "data-warn-highlight-class")) {
      const cls = getAttribute(scriptEl, "data-warn-highlight-class");
      cfg.warnHighlightClass = cls || cfg.warnHighlightClass;
    }
    if (hasDataAttribute(scriptEl, "data-warn-message")) {
      const message = getAttribute(scriptEl, "data-warn-message");
      cfg.warnMessageDefault = message || cfg.warnMessageDefault;
    }
    if (hasDataAttribute(scriptEl, "data-exclude-selectors")) {
      cfg.excludeSelectors = parseList(
        getAttribute(scriptEl, "data-exclude-selectors")
      );
    }

    return cfg;
  }; // Applica selettivamente gli attributi `data-*` presenti sul tag <script>.

  const applyManualOverrides = (cfg, overrides) => {
    if (!overrides || typeof overrides !== "object") return cfg;

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
      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        const value = overrides[key];
        if (value !== undefined) {
          cfg[key] = value;
        }
      }
    });

    if (Object.prototype.hasOwnProperty.call(overrides, "rel")) {
      const value = overrides.rel;
      cfg.rel = Array.isArray(value) ? [...value] : [...DEFAULTS.rel];
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "excludeSelectors")) {
      const value = overrides.excludeSelectors;
      if (Array.isArray(value)) {
        cfg.excludeSelectors = [...value];
      } else if (value != null) {
        cfg.excludeSelectors = parseList(String(value));
      } else {
        cfg.excludeSelectors = [];
      }
    }

    return cfg;
  }; // Consente override programmatici preservando la forma dei dati.

  const normalizeConfig = (cfg) => {
    if (cfg.mode !== "soft") cfg.mode = "strict";
    if (cfg.hoverFeedback !== "tooltip") cfg.hoverFeedback = "title";
    if (!cfg.warnMessageDefault) {
      cfg.warnMessageDefault = DEFAULTS.warnMessageDefault;
    }
    if (!Array.isArray(cfg.excludeSelectors)) {
      cfg.excludeSelectors = [];
    }
    return cfg;
  }; // Rifinisce la configurazione finale evitando stati inconsistenti.

  const buildSettings = (scriptEl, overrides) => {
    const cfg = cloneDefaults();
    applyScriptAttributes(cfg, scriptEl);
    applyManualOverrides(cfg, overrides);
    return normalizeConfig(cfg);
  }; // Orchestratore: fonde default, attributi `data-*` e override.

  const namespace = (global.SafeExternalLinksGuard =
    global.SafeExternalLinksGuard || {});

  namespace.defaults = Object.freeze({ ...cloneDefaults(), rel: [...DEFAULTS.rel] });
  namespace.buildSettings = buildSettings;
  namespace.utils = {
    parseBoolean,
    parseInteger,
    parseList,
    parseMode,
    parseHoverFeedback
  };
})(typeof window !== "undefined" ? window : this);
