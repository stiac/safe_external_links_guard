/*!
 * Safe External Links Guard — Settings helper
 * Fornisce i valori di default e la logica di normalizzazione
 * delle impostazioni lette dal tag <script> che carica links-guard.js.
 */
(function (global) {
  "use strict";

  const namespace = (global.SafeExternalLinksGuard =
    global.SafeExternalLinksGuard || {});

  const FALLBACK_WARN_MESSAGE =
    "This link is not verified and may share your browsing data with a third-party site. Make sure the destination is trustworthy before continuing."; // Messaggio usato come fallback quando l'endpoint restituisce `warn` senza testo custom.

  const resolveDefaultWarnMessage = () => {
    if (namespace.i18n && typeof namespace.i18n.t === "function") {
      const translated = namespace.i18n.t("messages.defaultWarn");
      if (translated) {
        return translated;
      }
    }
    return FALLBACK_WARN_MESSAGE;
  };

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
    warnMessageDefault: FALLBACK_WARN_MESSAGE, // Messaggio fallback, modificabile con `data-warn-message`.
    excludeSelectors: [], // Selettori da ignorare nella scansione. Accetta CSV tramite `data-exclude-selectors` o array via override.
    configVersion: "1.6.0", // Versione di configurazione usata per invalidare cache e asset in fase di deploy.
    trackingEnabled: false, // Abilita il tracciamento dei click con parametro personalizzato. Override con `data-tracking-enabled`.
    trackingParameter: "myclid", // Nome del parametro di tracciamento (es. myclid). Override con `data-tracking-parameter`.
    trackingPixelEndpoint: "", // Endpoint del pixel di raccolta dati. Impostabile con `data-tracking-pixel-endpoint`.
    trackingIncludeMetadata: true, // Invia metadati anonimi (lingua, device, timezone). Disattivabile con `data-tracking-include-metadata`.
    trackingSamplingRate: 1, // Percentuale di campionamento dei click (0-1). Configurabile con `data-tracking-sampling-rate`.
    trackingAllowlist: [], // Elenco domini consentiti per il tracciamento. Override con `data-tracking-allowlist`.
    trackingBlocklist: [], // Elenco domini esclusi dal tracciamento. Override con `data-tracking-blocklist`.
    trackingRespectDnt: true, // Rispetta Do Not Track del browser. Override con `data-tracking-respect-dnt`.
    trackingCaptureMatrix: null, // Matrice di cattura personalizzata. Configurabile via override JS o attributi JSON.
    trackingTimeoutMs: 2500, // Timeout (ms) per l'invio del pixel. Override con `data-tracking-timeout-ms`.
    trackingRetry: { attempts: 1, backoffFactor: 2, delayMs: 150 }, // Strategia di retry del pixel.
    trackingHmac: null, // Configurazione HMAC opzionale. Override via JS o data attribute.
    trackingUserIpHash: null, // Hash IP utente pseudonimizzato. Override con `data-tracking-user-ip-hash`.
    trackingCampaignKeys: [], // Chiavi campagne aggiuntive per il payload. Override con `data-tracking-campaign-keys`.
    trackingUtmKeys: [], // Chiavi UTM extra per il payload. Override con `data-tracking-utm-keys`.
    keepWarnMessageOnAllow: false, // Mantiene il messaggio di avviso anche per i link consentiti (utile in contesti limitati).
    debugMode: false, // Modalità debug disattivata di default. Attivabile con `data-debug-mode` o override JS.
    debugLevel: "basic", // Livello di dettaglio dei log (`basic` o `verbose`). Configurabile con `data-debug-level` o override JS.
    bootstrap: {
      enabled: true,
      allowlist: [],
      externalPolicy: { action: "warn", message: FALLBACK_WARN_MESSAGE },
      seo: { enforceAttributes: true, enforceNewTab: true },
      debug: false
    }
  };

  const VALID_MODES = new Set(["strict", "warn", "soft"]); // Modalità supportate: `strict` (solo modale), `warn` (modale + evidenza), `soft` (solo evidenza).
  const VALID_DEBUG_LEVELS = new Set(["basic", "verbose"]);

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

  const parseFloatNumber = (value, defaultValue) => {
    if (value == null || value === "") return defaultValue;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }; // Gestisce valori decimali mantenendo fallback sicuri.

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

  const parseDebugLevel = (value, defaultValue) => {
    if (!value) return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (VALID_DEBUG_LEVELS.has(normalized)) {
      return normalized;
    }
    return defaultValue;
  }; // Normalizza il livello di debug garantendo valori `basic` o `verbose`.

  const parseHoverFeedback = (value, defaultValue) => {
    if (!value) return defaultValue;
    const normalized = value.trim().toLowerCase();
    return normalized === "tooltip" ? "tooltip" : "title";
  }; // Gestisce la strategia di feedback su hover.

  const hasDataAttribute = (scriptEl, attribute) => {
    if (!scriptEl || typeof scriptEl.hasAttribute !== "function") return false;
    return scriptEl.hasAttribute(attribute);
  }; // Verifica se il tag <script> espone l'attributo richiesto.

  const cloneDefaults = () => {
    const warnMessageDefault = resolveDefaultWarnMessage();
    DEFAULTS.warnMessageDefault = warnMessageDefault;
    const bootstrapDefaults = {
      enabled: DEFAULTS.bootstrap.enabled,
      allowlist: [...DEFAULTS.bootstrap.allowlist],
      externalPolicy: {
        action: DEFAULTS.bootstrap.externalPolicy.action,
        message:
          (DEFAULTS.bootstrap.externalPolicy.message &&
            DEFAULTS.bootstrap.externalPolicy.message !== FALLBACK_WARN_MESSAGE)
            ? DEFAULTS.bootstrap.externalPolicy.message
            : warnMessageDefault
      },
      seo: { ...DEFAULTS.bootstrap.seo },
      debug: DEFAULTS.bootstrap.debug
    };
    return {
      ...DEFAULTS,
      warnMessageDefault,
      keepWarnMessageOnAllow: DEFAULTS.keepWarnMessageOnAllow,
      rel: [...DEFAULTS.rel],
      excludeSelectors: [...DEFAULTS.excludeSelectors],
      trackingAllowlist: [...DEFAULTS.trackingAllowlist],
      trackingBlocklist: [...DEFAULTS.trackingBlocklist],
      trackingRetry: { ...DEFAULTS.trackingRetry },
      trackingCampaignKeys: [...DEFAULTS.trackingCampaignKeys],
      trackingUtmKeys: [...DEFAULTS.trackingUtmKeys],
      bootstrap: bootstrapDefaults
    };
  }; // Produce una copia isolata dei valori di default aggiornando il messaggio di avviso alla lingua corrente.

  const parseBootstrapConfig = (cfg, scriptEl) => {
    const bootstrapCfg = {
      enabled: true,
      allowlist: [],
      externalPolicy: {
        action: "warn",
        message: cfg.warnMessageDefault || FALLBACK_WARN_MESSAGE
      },
      seo: {
        enforceAttributes: true,
        enforceNewTab: cfg.newTab !== false
      },
      debug: false
    };

    if (!scriptEl) {
      return bootstrapCfg;
    }

    if (hasDataAttribute(scriptEl, "data-bootstrap-enabled")) {
      bootstrapCfg.enabled = parseBoolean(
        getAttribute(scriptEl, "data-bootstrap-enabled"),
        bootstrapCfg.enabled
      );
    }

    if (hasDataAttribute(scriptEl, "data-bootstrap-allowlist")) {
      bootstrapCfg.allowlist = parseList(
        getAttribute(scriptEl, "data-bootstrap-allowlist")
      );
    }

    if (hasDataAttribute(scriptEl, "data-bootstrap-policy-action")) {
      const action = getAttribute(scriptEl, "data-bootstrap-policy-action");
      const normalized = action ? action.trim().toLowerCase() : "";
      if (normalized === "allow" || normalized === "warn" || normalized === "deny") {
        bootstrapCfg.externalPolicy.action = normalized;
      }
    }

    if (hasDataAttribute(scriptEl, "data-bootstrap-policy-message")) {
      const message = getAttribute(scriptEl, "data-bootstrap-policy-message");
      if (message) {
        bootstrapCfg.externalPolicy.message = message;
      }
    }

    if (hasDataAttribute(scriptEl, "data-seo-enforce-attributes")) {
      bootstrapCfg.seo.enforceAttributes = parseBoolean(
        getAttribute(scriptEl, "data-seo-enforce-attributes"),
        bootstrapCfg.seo.enforceAttributes
      );
    }

    if (hasDataAttribute(scriptEl, "data-bootstrap-debug")) {
      bootstrapCfg.debug = parseBoolean(
        getAttribute(scriptEl, "data-bootstrap-debug"),
        bootstrapCfg.debug
      );
    }

    return bootstrapCfg;
  };

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
    if (hasDataAttribute(scriptEl, "data-keep-warn-on-allow")) {
      cfg.keepWarnMessageOnAllow = parseBoolean(
        getAttribute(scriptEl, "data-keep-warn-on-allow"),
        cfg.keepWarnMessageOnAllow
      );
    }
    if (hasDataAttribute(scriptEl, "data-debug-mode")) {
      cfg.debugMode = parseBoolean(
        getAttribute(scriptEl, "data-debug-mode"),
        cfg.debugMode
      );
    }
    if (hasDataAttribute(scriptEl, "data-debug-level")) {
      cfg.debugLevel = parseDebugLevel(
        getAttribute(scriptEl, "data-debug-level"),
        cfg.debugLevel
      );
    }
    if (hasDataAttribute(scriptEl, "data-config-version")) {
      const version = getAttribute(scriptEl, "data-config-version");
      cfg.configVersion = version || cfg.configVersion;
    }
    if (hasDataAttribute(scriptEl, "data-tracking-enabled")) {
      cfg.trackingEnabled = parseBoolean(
        getAttribute(scriptEl, "data-tracking-enabled"),
        cfg.trackingEnabled
      );
    }
    if (hasDataAttribute(scriptEl, "data-tracking-parameter")) {
      const param = getAttribute(scriptEl, "data-tracking-parameter");
      cfg.trackingParameter = param || cfg.trackingParameter;
    }
    if (hasDataAttribute(scriptEl, "data-tracking-pixel-endpoint")) {
      const endpointAttr = getAttribute(
        scriptEl,
        "data-tracking-pixel-endpoint"
      );
      cfg.trackingPixelEndpoint = endpointAttr || cfg.trackingPixelEndpoint;
    }
    if (hasDataAttribute(scriptEl, "data-tracking-sampling-rate")) {
      const rate = parseFloatNumber(
        getAttribute(scriptEl, "data-tracking-sampling-rate"),
        cfg.trackingSamplingRate
      );
      cfg.trackingSamplingRate = Math.min(Math.max(rate, 0), 1);
    }
    if (hasDataAttribute(scriptEl, "data-tracking-allowlist")) {
      cfg.trackingAllowlist = parseList(
        getAttribute(scriptEl, "data-tracking-allowlist")
      );
    }
    if (hasDataAttribute(scriptEl, "data-tracking-blocklist")) {
      cfg.trackingBlocklist = parseList(
        getAttribute(scriptEl, "data-tracking-blocklist")
      );
    }
    if (hasDataAttribute(scriptEl, "data-tracking-respect-dnt")) {
      cfg.trackingRespectDnt = parseBoolean(
        getAttribute(scriptEl, "data-tracking-respect-dnt"),
        cfg.trackingRespectDnt
      );
    }
    if (hasDataAttribute(scriptEl, "data-tracking-matrix-preset")) {
      const preset = getAttribute(scriptEl, "data-tracking-matrix-preset");
      cfg.trackingCaptureMatrix = {
        ...(cfg.trackingCaptureMatrix || {}),
        activePreset: preset || "standard"
      };
    }
    if (hasDataAttribute(scriptEl, "data-tracking-matrix-overrides")) {
      const rawOverrides = getAttribute(
        scriptEl,
        "data-tracking-matrix-overrides"
      );
      if (rawOverrides) {
        try {
          const parsedOverrides = JSON.parse(rawOverrides);
          cfg.trackingCaptureMatrix = {
            ...(cfg.trackingCaptureMatrix || {}),
            overrides: parsedOverrides
          };
        } catch (err) {
          if (typeof console !== "undefined" && console?.warn) {
            console.warn(
              "SafeExternalLinksGuard: data-tracking-matrix-overrides non è un JSON valido",
              err
            );
          }
        }
      }
    }
    if (hasDataAttribute(scriptEl, "data-tracking-timeout-ms")) {
      cfg.trackingTimeoutMs = parseInteger(
        getAttribute(scriptEl, "data-tracking-timeout-ms"),
        cfg.trackingTimeoutMs
      );
    }
    if (hasDataAttribute(scriptEl, "data-tracking-retry-attempts")) {
      cfg.trackingRetry.attempts = parseInteger(
        getAttribute(scriptEl, "data-tracking-retry-attempts"),
        cfg.trackingRetry.attempts
      );
    }
    if (hasDataAttribute(scriptEl, "data-tracking-retry-delay")) {
      cfg.trackingRetry.delayMs = parseInteger(
        getAttribute(scriptEl, "data-tracking-retry-delay"),
        cfg.trackingRetry.delayMs
      );
    }
    if (hasDataAttribute(scriptEl, "data-tracking-retry-backoff")) {
      cfg.trackingRetry.backoffFactor = parseFloatNumber(
        getAttribute(scriptEl, "data-tracking-retry-backoff"),
        cfg.trackingRetry.backoffFactor
      );
    }
    if (hasDataAttribute(scriptEl, "data-tracking-hmac-secret")) {
      const secret = getAttribute(scriptEl, "data-tracking-hmac-secret");
      cfg.trackingHmac = {
        ...(cfg.trackingHmac || {}),
        secret
      };
    }
    if (hasDataAttribute(scriptEl, "data-tracking-hmac-algorithm")) {
      const algorithm = getAttribute(
        scriptEl,
        "data-tracking-hmac-algorithm"
      );
      cfg.trackingHmac = {
        ...(cfg.trackingHmac || {}),
        algorithm
      };
    }
    if (hasDataAttribute(scriptEl, "data-tracking-hmac-format")) {
      const format = getAttribute(scriptEl, "data-tracking-hmac-format");
      cfg.trackingHmac = {
        ...(cfg.trackingHmac || {}),
        format
      };
    }
    if (hasDataAttribute(scriptEl, "data-tracking-hmac-header")) {
      const header = getAttribute(scriptEl, "data-tracking-hmac-header");
      cfg.trackingHmac = {
        ...(cfg.trackingHmac || {}),
        header
      };
    }
    if (hasDataAttribute(scriptEl, "data-tracking-user-ip-hash")) {
      const ipHash = getAttribute(scriptEl, "data-tracking-user-ip-hash");
      cfg.trackingUserIpHash = ipHash || cfg.trackingUserIpHash;
    }
    if (hasDataAttribute(scriptEl, "data-tracking-campaign-keys")) {
      cfg.trackingCampaignKeys = parseList(
        getAttribute(scriptEl, "data-tracking-campaign-keys")
      );
    }
    if (hasDataAttribute(scriptEl, "data-tracking-utm-keys")) {
      cfg.trackingUtmKeys = parseList(
        getAttribute(scriptEl, "data-tracking-utm-keys")
      );
    }
    if (hasDataAttribute(scriptEl, "data-tracking-include-metadata")) {
      cfg.trackingIncludeMetadata = parseBoolean(
        getAttribute(scriptEl, "data-tracking-include-metadata"),
        cfg.trackingIncludeMetadata
      );
    }

    cfg.bootstrap = parseBootstrapConfig(cfg, scriptEl);

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
      "configVersion",
      "trackingEnabled",
      "trackingParameter",
      "trackingPixelEndpoint",
      "trackingIncludeMetadata",
      "trackingSamplingRate",
      "trackingRespectDnt",
      "trackingTimeoutMs",
      "trackingUserIpHash",
      "keepWarnMessageOnAllow",
      "debugMode",
      "debugLevel"
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

    if (Object.prototype.hasOwnProperty.call(overrides, "trackingAllowlist")) {
      const value = overrides.trackingAllowlist;
      cfg.trackingAllowlist = Array.isArray(value)
        ? [...value]
        : value != null
        ? parseList(String(value))
        : [];
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "trackingBlocklist")) {
      const value = overrides.trackingBlocklist;
      cfg.trackingBlocklist = Array.isArray(value)
        ? [...value]
        : value != null
        ? parseList(String(value))
        : [];
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "trackingCaptureMatrix")) {
      const value = overrides.trackingCaptureMatrix;
      if (value && typeof value === "object") {
        cfg.trackingCaptureMatrix = { ...value };
      } else if (value == null) {
        cfg.trackingCaptureMatrix = null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "trackingRetry")) {
      const value = overrides.trackingRetry;
      if (value && typeof value === "object") {
        cfg.trackingRetry = { ...cfg.trackingRetry, ...value };
      }
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "trackingHmac")) {
      const value = overrides.trackingHmac;
      if (value && typeof value === "object") {
        cfg.trackingHmac = { ...(cfg.trackingHmac || {}), ...value };
      } else if (value === null) {
        cfg.trackingHmac = null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "trackingCampaignKeys")) {
      const value = overrides.trackingCampaignKeys;
      cfg.trackingCampaignKeys = Array.isArray(value)
        ? [...value]
        : value != null
        ? parseList(String(value))
        : [];
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "trackingUtmKeys")) {
      const value = overrides.trackingUtmKeys;
      cfg.trackingUtmKeys = Array.isArray(value)
        ? [...value]
        : value != null
        ? parseList(String(value))
        : [];
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
    cfg.keepWarnMessageOnAllow = Boolean(cfg.keepWarnMessageOnAllow);
    cfg.trackingEnabled = Boolean(cfg.trackingEnabled);
    if (!cfg.trackingParameter || !/^[a-zA-Z0-9_\-]+$/.test(cfg.trackingParameter)) {
      cfg.trackingParameter = DEFAULTS.trackingParameter;
    }
    cfg.trackingPixelEndpoint = cfg.trackingPixelEndpoint
      ? String(cfg.trackingPixelEndpoint).trim()
      : "";
    cfg.trackingIncludeMetadata = Boolean(cfg.trackingIncludeMetadata);
    const rate = Number(cfg.trackingSamplingRate);
    cfg.trackingSamplingRate = Number.isFinite(rate)
      ? Math.min(Math.max(rate, 0), 1)
      : DEFAULTS.trackingSamplingRate;
    cfg.trackingAllowlist = Array.isArray(cfg.trackingAllowlist)
      ? cfg.trackingAllowlist
      : cfg.trackingAllowlist
      ? parseList(String(cfg.trackingAllowlist))
      : [];
    cfg.trackingBlocklist = Array.isArray(cfg.trackingBlocklist)
      ? cfg.trackingBlocklist
      : cfg.trackingBlocklist
      ? parseList(String(cfg.trackingBlocklist))
      : [];
    cfg.trackingRespectDnt = cfg.trackingRespectDnt !== false;
    if (cfg.trackingCaptureMatrix && typeof cfg.trackingCaptureMatrix === "object") {
      const matrix = { ...cfg.trackingCaptureMatrix };
      const overrides =
        matrix.overrides && typeof matrix.overrides === "object"
          ? { ...matrix.overrides }
          : {};
      overrides.domains =
        overrides.domains && typeof overrides.domains === "object"
          ? { ...overrides.domains }
          : {};
      overrides.pages =
        overrides.pages && typeof overrides.pages === "object"
          ? { ...overrides.pages }
          : {};
      const attachDotNotationAliases = (container) => {
        if (!container || typeof container !== "object") {
          return;
        }
        Object.keys(container).forEach((pattern) => {
          if (!pattern || pattern.indexOf(".") === -1) {
            return;
          }
          const value = container[pattern];
          const segments = pattern.split(".").filter(Boolean);
          if (!segments.length) {
            return;
          }
          let cursor = container;
          for (let i = 0; i < segments.length; i += 1) {
            const segment = segments[i];
            const isLast = i === segments.length - 1;
            const descriptor = Object.getOwnPropertyDescriptor(cursor, segment);
            if (isLast) {
              Object.defineProperty(cursor, segment, {
                value,
                enumerable: false,
                configurable: true,
                writable: true
              });
            } else {
              if (!descriptor || typeof descriptor.value !== "object" || !descriptor.value) {
                Object.defineProperty(cursor, segment, {
                  value: {},
                  enumerable: false,
                  configurable: true,
                  writable: true
                });
              }
              cursor = cursor[segment];
            }
          }
        });
      };
      attachDotNotationAliases(overrides.domains);
      matrix.overrides = overrides;
      cfg.trackingCaptureMatrix = matrix;
    } else {
      cfg.trackingCaptureMatrix = null;
    }
    const timeout = Number(cfg.trackingTimeoutMs);
    cfg.trackingTimeoutMs = Number.isFinite(timeout)
      ? Math.max(0, timeout)
      : DEFAULTS.trackingTimeoutMs;
    if (!cfg.trackingRetry || typeof cfg.trackingRetry !== "object") {
      cfg.trackingRetry = { ...DEFAULTS.trackingRetry };
    } else {
      cfg.trackingRetry = {
        attempts: Math.max(
          0,
          parseInt(cfg.trackingRetry.attempts, 10) || DEFAULTS.trackingRetry.attempts
        ),
        backoffFactor: Math.max(
          1,
          Number(cfg.trackingRetry.backoffFactor) || DEFAULTS.trackingRetry.backoffFactor
        ),
        delayMs: Math.max(
          0,
          Number(cfg.trackingRetry.delayMs) || DEFAULTS.trackingRetry.delayMs
        )
      };
    }
    if (cfg.trackingHmac && typeof cfg.trackingHmac === "object") {
      const hmac = { ...cfg.trackingHmac };
      hmac.secret = typeof hmac.secret === "string" ? hmac.secret : "";
      hmac.algorithm =
        typeof hmac.algorithm === "string" && hmac.algorithm
          ? hmac.algorithm.toUpperCase()
          : "SHA-256";
      hmac.format =
        typeof hmac.format === "string" && hmac.format.toLowerCase() === "hex"
          ? "hex"
          : "base64";
      hmac.header =
        typeof hmac.header === "string" && hmac.header
          ? hmac.header
          : "X-Myclid-Signature";
      hmac.enabled = Boolean(hmac.enabled || hmac.secret);
      cfg.trackingHmac = hmac;
    } else {
      cfg.trackingHmac = null;
    }
    cfg.trackingUserIpHash =
      typeof cfg.trackingUserIpHash === "string" && cfg.trackingUserIpHash
        ? cfg.trackingUserIpHash
        : null;
    cfg.trackingCampaignKeys = Array.isArray(cfg.trackingCampaignKeys)
      ? cfg.trackingCampaignKeys
      : cfg.trackingCampaignKeys
      ? parseList(String(cfg.trackingCampaignKeys))
      : [];
    cfg.trackingUtmKeys = Array.isArray(cfg.trackingUtmKeys)
      ? cfg.trackingUtmKeys
      : cfg.trackingUtmKeys
      ? parseList(String(cfg.trackingUtmKeys))
      : [];
    cfg.debugMode = Boolean(cfg.debugMode);
    if (!VALID_DEBUG_LEVELS.has(String(cfg.debugLevel || "").toLowerCase())) {
      cfg.debugLevel = DEFAULTS.debugLevel;
    } else {
      cfg.debugLevel = String(cfg.debugLevel).trim().toLowerCase();
    }

    const bootstrapRaw =
      cfg.bootstrap && typeof cfg.bootstrap === "object" ? cfg.bootstrap : null;
    let bootstrapCfg;
    if (bootstrapRaw) {
      bootstrapCfg = {
        enabled: bootstrapRaw.enabled !== false,
        allowlist: Array.isArray(bootstrapRaw.allowlist)
          ? bootstrapRaw.allowlist.map((item) => String(item).trim()).filter(Boolean)
          : bootstrapRaw.allowlist
          ? parseList(String(bootstrapRaw.allowlist))
          : [],
        externalPolicy:
          bootstrapRaw.externalPolicy && typeof bootstrapRaw.externalPolicy === "object"
            ? { ...bootstrapRaw.externalPolicy }
            : {},
        seo:
          bootstrapRaw.seo && typeof bootstrapRaw.seo === "object"
            ? { ...bootstrapRaw.seo }
            : {},
        debug: Boolean(bootstrapRaw.debug)
      };
    } else {
      bootstrapCfg = parseBootstrapConfig(cfg, null);
    }

    const allowedBootstrapActions = new Set(["allow", "warn", "deny"]);
    const normalizedAction = String(
      bootstrapCfg.externalPolicy?.action || ""
    ).toLowerCase();
    bootstrapCfg.externalPolicy = {
      action: allowedBootstrapActions.has(normalizedAction)
        ? normalizedAction
        : "warn",
      message:
        typeof bootstrapCfg.externalPolicy?.message === "string" &&
        bootstrapCfg.externalPolicy.message.trim()
          ? bootstrapCfg.externalPolicy.message
          : cfg.warnMessageDefault
    };

    bootstrapCfg.seo = {
      enforceAttributes: bootstrapCfg.seo?.enforceAttributes !== false,
      enforceNewTab: cfg.newTab !== false
    };
    bootstrapCfg.enabled = bootstrapCfg.enabled !== false;
    bootstrapCfg.allowlist = Array.isArray(bootstrapCfg.allowlist)
      ? bootstrapCfg.allowlist.map((item) => item.trim()).filter(Boolean)
      : [];
    bootstrapCfg.debug = Boolean(bootstrapCfg.debug);

    cfg.bootstrap = bootstrapCfg;

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
      configVersion: String(config.configVersion || ""),
      trackingEnabled: Boolean(config.trackingEnabled),
      trackingParameter: String(config.trackingParameter || ""),
      trackingPixelEndpoint: String(config.trackingPixelEndpoint || ""),
      trackingIncludeMetadata: Boolean(config.trackingIncludeMetadata),
      keepWarnMessageOnAllow: Boolean(config.keepWarnMessageOnAllow),
      debugMode: Boolean(config.debugMode),
      debugLevel: VALID_DEBUG_LEVELS.has(
        String(config.debugLevel || "").toLowerCase()
      )
        ? String(config.debugLevel).toLowerCase()
        : DEFAULTS.debugLevel,
      bootstrap: {
        enabled: Boolean(config.bootstrap?.enabled),
        allowlist: normalizeArray(config.bootstrap?.allowlist || []),
        action: String(config.bootstrap?.externalPolicy?.action || ""),
        message: String(config.bootstrap?.externalPolicy?.message || ""),
        enforceAttributes: Boolean(
          config.bootstrap?.seo?.enforceAttributes !== false
        )
      }
    };
    return JSON.stringify(safeConfig);
  }; // Genera una firma stabile delle impostazioni correnti per invalidare cache e asset.

  const buildSettings = (scriptEl, overrides) => {
    const cfg = cloneDefaults();
    applyScriptAttributes(cfg, scriptEl);
    applyManualOverrides(cfg, overrides);
    return normalizeConfig(cfg);
  }; // Orchestratore: fonde default, attributi `data-*` e override.

  namespace.defaults = Object.freeze({
    ...cloneDefaults(),
    rel: [...DEFAULTS.rel]
  });
  namespace.buildSettings = buildSettings;
  namespace.utils = {
    parseBoolean,
    parseInteger,
    parseFloatNumber,
    parseList,
    parseMode,
    parseHoverFeedback,
    computeSettingsFingerprint
  };

  if (namespace.i18n && typeof namespace.i18n.onLanguageChange === "function") {
    namespace.i18n.onLanguageChange(() => {
      namespace.defaults = Object.freeze({
        ...cloneDefaults(),
        rel: [...DEFAULTS.rel]
      });
    });
  }
})(typeof window !== "undefined" ? window : this);
