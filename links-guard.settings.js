/*!
 * Safe External Links Guard — Settings helper
 * Fornisce i valori di default e la logica di normalizzazione
 * delle impostazioni lette dal tag <script> che carica links-guard.js.
 */
(function (global) {
  "use strict";

  // ===== Valori di default condivisi =====
  const DEFAULTS = {
    endpoint: "/links/policy", // Endpoint server (relativo o assoluto). Override via `data-endpoint` o override JS.
    timeoutMs: 900, // Tempo massimo (ms) della fetch. Modificabile con `data-timeout` o override JS.
    cacheTtlSec: 3600, // TTL della cache client (s). Configurabile con `data-cache-ttl` e sostituibile dal campo `ttl` dell'API.
    mode: "strict", // Modalità operative supportate (`strict` / `warn` / `soft`). Selezionabile con `data-mode` o override JS.
    removeNode: true, // Gestione link `deny`: `true` trasforma <a> in <span>. Controllabile tramite `data-remove-node`.
    showCopyButton: false, // Pulsante "Copia link" nella modale. Nascondilo con `data-show-copy-button="false"`.
    hoverFeedback: "tooltip", // Varianti feedback hover: `title` (tooltip nativo) o `tooltip` (UI custom). Cambiabile con `data-hover-feedback`.
    rel: ["noopener", "noreferrer", "nofollow"], // Attributi di sicurezza aggiunti. Override solo via `SafeExternalLinksGuard.buildSettings` manuale.
    newTab: true, // Imposta `target="_blank"` sui link esterni. Configurabile con `data-new-tab` o override JS.
    zIndex: 999999, // Livello di stacking per modali/tooltip. Regolabile tramite override JS per integrazioni complesse.
    maxConcurrent: 4, // Limite di richieste simultanee verso l'endpoint. Aggiornabile via override JS.
    warnHighlightClass: "slg-warn-highlight", // Classe CSS dei link warn in modalità `soft`/`warn`. Impostabile con `data-warn-highlight-class`.
    warnMessageDefault:
      "Questo link non è verificato e può contenere dati della tua navigazione che saranno condivisi con un sito di terzi. Prima di procedere, assicurati che il link sia affidabile.", // Messaggio fallback, modificabile con `data-warn-message`.
    excludeSelectors: [], // Selettori da ignorare nella scansione. Accetta CSV tramite `data-exclude-selectors` o array via override.
    configVersion: "1.5.13" // Versione di configurazione usata per invalidare cache e asset in fase di deploy.
  };

  const VALID_MODES = new Set(["strict", "warn", "soft"]); // Modalità supportate: `strict` (solo modale), `warn` (modale + evidenza), `soft` (solo evidenza).

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
    if (VALID_MODES.has(normalized)) return normalized;
    return defaultValue;
  }; // Garantisce che la modalità sia una tra "strict", "warn" o "soft" (fallback al default in caso di valore non valido).

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
    if (hasDataAttribute(scriptEl, "data-new-tab")) {
      cfg.newTab = parseBoolean(
        getAttribute(scriptEl, "data-new-tab"),
        cfg.newTab
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
    if (hasDataAttribute(scriptEl, "data-config-version")) {
      const version = getAttribute(scriptEl, "data-config-version");
      cfg.configVersion = version || cfg.configVersion;
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
      "warnMessageDefault",
      "configVersion"
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
    if (!VALID_MODES.has(cfg.mode)) {
      cfg.mode = DEFAULTS.mode;
    }
    if (cfg.hoverFeedback !== "tooltip") cfg.hoverFeedback = "title";
    if (!cfg.warnMessageDefault) {
      cfg.warnMessageDefault = DEFAULTS.warnMessageDefault;
    }
    if (!Array.isArray(cfg.excludeSelectors)) {
      cfg.excludeSelectors = [];
    }
    if (cfg.configVersion != null && cfg.configVersion !== "") {
      cfg.configVersion = String(cfg.configVersion);
    } else {
      cfg.configVersion = DEFAULTS.configVersion;
    }
    return cfg;
  }; // Rifinisce la configurazione finale evitando stati inconsistenti.

  const normalizeArray = (items) => {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => String(item).trim())
      .filter(Boolean)
      .sort();
  }; // Produce array ordinati per generare fingerprint stabili.

  const computeSettingsFingerprint = (config) => {
    const safeConfig = {
      endpoint: String(config.endpoint || ""),
      timeoutMs: Number.isFinite(config.timeoutMs) ? config.timeoutMs : 0,
      cacheTtlSec: Number.isFinite(config.cacheTtlSec) ? config.cacheTtlSec : 0,
      mode: String(config.mode || ""),
      removeNode: Boolean(config.removeNode),
      showCopyButton: Boolean(config.showCopyButton),
      hoverFeedback: String(config.hoverFeedback || ""),
      rel: normalizeArray(config.rel),
      newTab: Boolean(config.newTab),
      zIndex: Number.isFinite(config.zIndex) ? config.zIndex : 0,
      maxConcurrent: Number.isFinite(config.maxConcurrent)
        ? config.maxConcurrent
        : 0,
      warnHighlightClass: String(config.warnHighlightClass || ""),
      warnMessageDefault: String(config.warnMessageDefault || ""),
      excludeSelectors: normalizeArray(config.excludeSelectors),
      configVersion: String(config.configVersion || "")
    };
    return JSON.stringify(safeConfig);
  }; // Genera una firma stabile delle impostazioni correnti per invalidare cache e asset.

  const buildSettings = (scriptEl, overrides) => {
    const cfg = cloneDefaults();
    applyScriptAttributes(cfg, scriptEl);
    applyManualOverrides(cfg, overrides);
    return normalizeConfig(cfg);
  }; // Orchestratore: fonde default, attributi `data-*` e override.

  const namespace = (global.SafeExternalLinksGuard =
    global.SafeExternalLinksGuard || {});

  namespace.defaults = Object.freeze({
    ...cloneDefaults(),
    rel: [...DEFAULTS.rel]
  });
  namespace.buildSettings = buildSettings;
  namespace.utils = {
    parseBoolean,
    parseInteger,
    parseList,
    parseMode,
    parseHoverFeedback,
    computeSettingsFingerprint
  };
})(typeof window !== "undefined" ? window : this);
