/*!
 * Safe External Links Guard — v4.7
 * - Async, policy lato server, DENY immediato
 * - Normalizzazione action endpoint (allow|warn|deny)
 * - Blocco immediato da cache; sostituzione <a>→<span> aggiorna l’indice
 * - Modalità soft con evidenziazione configurabile e messaggi lato server
 * - Supporto a selettori esclusi definiti nell’attributo data-exclude-selectors
 * - Messaggi su hover configurabili (tooltip personalizzato oppure title="")
 * - Cache policy isolata per configurazione con invalidazione automatica in deploy
*/
(function () {
  "use strict";

  // ===== Config dal tag <script> =====
  const thisScript = document.currentScript || (function () {
    const s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();

  const guardNamespace = (window.SafeExternalLinksGuard =
    window.SafeExternalLinksGuard || {});
  /**
   * Runtime controller responsabile della gestione avanzata del parametro
   * di tracciamento `myclid` (o personalizzato). L'istanza viene inizializzata
   * dopo la costruzione della configurazione per poter accedere alle impostazioni
   * finali e condividere l'API pubblica sul namespace globale.
   * @type {ReturnType<createMyclidTrackingRuntime>|null}
   */
  let trackingRuntime = null;
  let runtimeLanguageSnapshot = {
    preferred: null,
    alternatives: [],
    documentLang: null,
    sources: []
  };
  const VALID_MODES = new Set(["strict", "warn", "soft"]);
  const DEBUG_LEVELS = new Set(["basic", "verbose"]);

  /**
   * Converte un oggetto Error in una rappresentazione serializzabile.
   * @param {Error|any} error
   * @returns {{ name: string, message: string, stack?: string }|null}
   */
  const serializeError = (error) => {
    if (!error || typeof error !== "object") {
      return null;
    }
    return {
      name: error.name || "Error",
      message:
        typeof error.message === "string"
          ? error.message
          : String(error.message || error),
      stack:
        typeof error.stack === "string" && error.stack.trim()
          ? error.stack
          : undefined
    };
  };

  const sanitizeDetails = (value, depth = 0) => {
    if (
      value == null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }
    if (value instanceof Error) {
      return serializeError(value);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "function") {
      return `[function ${value.name || "anonymous"}]`;
    }
    if (Array.isArray(value)) {
      if (depth > 2) {
        return value.length;
      }
      return value.slice(0, 20).map((item) => sanitizeDetails(item, depth + 1));
    }
    if (typeof value === "object") {
      if (depth > 2) {
        try {
          return Object.keys(value);
        } catch (err) {
          return `[object depth-limit]`;
        }
      }
      const output = {};
      const keys = Object.keys(value);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        const current = value[key];
        if (
          current &&
          typeof current === "object" &&
          typeof current.tagName === "string"
        ) {
          output[key] = `<${current.tagName.toLowerCase()}>`;
          continue;
        }
        try {
          output[key] = sanitizeDetails(current, depth + 1);
        } catch (err) {
          output[key] = `[unserializable:${typeof current}]`;
        }
      }
      return output;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return String(value);
    }
  };

  const getConsoleMethod = (type) => {
    if (typeof console === "undefined") {
      return null;
    }
    if (type === "error" && typeof console.error === "function") {
      return "error";
    }
    if (type === "warn" && typeof console.warn === "function") {
      return "warn";
    }
    if (type === "info" && typeof console.info === "function") {
      return "info";
    }
    if (typeof console.log === "function") {
      return "log";
    }
    return null;
  };

  const createDebugManager = () => {
    const entries = [];
    let state = {
      enabled: false,
      level: "basic",
      context: {},
      updatedAt: null
    };

    const record = (type, message, details, meta = {}) => {
      const levelCandidate =
        typeof meta.level === "string"
          ? meta.level.trim().toLowerCase()
          : "basic";
      const level = DEBUG_LEVELS.has(levelCandidate)
        ? levelCandidate
        : "basic";
      const scope =
        typeof meta.scope === "string" && meta.scope.trim()
          ? meta.scope.trim()
          : null;
      const tags = Array.isArray(meta.tags)
        ? meta.tags.filter((tag) => typeof tag === "string" && tag.trim())
        : [];
      const persistAlways = Boolean(meta.persistWhenDisabled);
      const entry = {
        timestamp: new Date().toISOString(),
        type,
        level,
        message,
        scope,
        tags: tags.length ? tags : undefined,
        details:
          details === undefined ? null : sanitizeDetails(details, meta.depth || 0)
      };
      if (!state.enabled && !persistAlways) {
        return entry;
      }
      entries.push(entry);
      if (level === "verbose" && state.level !== "verbose") {
        return entry;
      }
      const method = getConsoleMethod(type === "event" ? "info" : type);
      if (!method) {
        return entry;
      }
      const labelScope = scope ? `[${scope}]` : "";
      const label = `[SafeLinkGuard][${type.toUpperCase()}]${labelScope} ${message}`;
      const payload = entry.details === null ? undefined : entry.details;
      try {
        if (payload !== undefined) {
          console[method](label, payload);
        } else {
          console[method](label);
        }
      } catch (err) {
        // Evita che errori del console logger interrompano il flusso principale.
      }
      return entry;
    };

    return {
      configure(options = {}) {
        const enabled =
          typeof options.enabled === "boolean"
            ? options.enabled
            : Boolean(options.debugMode);
        const requestedLevel =
          typeof options.level === "string"
            ? options.level
            : typeof options.debugLevel === "string"
            ? options.debugLevel
            : "";
        const normalizedLevel = DEBUG_LEVELS.has(
          String(requestedLevel || "").toLowerCase()
        )
          ? String(requestedLevel).trim().toLowerCase()
          : "basic";
        state = {
          enabled,
          level: normalizedLevel,
          context: options.context ? sanitizeDetails(options.context) : {},
          updatedAt: new Date().toISOString()
        };
        const contextDetails = {
          level: normalizedLevel,
          context: state.context
        };
        record(
          "info",
          enabled
            ? `Modalità debug attiva (livello: ${normalizedLevel})`
            : "Modalità debug disattivata",
          contextDetails,
          { scope: "debug", persistWhenDisabled: true }
        );
        return { ...state };
      },
      info(message, details, meta) {
        return record("info", message, details, meta);
      },
      warn(message, details, meta) {
        return record("warn", message, details, meta);
      },
      error(message, details, meta) {
        const payload =
          details instanceof Error ? serializeError(details) : details;
        return record("error", message, payload, meta);
      },
      event(message, details, meta) {
        return record("event", message, details, meta);
      },
      verbose(message, details, meta) {
        const mergedMeta = { ...(meta || {}), level: "verbose" };
        return record("info", message, details, mergedMeta);
      },
      getState() {
        return { ...state };
      },
      getEntries() {
        return entries.map((entry) => ({ ...entry }));
      },
      exportAsJson(options = {}) {
        const payload = {
          generatedAt: new Date().toISOString(),
          state: { ...state },
          entries: entries.map((entry) => ({ ...entry }))
        };
        if (options.pretty === false) {
          return JSON.stringify(payload);
        }
        return JSON.stringify(payload, null, 2);
      }
    };
  };

  if (typeof guardNamespace.createDebugManager !== "function") {
    guardNamespace.createDebugManager = () => createDebugManager();
  }

  const hasExistingDebug =
    guardNamespace.debug &&
    typeof guardNamespace.debug.info === "function" &&
    typeof guardNamespace.debug.exportAsJson === "function" &&
    guardNamespace.debug.__isStub !== true;

  const debug = hasExistingDebug
    ? guardNamespace.debug
    : guardNamespace.createDebugManager();

  guardNamespace.debug = debug;

  const FALLBACK_WARN_MESSAGE =
    "This link is not verified and may share your browsing data with a third-party site. Make sure the destination is trustworthy before continuing.";

  const FALLBACK_UI_TEXT = {
    "messages.defaultWarn": FALLBACK_WARN_MESSAGE,
    "messages.denyDefault": "Domain blocked. Proceed with caution.",
    "messages.endpointUnavailable": "Policy resolver temporarily unavailable. Proceed with caution.",
    "messages.timeout": "The request to verify this domain timed out. Please try again.",
    "messages.error": "An error occurred while verifying this domain. Proceed with caution.",
    "messages.missingHost": "Host is missing from the request.",
    "messages.policy.phishing": "Domain reported for phishing.",
    "messages.policy.ruBlock": "All .ru sub-domains are blocked.",
    "messages.policy.github": "Verified GitHub repository.",
    "messages.policy.officialSubdomain": "Official tuo-sito.it sub-domain.",
    "messages.policy.beta": "Beta environment: double-check before continuing.",
    "modal.title": "Check that this link is safe",
    "modal.closeLabel": "Close",
    "modal.closeTitle": "Close",
    "modal.hostLabel": "Host:",
    "modal.openButton": "Open link",
    "modal.copyButton": "Copy link",
    "modal.cancelButton": "Cancel"
  };

  const LOCALIZED_FALLBACK_TRANSLATIONS = {
    it: {
      "messages.defaultWarn":
        "Questo link non è verificato e può contenere dati della tua navigazione che saranno condivisi con un sito di terzi. Prima di procedere, assicurati che il link sia affidabile.",
      "messages.denyDefault": "Dominio bloccato. Procedi con cautela.",
      "messages.endpointUnavailable":
        "Resolver delle policy temporaneamente non disponibile. Procedi con cautela.",
      "messages.timeout": "La verifica del dominio è scaduta. Procedi con cautela.",
      "messages.error": "Si è verificato un errore durante la verifica del dominio. Procedi con cautela.",
      "messages.missingHost": "Host mancante nella richiesta.",
      "messages.policy.phishing": "Dominio segnalato per phishing.",
      "messages.policy.ruBlock": "Tutti i sottodomini .ru sono bloccati.",
      "messages.policy.github": "Repository GitHub verificato.",
      "messages.policy.officialSubdomain": "Sottodominio ufficiale tuo-sito.it.",
      "messages.policy.beta": "Ambiente beta: verifica prima di procedere.",
      "modal.title": "Controlla che questo link sia sicuro",
      "modal.closeLabel": "Chiudi",
      "modal.closeTitle": "Chiudi",
      "modal.hostLabel": "Host:",
      "modal.openButton": "Apri link",
      "modal.copyButton": "Copia link",
      "modal.cancelButton": "Annulla"
    },
    es: {
      "messages.defaultWarn":
        "Este enlace no está verificado y puede compartir tus datos de navegación con un sitio de terceros. Antes de continuar, asegúrate de que el destino sea de confianza.",
      "messages.denyDefault": "Dominio bloqueado. Procede con precaución.",
      "messages.endpointUnavailable":
        "El resolvedor de políticas no está disponible temporalmente. Procede con precaución.",
      "messages.timeout": "La verificación del dominio superó el tiempo límite. Procede con precaución.",
      "messages.error": "Se produjo un error al verificar el dominio. Procede con precaución.",
      "messages.missingHost": "Falta el host en la solicitud.",
      "messages.policy.phishing": "Dominio reportado por phishing.",
      "messages.policy.ruBlock": "Se bloquean todos los subdominios .ru.",
      "messages.policy.github": "Repositorio de GitHub verificado.",
      "messages.policy.officialSubdomain": "Subdominio oficial de tuo-sito.it.",
      "messages.policy.beta": "Entorno beta: verifica antes de continuar.",
      "modal.title": "Comprueba que este enlace sea seguro",
      "modal.closeLabel": "Cerrar",
      "modal.closeTitle": "Cerrar",
      "modal.hostLabel": "Host:",
      "modal.openButton": "Abrir enlace",
      "modal.copyButton": "Copiar enlace",
      "modal.cancelButton": "Cancelar"
    },
    fr: {
      "messages.defaultWarn":
        "Ce lien n'est pas vérifié et peut partager vos données de navigation avec un site tiers. Assurez-vous que la destination est fiable avant de continuer.",
      "messages.denyDefault": "Domaine bloqué. Procédez avec prudence.",
      "messages.endpointUnavailable":
        "Le service de résolution des politiques est temporairement indisponible. Procédez avec prudence.",
      "messages.timeout": "La vérification du domaine a expiré. Procédez avec prudence.",
      "messages.error": "Une erreur est survenue lors de la vérification du domaine. Procédez avec prudence.",
      "messages.missingHost": "Hôte manquant dans la requête.",
      "messages.policy.phishing": "Domaine signalé pour phishing.",
      "messages.policy.ruBlock": "Tous les sous-domaines .ru sont bloqués.",
      "messages.policy.github": "Référentiel GitHub vérifié.",
      "messages.policy.officialSubdomain": "Sous-domaine officiel tuo-sito.it.",
      "messages.policy.beta": "Environnement bêta : vérifiez avant de continuer.",
      "modal.title": "Vérifiez que ce lien est sûr",
      "modal.closeLabel": "Fermer",
      "modal.closeTitle": "Fermer",
      "modal.hostLabel": "Hôte :",
      "modal.openButton": "Ouvrir le lien",
      "modal.copyButton": "Copier le lien",
      "modal.cancelButton": "Annuler"
    },
    de: {
      "messages.defaultWarn":
        "Dieser Link ist nicht verifiziert und kann Ihre Browsing-Daten mit einer Drittanbieter-Website teilen. Stellen Sie vor dem Fortfahren sicher, dass das Ziel vertrauenswürdig ist.",
      "messages.denyDefault": "Domain blockiert. Bitte mit Vorsicht fortfahren.",
      "messages.endpointUnavailable":
        "Policy-Resolver vorübergehend nicht verfügbar. Bitte mit Vorsicht fortfahren.",
      "messages.timeout": "Die Überprüfung der Domain hat zu lange gedauert. Bitte mit Vorsicht fortfahren.",
      "messages.error": "Bei der Überprüfung der Domain ist ein Fehler aufgetreten. Bitte mit Vorsicht fortfahren.",
      "messages.missingHost": "Host in der Anfrage fehlt.",
      "messages.policy.phishing": "Domain wegen Phishing gemeldet.",
      "messages.policy.ruBlock": "Alle .ru-Subdomains sind blockiert.",
      "messages.policy.github": "Verifiziertes GitHub-Repository.",
      "messages.policy.officialSubdomain": "Offizielle tuo-sito.it-Subdomain.",
      "messages.policy.beta": "Beta-Umgebung: Vor dem Fortfahren prüfen.",
      "modal.title": "Prüfen Sie, ob dieser Link sicher ist",
      "modal.closeLabel": "Schließen",
      "modal.closeTitle": "Schließen",
      "modal.hostLabel": "Host:",
      "modal.openButton": "Link öffnen",
      "modal.copyButton": "Link kopieren",
      "modal.cancelButton": "Abbrechen"
    },
    pt: {
      "messages.defaultWarn":
        "Este link não é verificado e pode compartilhar seus dados de navegação com um site de terceiros. Antes de continuar, garanta que o destino seja confiável.",
      "messages.denyDefault": "Domínio bloqueado. Prossiga com cautela.",
      "messages.endpointUnavailable":
        "Resolver de políticas temporariamente indisponível. Prossiga com cautela.",
      "messages.timeout": "A verificação do domínio excedeu o tempo limite. Prossiga com cautela.",
      "messages.error": "Ocorreu um erro ao verificar este domínio. Prossiga com cautela.",
      "messages.missingHost": "Host ausente na requisição.",
      "messages.policy.phishing": "Domínio sinalizado por phishing.",
      "messages.policy.ruBlock": "Todos os subdomínios .ru estão bloqueados.",
      "messages.policy.github": "Repositório GitHub verificado.",
      "messages.policy.officialSubdomain": "Subdomínio oficial tuo-sito.it.",
      "messages.policy.beta": "Ambiente beta: verifique antes de continuar.",
      "modal.title": "Verifique se este link é seguro",
      "modal.closeLabel": "Fechar",
      "modal.closeTitle": "Fechar",
      "modal.hostLabel": "Host:",
      "modal.openButton": "Abrir link",
      "modal.copyButton": "Copiar link",
      "modal.cancelButton": "Cancelar"
    },
    "pt-br": {
      "messages.defaultWarn":
        "Este link não é verificado e pode compartilhar os seus dados de navegação com um site de terceiros. Antes de continuar, garanta que o destino seja confiável.",
      "messages.denyDefault": "Domínio bloqueado. Prossiga com cautela.",
      "messages.endpointUnavailable":
        "Resolver de políticas temporariamente indisponível. Prossiga com cautela.",
      "messages.timeout": "A verificação do domínio excedeu o tempo limite. Prossiga com cautela.",
      "messages.error": "Ocorreu um erro ao verificar este domínio. Prossiga com cautela.",
      "messages.missingHost": "Host ausente na requisição.",
      "messages.policy.phishing": "Domínio sinalizado por phishing.",
      "messages.policy.ruBlock": "Todos os subdomínios .ru estão bloqueados.",
      "messages.policy.github": "Repositório GitHub verificado.",
      "messages.policy.officialSubdomain": "Subdomínio oficial tuo-sito.it.",
      "messages.policy.beta": "Ambiente beta: verifique antes de continuar.",
      "modal.title": "Verifique se este link é seguro",
      "modal.closeLabel": "Fechar",
      "modal.closeTitle": "Fechar",
      "modal.hostLabel": "Host:",
      "modal.openButton": "Abrir link",
      "modal.copyButton": "Copiar link",
      "modal.cancelButton": "Cancelar"
    },
    ru: {
      "messages.defaultWarn":
        "Эта ссылка не проверена и может передавать ваши данные о просмотре стороннему сайту. Перед продолжением убедитесь, что адрес доверенный.",
      "messages.denyDefault": "Домен заблокирован. Действуйте с осторожностью.",
      "messages.endpointUnavailable":
        "Определитель политик временно недоступен. Действуйте с осторожностью.",
      "messages.timeout": "Проверка домена превысила допустимое время. Действуйте с осторожностью.",
      "messages.error": "Произошла ошибка при проверке домена. Действуйте с осторожностью.",
      "messages.missingHost": "В запросе отсутствует хост.",
      "messages.policy.phishing": "Домен отмечен как источник фишинга.",
      "messages.policy.ruBlock": "Все поддомены .ru заблокированы.",
      "messages.policy.github": "Подтверждённый репозиторий GitHub.",
      "messages.policy.officialSubdomain": "Официальный поддомен tuo-sito.it.",
      "messages.policy.beta": "Бета-среда: проверьте данные перед продолжением.",
      "modal.title": "Убедитесь, что эта ссылка безопасна",
      "modal.closeLabel": "Закрыть",
      "modal.closeTitle": "Закрыть",
      "modal.hostLabel": "Хост:",
      "modal.openButton": "Открыть ссылку",
      "modal.copyButton": "Копировать ссылку",
      "modal.cancelButton": "Отмена"
    }
  };

  const normalizeFallbackLanguage = (lang) => {
    if (!lang || typeof lang !== "string") {
      return "";
    }
    const trimmed = lang.trim();
    if (!trimmed) {
      return "";
    }
    return trimmed.replace(/[_\s]+/g, "-").toLowerCase();
  };

  const collectEnvironmentLanguageHints = () => {
    const hints = [];
    if (typeof navigator !== "undefined" && navigator) {
      const navLanguages = Array.isArray(navigator.languages)
        ? navigator.languages
        : [];
      for (let i = 0; i < navLanguages.length; i += 1) {
        const candidate = navLanguages[i];
        if (candidate) {
          hints.push(candidate);
        }
      }
      if (!navLanguages.length && typeof navigator.language === "string") {
        hints.push(navigator.language);
      }
    }
    if (typeof document !== "undefined" && document) {
      const docEl = document.documentElement;
      if (docEl && typeof docEl.lang === "string" && docEl.lang) {
        hints.push(docEl.lang);
      }
    }
    return hints;
  };

  const buildFallbackLanguagePriority = (languageHints) => {
    const seen = new Set();
    const priority = [];
    const pushLanguage = (value) => {
      const normalized = normalizeFallbackLanguage(value);
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      priority.push(normalized);
    };

    if (languageHints) {
      if (Array.isArray(languageHints)) {
        for (let i = 0; i < languageHints.length; i += 1) {
          pushLanguage(languageHints[i]);
        }
      } else {
        pushLanguage(languageHints);
      }
    } else {
      if (
        guardNamespace.i18n &&
        typeof guardNamespace.i18n.getLanguage === "function"
      ) {
        pushLanguage(guardNamespace.i18n.getLanguage());
      }
      if (runtimeLanguageSnapshot) {
        if (runtimeLanguageSnapshot.preferred) {
          pushLanguage(runtimeLanguageSnapshot.preferred);
        }
        if (Array.isArray(runtimeLanguageSnapshot.alternatives)) {
          for (let i = 0; i < runtimeLanguageSnapshot.alternatives.length; i += 1) {
            pushLanguage(runtimeLanguageSnapshot.alternatives[i]);
          }
        }
        if (runtimeLanguageSnapshot.documentLang) {
          pushLanguage(runtimeLanguageSnapshot.documentLang);
        }
      }
    }

    const environmentHints = collectEnvironmentLanguageHints();
    for (let i = 0; i < environmentHints.length; i += 1) {
      pushLanguage(environmentHints[i]);
    }

    pushLanguage("en");
    return priority;
  };

  const resolveLocalizedFallback = (key, replacements, languageHints) => {
    const languages = buildFallbackLanguagePriority(languageHints);
    for (let i = 0; i < languages.length; i += 1) {
      const language = languages[i];
      const variants = [language];
      if (language.includes("-")) {
        const base = language.split("-")[0];
        if (base && variants.indexOf(base) === -1) {
          variants.push(base);
        }
      }
      for (let j = 0; j < variants.length; j += 1) {
        const variant = variants[j];
        if (
          Object.prototype.hasOwnProperty.call(
            LOCALIZED_FALLBACK_TRANSLATIONS,
            variant
          )
        ) {
          const dictionary = LOCALIZED_FALLBACK_TRANSLATIONS[variant];
          if (Object.prototype.hasOwnProperty.call(dictionary, key)) {
            const template = dictionary[key];
            if (typeof template === "string") {
              return applyTemplate(template, replacements);
            }
          }
        }
      }
    }
    return null;
  };

  const resolveFallbackText = (key, replacements, languageHints) => {
    const localized = resolveLocalizedFallback(key, replacements, languageHints);
    if (localized) {
      return localized;
    }
    if (Object.prototype.hasOwnProperty.call(FALLBACK_UI_TEXT, key)) {
      return applyTemplate(FALLBACK_UI_TEXT[key], replacements);
    }
    return null;
  };

  guardNamespace.__internals = guardNamespace.__internals || {};
  guardNamespace.__internals.resolveFallbackText = (
    key,
    replacements,
    languageHints
  ) => resolveFallbackText(key, replacements, languageHints);
  guardNamespace.__internals.getFallbackLanguages = () =>
    Object.keys(LOCALIZED_FALLBACK_TRANSLATIONS);

  const applyTemplate = (text, replacements) => {
    if (!replacements || typeof replacements !== "object") {
      return text;
    }
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token) => {
      if (Object.prototype.hasOwnProperty.call(replacements, token)) {
        const value = replacements[token];
        return value == null ? "" : String(value);
      }
      return match;
    });
  };

  const isPlainObject = (value) =>
    value != null && typeof value === "object" && !Array.isArray(value);

  const normalizeMessageDescriptor = (value) => {
    if (!value) return null;
    if (typeof value === "string") {
      return { text: value };
    }
    if (!isPlainObject(value)) {
      return null;
    }
    const descriptor = {};
    const keyCandidate =
      typeof value.key === "string"
        ? value.key
        : typeof value.messageKey === "string"
        ? value.messageKey
        : null;
    if (keyCandidate && keyCandidate.trim()) {
      descriptor.key = keyCandidate.trim();
    }
    const fallbackCandidate =
      typeof value.fallbackKey === "string"
        ? value.fallbackKey
        : typeof value.messageFallbackKey === "string"
        ? value.messageFallbackKey
        : typeof value.fallback === "string"
        ? value.fallback
        : null;
    if (fallbackCandidate && fallbackCandidate.trim()) {
      descriptor.fallbackKey = fallbackCandidate.trim();
    }
    const textCandidate =
      typeof value.text === "string"
        ? value.text
        : typeof value.message === "string"
        ? value.message
        : typeof value.default === "string"
        ? value.default
        : typeof value.fallbackText === "string"
        ? value.fallbackText
        : null;
    if (textCandidate) {
      descriptor.text = textCandidate;
    }
    const replacementsSource =
      value.replacements ||
      value.params ||
      value.variables ||
      value.messageReplacements;
    if (isPlainObject(replacementsSource)) {
      descriptor.replacements = replacementsSource;
    }
    return Object.keys(descriptor).length ? descriptor : null;
  };

  const extractMessageDescriptorFromResponse = (response) => {
    if (!response) {
      return null;
    }
    if (typeof response === "string") {
      return { text: response };
    }
    if (!isPlainObject(response)) {
      return null;
    }
    const base = normalizeMessageDescriptor(response.message) || {};
    const descriptor = { ...base };
    const responseKey =
      typeof response.messageKey === "string"
        ? response.messageKey
        : typeof response.message_key === "string"
        ? response.message_key
        : null;
    if (responseKey && !descriptor.key) {
      descriptor.key = responseKey;
    }
    const responseFallback =
      typeof response.messageFallbackKey === "string"
        ? response.messageFallbackKey
        : typeof response.message_fallback_key === "string"
        ? response.message_fallback_key
        : null;
    if (responseFallback && !descriptor.fallbackKey) {
      descriptor.fallbackKey = responseFallback;
    }
    if (!descriptor.text && typeof response.message === "string") {
      descriptor.text = response.message;
    }
    const responseReplacements =
      response.messageReplacements || response.message_replacements;
    if (!descriptor.replacements && isPlainObject(responseReplacements)) {
      descriptor.replacements = responseReplacements;
    }
    return Object.keys(descriptor).length ? descriptor : null;
  };

  const translateMessageDescriptor = (descriptor, fallback) => {
    const normalized = normalizeMessageDescriptor(descriptor);
    const replacements =
      normalized && isPlainObject(normalized.replacements)
        ? normalized.replacements
        : null;
    const chain = [];
    if (normalized?.key) {
      chain.push(normalized.key);
    }
    if (
      normalized?.fallbackKey &&
      normalized.fallbackKey !== normalized.key
    ) {
      chain.push(normalized.fallbackKey);
    }
    if (normalized?.text) {
      chain.push(normalized.text);
    }
    if (fallback) {
      chain.push(fallback);
    }
    if (!chain.length) {
      return fallback || "";
    }
    const i18n = guardNamespace.i18n;
    if (i18n && typeof i18n.t === "function") {
      return i18n.t(chain, replacements);
    }
    for (let i = 0; i < chain.length; i += 1) {
      const candidate = chain[i];
      if (typeof candidate === "string") {
        const fallbackText = resolveFallbackText(
          candidate,
          replacements
        );
        if (fallbackText) {
          return fallbackText;
        }
      }
    }
    const last = chain[chain.length - 1];
    if (typeof last === "string") {
      return applyTemplate(last, replacements);
    }
    return fallback || "";
  };

  const translate = (key, replacements) => {
    const i18n = guardNamespace.i18n;
    if (i18n && typeof i18n.t === "function") {
      const value = i18n.t(key, replacements);
      if (value && value !== key) {
        return value;
      }
    }
    const fallbackText = resolveFallbackText(key, replacements);
    if (fallbackText) {
      return fallbackText;
    }
    return key;
  };

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const getDefaultModalTemplate = () => {
    const title = escapeHtml(translate("modal.title"));
    const closeLabel = escapeHtml(translate("modal.closeLabel"));
    const closeTitle = escapeHtml(translate("modal.closeTitle"));
    const hostLabel = escapeHtml(translate("modal.hostLabel"));
    const openButton = escapeHtml(translate("modal.openButton"));
    const copyButton = escapeHtml(translate("modal.copyButton"));
    const cancelButton = escapeHtml(translate("modal.cancelButton"));
    const message = escapeHtml(translate("messages.defaultWarn"));
    return `
    <div data-slg-root class="slg-overlay slg--hidden">
      <div class="slg-wrap">
        <div class="slg-dialog" data-slg-element="dialog">
          <div class="slg-header">
            <h2 id="slg-title" class="slg-title" data-slg-element="title">${title}</h2>
            <button type="button" class="slg-close" data-slg-element="close" aria-label="${closeLabel}" title="${closeTitle}">✕</button>
          </div>
          <div class="slg-body">
            <p id="slg-message" data-slg-element="message">${message}</p>
            <p>
              <span class="slg-host-label" data-slg-element="host-label">${hostLabel}</span>
              <span id="slg-host" class="slg-host" data-slg-element="host"></span>
            </p>
            <div class="slg-actions">
              <a id="slg-open" class="slg-btn primary" data-slg-element="open" rel="noopener noreferrer nofollow" target="_blank">${openButton}</a>
              <button id="slg-copy" class="slg-btn secondary" data-slg-element="copy" type="button">${copyButton}</button>
              <button id="slg-cancel" class="slg-btn secondary" data-slg-element="cancel" type="button">${cancelButton}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  };

  let defaultWarnMessage = translate("messages.defaultWarn");
  let defaultDenyMessage = translate("messages.denyDefault");
  const TEXT_NODE = typeof Node !== "undefined" ? Node.TEXT_NODE : 3;

  /**
   * Calcola la quantità di padding da applicare al body quando la scrollbar
   * verticale scompare (modal aperta) per evitare lo shift orizzontale del layout.
   * Restituisce sempre un numero >= del padding di partenza.
   * @param {number} basePadding - Padding destro corrente (px).
   * @param {number} scrollbarWidth - Larghezza della scrollbar da compensare (px).
   * @returns {number}
   */
  const computeScrollLockPadding = (basePadding, scrollbarWidth) => {
    const base = Number.isFinite(basePadding) && basePadding > 0 ? basePadding : 0;
    const extra =
      Number.isFinite(scrollbarWidth) && scrollbarWidth > 0 ? scrollbarWidth : 0;
    return base + extra;
  };
  let buildSettings = guardNamespace.buildSettings;
  let computeSettingsFingerprint =
    guardNamespace.utils &&
    typeof guardNamespace.utils.computeSettingsFingerprint === "function"
      ? guardNamespace.utils.computeSettingsFingerprint
      : null;
  let usingLegacySettings = false;

  if (typeof buildSettings !== "function") {
    usingLegacySettings = true;
    // Fallback legacy: se il file links-guard.settings.js non è stato caricato,
    // ricostruiamo la configurazione mantenendo la compatibilità con le versioni precedenti.
    const fallbackDefaults = {
      endpoint: "/links/policy",
      timeoutMs: 900,
      cacheTtlSec: 3600,
      mode: "strict",
      removeNode: true,
      showCopyButton: false,
      hoverFeedback: "tooltip",
      rel: ["noopener", "noreferrer", "nofollow"],
      newTab: true,
      zIndex: 999999,
      maxConcurrent: 4,
      warnHighlightClass: "slg-warn-highlight",
      warnMessageDefault: defaultWarnMessage,
      excludeSelectors: [],
      configVersion: "1.5.14",
      trackingEnabled: false,
      trackingParameter: "myclid",
      trackingPixelEndpoint: "",
      trackingIncludeMetadata: true,
      keepWarnMessageOnAllow: false,
      debugMode: false,
      debugLevel: "basic"
    };

    const getAttribute = (node, attr) => {
      if (!node) return null;
      const raw = node.getAttribute(attr);
      return raw == null ? null : raw.trim();
    };

    const parseBoolean = (value, defaultValue) => {
      if (value == null || value === "") return defaultValue;
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;
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

    const parseMode = (value) => {
      if (!value) return "strict";
      const normalized = value.trim().toLowerCase();
      return VALID_MODES.has(normalized) ? normalized : "strict";
    };

    const parseHoverFeedback = (value, defaultValue) => {
      if (!value) return defaultValue;
      const normalized = value.trim().toLowerCase();
      return normalized === "tooltip" ? "tooltip" : "title";
    };

    const parseDebugLevel = (value) => {
      if (!value) return "basic";
      const normalized = value.trim().toLowerCase();
      return DEBUG_LEVELS.has(normalized) ? normalized : "basic";
    };

    const normalizeArray = (items) => {
      if (!Array.isArray(items)) return [];
      return items
        .map((item) => String(item).trim())
        .filter(Boolean)
        .sort();
    };

    const fallbackComputeFingerprint = (config) => {
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
        keepWarnMessageOnAllow: Boolean(config.keepWarnMessageOnAllow)
      };
      return JSON.stringify(safeConfig);
    };

    debug.warn(
      "Configurazione legacy attiva: links-guard.settings.js non caricato",
      { fallbackDefaults },
      { scope: "bootstrap", persistWhenDisabled: true }
    );

    buildSettings = (scriptEl) => {
      const cfg = {
        endpoint:
          getAttribute(scriptEl, "data-endpoint") || fallbackDefaults.endpoint,
        timeoutMs: parseInteger(
          getAttribute(scriptEl, "data-timeout"),
          fallbackDefaults.timeoutMs
        ),
        cacheTtlSec: parseInteger(
          getAttribute(scriptEl, "data-cache-ttl"),
          fallbackDefaults.cacheTtlSec
        ),
        mode: parseMode(getAttribute(scriptEl, "data-mode")),
        removeNode: parseBoolean(
          getAttribute(scriptEl, "data-remove-node"),
          fallbackDefaults.removeNode
        ),
        showCopyButton: parseBoolean(
          getAttribute(scriptEl, "data-show-copy-button"),
          fallbackDefaults.showCopyButton
        ),
        hoverFeedback: parseHoverFeedback(
          getAttribute(scriptEl, "data-hover-feedback"),
          fallbackDefaults.hoverFeedback
        ),
        rel: [...fallbackDefaults.rel],
        newTab: fallbackDefaults.newTab,
        zIndex: fallbackDefaults.zIndex,
        maxConcurrent: fallbackDefaults.maxConcurrent,
        warnHighlightClass:
          getAttribute(scriptEl, "data-warn-highlight-class") ||
          fallbackDefaults.warnHighlightClass,
        warnMessageDefault:
          getAttribute(scriptEl, "data-warn-message") ||
          fallbackDefaults.warnMessageDefault,
        excludeSelectors: parseList(
          getAttribute(scriptEl, "data-exclude-selectors") || ""
        ),
        configVersion:
          getAttribute(scriptEl, "data-config-version") ||
          fallbackDefaults.configVersion,
        trackingEnabled: parseBoolean(
          getAttribute(scriptEl, "data-tracking-enabled"),
          fallbackDefaults.trackingEnabled
        ),
        trackingParameter:
          getAttribute(scriptEl, "data-tracking-parameter") ||
          fallbackDefaults.trackingParameter,
        trackingPixelEndpoint:
          getAttribute(scriptEl, "data-tracking-pixel-endpoint") ||
          fallbackDefaults.trackingPixelEndpoint,
        trackingIncludeMetadata: parseBoolean(
          getAttribute(scriptEl, "data-tracking-include-metadata"),
          fallbackDefaults.trackingIncludeMetadata
        ),
        keepWarnMessageOnAllow: parseBoolean(
          getAttribute(scriptEl, "data-keep-warn-on-allow"),
          fallbackDefaults.keepWarnMessageOnAllow
        ),
        debugMode: parseBoolean(
          getAttribute(scriptEl, "data-debug-mode"),
          fallbackDefaults.debugMode
        ),
        debugLevel: parseDebugLevel(
          getAttribute(scriptEl, "data-debug-level"),
          fallbackDefaults.debugLevel
        )
      };

      if (!VALID_MODES.has(cfg.mode)) cfg.mode = "strict";
      if (cfg.hoverFeedback !== "tooltip") cfg.hoverFeedback = "title";
      if (!cfg.warnMessageDefault) {
        cfg.warnMessageDefault = fallbackDefaults.warnMessageDefault;
      }
      cfg.keepWarnMessageOnAllow = Boolean(cfg.keepWarnMessageOnAllow);
      cfg.trackingEnabled = Boolean(cfg.trackingEnabled);
      cfg.debugMode = Boolean(cfg.debugMode);
      cfg.debugLevel = parseDebugLevel(String(cfg.debugLevel || ""));
      return cfg;
    };

    if (!guardNamespace.defaults) {
      guardNamespace.defaults = Object.freeze({
        ...fallbackDefaults,
        rel: [...fallbackDefaults.rel]
      });
    }
    if (!guardNamespace.utils) {
      guardNamespace.utils = {
        parseBoolean,
        parseInteger,
        parseList,
        parseMode,
        parseHoverFeedback,
        parseDebugLevel
      };
    }

    if (
      !guardNamespace.utils ||
      typeof guardNamespace.utils.computeSettingsFingerprint !== "function"
    ) {
      guardNamespace.utils = {
        ...(guardNamespace.utils || {}),
        computeSettingsFingerprint: fallbackComputeFingerprint
      };
    }

    computeSettingsFingerprint = fallbackComputeFingerprint;
  }

  const cfg = buildSettings(thisScript);
  if (!Array.isArray(cfg.rel)) cfg.rel = ["noopener", "noreferrer", "nofollow"];
  if (!Array.isArray(cfg.excludeSelectors)) cfg.excludeSelectors = [];
  if (!VALID_MODES.has(cfg.mode)) cfg.mode = "strict";
  if (cfg.hoverFeedback !== "tooltip") cfg.hoverFeedback = "title";

  const configFingerprint =
    typeof computeSettingsFingerprint === "function"
      ? computeSettingsFingerprint(cfg)
      : JSON.stringify(cfg);

  const summarizeConfigForDebug = (config, fingerprint) => ({
    mode: config.mode,
    endpoint: config.endpoint,
    timeoutMs: config.timeoutMs,
    cacheTtlSec: config.cacheTtlSec,
    maxConcurrent: config.maxConcurrent,
    ui: {
      hoverFeedback: config.hoverFeedback,
      showCopyButton: config.showCopyButton,
      warnHighlightClass: config.warnHighlightClass,
      keepWarnMessageOnAllow: Boolean(config.keepWarnMessageOnAllow)
    },
    tracking: {
      enabled: Boolean(config.trackingEnabled),
      parameter: config.trackingParameter,
      pixelEndpoint: config.trackingPixelEndpoint,
      includeMetadata: Boolean(config.trackingIncludeMetadata),
      samplingRate: Number.isFinite(config.trackingSamplingRate)
        ? config.trackingSamplingRate
        : 1,
      allowlist: Array.isArray(config.trackingAllowlist)
        ? config.trackingAllowlist.length
        : 0,
      blocklist: Array.isArray(config.trackingBlocklist)
        ? config.trackingBlocklist.length
        : 0,
      respectDnt: config.trackingRespectDnt !== false,
      matrixPreset:
        config.trackingCaptureMatrix &&
        typeof config.trackingCaptureMatrix === "object" &&
        config.trackingCaptureMatrix.activePreset
          ? config.trackingCaptureMatrix.activePreset
          : "standard"
    },
    cache: {
      ttl: config.cacheTtlSec,
      fingerprint: fingerprint || null
    }
  });

  const collectRuntimeLanguageSnapshot = () => {
    const snapshot = {
      preferred: null,
      alternatives: [],
      documentLang:
        typeof document !== "undefined" &&
        document?.documentElement?.lang
          ? document.documentElement.lang
          : null,
      sources: []
    };

    if (
      guardNamespace.i18n &&
      typeof guardNamespace.i18n.collectLanguageContext === "function"
    ) {
      try {
        const context = guardNamespace.i18n.collectLanguageContext();
        if (context?.language) {
          snapshot.preferred = context.language;
        }
        if (Array.isArray(context?.languages)) {
          snapshot.alternatives = context.languages;
        }
        if (Array.isArray(context?.sources)) {
          snapshot.sources = context.sources;
        }
      } catch (errCollectContext) {
        debug.warn(
          "Errore durante la raccolta del contesto lingua",
          serializeError(errCollectContext),
          { scope: "i18n" }
        );
      }
    }

    if (typeof navigator !== "undefined" && navigator) {
      if (!snapshot.preferred) {
        const languages = Array.isArray(navigator.languages)
          ? navigator.languages.filter(Boolean)
          : [];
        if (languages.length) {
          snapshot.preferred = languages[0];
          snapshot.alternatives = languages;
        } else if (navigator.language) {
          snapshot.preferred = navigator.language;
          if (!snapshot.alternatives.length) {
            snapshot.alternatives = [navigator.language];
          }
        }
      }
    }

    if (!snapshot.preferred && snapshot.documentLang) {
      snapshot.preferred = snapshot.documentLang;
    }

    if (cfg.debugMode && cfg.debugLevel === "verbose") {
      debug.verbose(
        "Contesto linguistico calcolato",
        snapshot,
        { scope: "i18n" }
      );
    }

    return snapshot;
  };

  const configSource = usingLegacySettings ? "legacy" : "module";

  debug.configure({
    enabled: Boolean(cfg.debugMode),
    level: cfg.debugLevel,
    context: {
      configVersion: cfg.configVersion,
      source: configSource,
      endpoint: cfg.endpoint
    }
  });

  // Memorizza l'istantanea della lingua per riutilizzarla in altri punti del
  // modulo (tracking, report policy, esportazione JSON, ecc.). In questo modo
  // i log e gli export condividono sempre gli stessi dati di detection.
  runtimeLanguageSnapshot = collectRuntimeLanguageSnapshot();

  if (cfg.debugMode) {
    debug.info(
      "Configurazione attiva",
      summarizeConfigForDebug(cfg, configFingerprint),
      { scope: "config" }
    );
    debug.verbose(
      "Configurazione completa",
      cfg,
      { scope: "config" }
    );
    debug.info(
      "Lingua preferita rilevata",
      runtimeLanguageSnapshot,
      { scope: "i18n" }
    );
  }

  const toURL = (href) => {
    try {
      return new URL(href, location.href);
    } catch (err) {
      return null;
    }
  };

  const TRACKING_IGNORED_PROTOCOLS = /^(mailto:|tel:|javascript:)/i;

  const detectDeviceType = (userAgent) => {
    if (typeof userAgent !== "string" || !userAgent.trim()) {
      return "unknown";
    }
    const ua = userAgent.toLowerCase();
    if (/(smart[-\s]?tv|hbbtv|appletv|googletv|tizen|webos)/.test(ua)) {
      return "tv";
    }
    if (
      /(ipad|tablet|android(?!.*mobile)|kindle|silk|playbook|touch)/.test(ua)
    ) {
      return "tablet";
    }
    if (
      /(mobile|iphone|ipod|blackberry|phone|opera mini|windows phone|android.*mobile)/.test(
        ua
      )
    ) {
      return "mobile";
    }
    return "desktop";
  };

  const generateTrackingId = () => {
    if (typeof crypto !== "undefined" && crypto) {
      if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
      if (typeof crypto.getRandomValues === "function") {
        const buffer = new Uint8Array(16);
        crypto.getRandomValues(buffer);
        const toHex = (num) => num.toString(16).padStart(2, "0");
        return (
          toHex(buffer[0]) +
          toHex(buffer[1]) +
          toHex(buffer[2]) +
          toHex(buffer[3]) +
          "-" +
          toHex(buffer[4]) +
          toHex(buffer[5]) +
          "-" +
          toHex(buffer[6]) +
          toHex(buffer[7]) +
          "-" +
          toHex(buffer[8]) +
          toHex(buffer[9]) +
          "-" +
          toHex(buffer[10]) +
          toHex(buffer[11]) +
          toHex(buffer[12]) +
          toHex(buffer[13]) +
          toHex(buffer[14]) +
          toHex(buffer[15])
        );
      }
    }
    return (
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  };

  const ensureTrackingParameter = (
    href,
    parameterName,
    generator,
    options = {}
  ) => {
    if (!href || !parameterName) {
      return null;
    }

    const trimmedName = String(parameterName).trim();
    if (!trimmedName) {
      return null;
    }

    if (TRACKING_IGNORED_PROTOCOLS.test(href)) {
      return null;
    }

    const urlObj = toURL(href);
    if (!urlObj) {
      return null;
    }

    const forceNew = Boolean(options && options.forceNew);
    let trackingId = forceNew ? null : urlObj.searchParams.get(trimmedName);

    if (!trackingId) {
      trackingId =
        typeof generator === "function"
          ? generator(urlObj.searchParams.get(trimmedName))
          : "";
      if (!trackingId) {
        return null;
      }
      urlObj.searchParams.set(trimmedName, trackingId);
    } else if (forceNew) {
      const regenerated =
        typeof generator === "function"
          ? generator(urlObj.searchParams.get(trimmedName))
          : "";
      if (regenerated) {
        trackingId = regenerated;
        urlObj.searchParams.set(trimmedName, trackingId);
      }
    }

    return {
      href: urlObj.href,
      url: urlObj,
      trackingId
    };
  };

  const externalTrackingDefaults =
    guardNamespace.tracking && guardNamespace.tracking.defaults
      ? guardNamespace.tracking.defaults
      : null;

  if (
    !trackingRuntime ||
    typeof trackingRuntime.init !== "function" ||
    typeof trackingRuntime.isEnabled !== "function"
  ) {
    trackingRuntime = createMyclidTrackingRuntime({
      toURL,
      detectDeviceType,
      generateTrackingId,
      ensureTrackingParameter,
      getDocument: () => (typeof document !== "undefined" ? document : null),
      getWindow: () => (typeof window !== "undefined" ? window : null),
      getLocation: () =>
        typeof window !== "undefined" && window
          ? window.location || null
          : null,
      getNavigator: () => (typeof navigator !== "undefined" ? navigator : null),
      getLanguageSnapshot: () => runtimeLanguageSnapshot,
      debug,
      getCrypto: () => (typeof crypto !== "undefined" ? crypto : null)
    });
  }

  const sanitizeList = (value) =>
    Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];

  const initialTrackingSettings = {
    enabled: Boolean(cfg.trackingEnabled),
    paramName: cfg.trackingParameter,
    endpoint: cfg.trackingPixelEndpoint,
    includeMetadata: Boolean(cfg.trackingIncludeMetadata),
    samplingRate: Number.isFinite(cfg.trackingSamplingRate)
      ? Math.min(Math.max(cfg.trackingSamplingRate, 0), 1)
      : 1,
    allowlist: sanitizeList(cfg.trackingAllowlist),
    blocklist: sanitizeList(cfg.trackingBlocklist),
    respectDnt: cfg.trackingRespectDnt !== false,
    captureMatrix:
      (cfg.trackingCaptureMatrix &&
        typeof cfg.trackingCaptureMatrix === "object" &&
        cfg.trackingCaptureMatrix) ||
      (externalTrackingDefaults && externalTrackingDefaults.captureMatrix) ||
      undefined,
    timeoutMs: Number.isFinite(cfg.trackingTimeoutMs)
      ? cfg.trackingTimeoutMs
      : undefined,
    retry: cfg.trackingRetry || undefined,
    hmac: cfg.trackingHmac || undefined,
    user: {
      ipHash: cfg.trackingUserIpHash || null
    },
    request: {
      campaignKeys: sanitizeList(cfg.trackingCampaignKeys || []),
      utmKeys: sanitizeList(cfg.trackingUtmKeys || [])
    }
  };

  const syncLegacyTrackingConfig = (settings) => {
    if (!settings) return;
    cfg.trackingEnabled = Boolean(settings.enabled);
    cfg.trackingParameter = settings.paramName;
    cfg.trackingPixelEndpoint = settings.endpoint;
    cfg.trackingIncludeMetadata = Boolean(settings.includeMetadata);
    if (Number.isFinite(settings.samplingRate)) {
      cfg.trackingSamplingRate = Math.min(
        Math.max(settings.samplingRate, 0),
        1
      );
    }
    cfg.trackingAllowlist = sanitizeList(settings.allowlist);
    cfg.trackingBlocklist = sanitizeList(settings.blocklist);
    cfg.trackingRespectDnt = settings.respectDnt !== false;
    cfg.trackingCaptureMatrix = null;
    if (settings.captureMatrix && typeof settings.captureMatrix === "object") {
      try {
        cfg.trackingCaptureMatrix = JSON.parse(
          JSON.stringify(settings.captureMatrix)
        );
      } catch (err) {
        cfg.trackingCaptureMatrix = settings.captureMatrix;
      }
    }
    if (Number.isFinite(settings.timeoutMs)) {
      cfg.trackingTimeoutMs = Math.max(0, settings.timeoutMs);
    }
    if (settings.retry && typeof settings.retry === "object") {
      cfg.trackingRetry = { ...settings.retry };
    }
    if (settings.hmac && typeof settings.hmac === "object") {
      cfg.trackingHmac = { ...settings.hmac };
    }
    if (settings.user && typeof settings.user === "object") {
      cfg.trackingUserIpHash =
        typeof settings.user.ipHash === "string" ? settings.user.ipHash : null;
    }
    if (settings.request && typeof settings.request === "object") {
      cfg.trackingCampaignKeys = sanitizeList(settings.request.campaignKeys);
      cfg.trackingUtmKeys = sanitizeList(settings.request.utmKeys);
    }
  };

  if (trackingRuntime) {
    trackingRuntime.onChange((settings) => {
      syncLegacyTrackingConfig(settings);
    });

    trackingRuntime.init(initialTrackingSettings);
    syncLegacyTrackingConfig(trackingRuntime.getSettings());

    const existingTrackingApi = guardNamespace.tracking || {};
    guardNamespace.tracking = {
      ...existingTrackingApi,
      init(settings) {
        return trackingRuntime.init(settings);
      },
      enable() {
        return trackingRuntime.enable();
      },
      disable() {
        return trackingRuntime.disable();
      },
      setMatrix(matrix) {
        return trackingRuntime.setMatrix(matrix);
      },
      getSettings() {
        return trackingRuntime.getSettings();
      },
      recordInteraction(payload) {
        return trackingRuntime.recordInteraction(payload);
      },
      runtime: trackingRuntime,
      defaults: {
        captureMatrix: trackingRuntime.getSettings().captureMatrix
      }
    };
  }

  // Espone l'utility anche sul namespace globale per consentire test e riuso.
  if (!guardNamespace.utils) guardNamespace.utils = {};
  if (
    typeof guardNamespace.utils.computeScrollLockPadding !== "function" &&
    typeof computeScrollLockPadding === "function"
  ) {
    guardNamespace.utils.computeScrollLockPadding = computeScrollLockPadding;
  }
  if (typeof configFingerprint !== "undefined") {
    guardNamespace.activeConfigSignature = configFingerprint;
  }
  guardNamespace.activeConfigVersion = cfg.configVersion;

  // Rileva ambienti con restrizioni (Reader mode, AMP) per attivare fallback UI automatici.
  const detectLimitedExecutionContext = () => {
    const hasDocument = typeof document !== "undefined" && document;
    const docEl = hasDocument ? document.documentElement : null;
    const body = hasDocument ? document.body : null;

    const checkClassList = (element, classNames) => {
      if (!element || !element.classList) {
        return false;
      }
      for (let i = 0; i < classNames.length; i += 1) {
        if (element.classList.contains(classNames[i])) {
          return true;
        }
      }
      return false;
    };

    const checkAttributes = (element, attributes) => {
      if (!element || typeof element.getAttribute !== "function") {
        return false;
      }
      for (let i = 0; i < attributes.length; i += 1) {
        const value = element.getAttribute(attributes[i]);
        if (value && value !== "false" && value !== "0") {
          return true;
        }
      }
      return false;
    };

    const readerClasses = [
      "reader-mode",
      "reader",
      "is-reader-mode",
      "reader-view",
      "reading-mode",
      "moz-reader-view",
      "apple-reader",
      "apple-reader-mode",
      "safari-reader"
    ];
    const readerAttributes = [
      "data-reader-mode",
      "data-reader",
      "data-reading-mode"
    ];
    let isReaderMode =
      checkClassList(docEl, readerClasses) ||
      checkClassList(body, readerClasses) ||
      checkAttributes(docEl, readerAttributes) ||
      checkAttributes(body, readerAttributes);

    if (!isReaderMode) {
      const bodyId = body && typeof body.id === "string" ? body.id : "";
      if (bodyId) {
        const normalized = bodyId.toLowerCase();
        if (
          normalized.includes("reader") ||
          normalized.startsWith("readability")
        ) {
          isReaderMode = true;
        }
      }
    }

    const ampClasses = ["amp-mode", "amp-document", "amp-html"];
    const isAmpByAttr =
      (docEl &&
        (docEl.hasAttribute("amp") ||
          docEl.hasAttribute("⚡") ||
          docEl.hasAttribute("amp-version"))) ||
      checkClassList(docEl, ampClasses);
    const ampRuntime =
      typeof window !== "undefined" &&
      (window.AMP || window.__AMP_MODE || window.AMP_MODE);
    const isAmpDocument = Boolean(isAmpByAttr || ampRuntime);

    return {
      isReaderMode,
      isAmpDocument
    };
  };

  const limitedContextInfo = detectLimitedExecutionContext();
  if (
    !cfg.keepWarnMessageOnAllow &&
    (limitedContextInfo.isReaderMode || limitedContextInfo.isAmpDocument)
  ) {
    cfg.keepWarnMessageOnAllow = true;
  }

  const keepWarnMessageOnAllow = Boolean(cfg.keepWarnMessageOnAllow);

  const hoverFeedbackFactory =
    typeof createHoverFeedback === "function"
      ? createHoverFeedback
      : () => ({
          useTooltip: cfg.hoverFeedback === "tooltip",
          setMessage() {},
          clearMessage() {}
        });
  const hoverFeedback = hoverFeedbackFactory(cfg);
  const useTooltip = hoverFeedback.useTooltip;
  const setHoverMessage = hoverFeedback.setMessage;
  const clearHoverMessage = hoverFeedback.clearMessage;

  const policyCacheFactory =
    typeof createPolicyCache === "function"
      ? createPolicyCache
      : () => ({
          get() {
            return null;
          },
          set() {},
          purge() {},
          stats() {
            return {};
          }
        });
  const cacheFingerprint =
    typeof configFingerprint !== "undefined" ? configFingerprint : null;
  const policyCache = policyCacheFactory(cfg, cacheFingerprint);

  // Gestisce la navigazione effettiva verso un URL rispettando la configurazione
  // `newTab`. L'apertura preferisce una nuova scheda quando richiesto e torna
  // al navigatore corrente se il browser blocca `window.open`.
function createMyclidTrackingRuntime(deps) {
  const {
    toURL,
    detectDeviceType,
    generateTrackingId,
    ensureTrackingParameter,
    getDocument,
    getWindow,
    getLocation,
    getNavigator,
    getLanguageSnapshot,
    debug,
    getCrypto,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout
  } = deps || {};

  const deepClone = (value) => {
    if (Array.isArray(value)) {
      return value.map((entry) => deepClone(entry));
    }
    if (value && typeof value === 'object') {
      const clone = {};
      for (const key of Object.keys(value)) {
        clone[key] = deepClone(value[key]);
      }
      return clone;
    }
    return value;
  };

  const deepMerge = (target, source) => {
    if (!source || typeof source !== 'object') {
      return target;
    }
    const output = Array.isArray(target) ? [...target] : { ...target };
    for (const key of Object.keys(source)) {
      const value = source[key];
      if (Array.isArray(value)) {
        output[key] = value.slice();
        continue;
      }
      if (value && typeof value === 'object') {
        output[key] = deepMerge(
          output[key] && typeof output[key] === 'object' ? output[key] : {},
          value
        );
        continue;
      }
      output[key] = value;
    }
    return output;
  };

  const normalizeList = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
  };

  const DEFAULT_PRESETS = {
    minimal: {
      link: { href: true, host: true, path: false, query: false, hash: false, text: false },
      page: { url: true, referrer: false, title: false },
      user: { language: true, timezone: false, device: false, viewport: false, ipHash: false },
      request: { source: true, campaign: false, utm: true, consent: true, dnt: true }
    },
    standard: {
      link: { href: true, host: true, path: true, query: true, hash: true, text: false },
      page: { url: true, referrer: true, title: true },
      user: { language: true, timezone: true, device: true, viewport: true, ipHash: false },
      request: { source: true, campaign: true, utm: true, consent: true, dnt: true }
    },
    extended: {
      link: { href: true, host: true, path: true, query: true, hash: true, text: true },
      page: { url: true, referrer: true, title: true },
      user: { language: true, timezone: true, device: true, viewport: true, ipHash: true },
      request: { source: true, campaign: true, utm: true, consent: true, dnt: true }
    }
  };

  const DEFAULT_SETTINGS = {
    enabled: false,
    paramName: 'myclid',
    endpoint: '',
    includeMetadata: true,
    samplingRate: 1,
    allowlist: [],
    blocklist: [],
    respectDnt: true,
    captureMatrix: {
      activePreset: 'standard',
      presets: deepClone(DEFAULT_PRESETS),
      overrides: { domains: {}, pages: {} }
    },
    timeoutMs: 2500,
    retry: { attempts: 1, backoffFactor: 2, delayMs: 150 },
    hmac: {
      enabled: false,
      algorithm: 'SHA-256',
      secret: '',
      header: 'X-Myclid-Signature',
      format: 'base64',
      signer: null
    },
    user: { ipHash: null, ipResolver: null },
    request: {
      campaignKeys: ['campaign', 'cid', 'pk_campaign', 'mc_cid'],
      utmKeys: [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content'
      ],
      sourceResolver: null
    },
    consentResolver: null
  };

  const matrixPresets = () => deepClone(DEFAULT_PRESETS);

  const matchDomain = (host, pattern) => {
    if (!pattern || !host) return false;
    const normalizedHost = host.toLowerCase();
    const normalizedPattern = pattern.toLowerCase();
    if (normalizedPattern.startsWith('*.')) {
      const suffix = normalizedPattern.slice(1); // conserva il punto iniziale
      return (
        normalizedHost === normalizedPattern.slice(2) ||
        normalizedHost.endsWith(suffix)
      );
    }
    return normalizedHost === normalizedPattern;
  };

  const findBestDomainOverride = (host, overrides) => {
    if (!host || !overrides) return null;
    const entries = Object.entries(overrides);
    let match = null;
    let matchLength = 0;
    entries.forEach(([pattern, config]) => {
      if (!pattern) return;
      if (matchDomain(host, pattern)) {
        if (pattern.length > matchLength) {
          match = config;
          matchLength = pattern.length;
        }
      }
    });
    return match;
  };

  const matchPathPattern = (pathname, pattern) => {
    if (!pattern) return false;
    if (!pathname) pathname = '/';
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return pathname.startsWith(prefix);
    }
    return pathname === pattern;
  };

  const findPageOverride = (pathname, overrides) => {
    if (!overrides) return null;
    let match = null;
    let matchLength = 0;
    Object.entries(overrides).forEach(([pattern, config]) => {
      if (!pattern) return;
      if (matchPathPattern(pathname, pattern)) {
        if (pattern.length > matchLength) {
          match = config;
          matchLength = pattern.length;
        }
      }
    });
    return match;
  };

  const mergeMatrix = (base, override) => {
    if (!override) return base;
    const result = deepClone(base);
    for (const section of Object.keys(override)) {
      const sectionOverride = override[section];
      if (!sectionOverride || typeof sectionOverride !== 'object') continue;
      if (!result[section] || typeof result[section] !== 'object') {
        result[section] = {};
      }
      for (const field of Object.keys(sectionOverride)) {
        result[section][field] = Boolean(sectionOverride[field]);
      }
    }
    return result;
  };

  const normalizeMatrixConfig = (captureMatrix = {}) => {
    const normalized = {
      activePreset: captureMatrix.activePreset || 'standard',
      presets: deepClone(DEFAULT_PRESETS),
      overrides: { domains: {}, pages: {} }
    };

    if (captureMatrix.presets && typeof captureMatrix.presets === 'object') {
      normalized.presets = deepMerge(normalized.presets, captureMatrix.presets);
    }
    if (captureMatrix.overrides && typeof captureMatrix.overrides === 'object') {
      const { domains, pages } = captureMatrix.overrides;
      if (domains && typeof domains === 'object') {
        normalized.overrides.domains = deepMerge({}, domains);
      }
      if (pages && typeof pages === 'object') {
        normalized.overrides.pages = deepMerge({}, pages);
      }
    }
    return normalized;
  };

  const normalizeSettings = (overrides = {}) => {
    const settings = deepClone(DEFAULT_SETTINGS);
    const source = overrides && typeof overrides === 'object' ? overrides : {};

    if (typeof source.paramName === 'string') {
      settings.paramName = source.paramName.trim() || settings.paramName;
    }
    if (typeof source.endpoint === 'string') {
      settings.endpoint = source.endpoint.trim();
    }
    if (typeof source.includeMetadata === 'boolean') {
      settings.includeMetadata = source.includeMetadata;
    }
    if (typeof source.enabled === 'boolean') {
      settings.enabled = source.enabled;
    }
    if (typeof source.respectDnt === 'boolean') {
      settings.respectDnt = source.respectDnt;
    }
    const sampling = parseFloat(source.samplingRate);
    if (!Number.isNaN(sampling)) {
      settings.samplingRate = Math.min(Math.max(sampling, 0), 1);
    }
    if (source.allowlist) {
      settings.allowlist = normalizeList(source.allowlist);
    }
    if (source.blocklist) {
      settings.blocklist = normalizeList(source.blocklist);
    }
    if (source.captureMatrix) {
      settings.captureMatrix = normalizeMatrixConfig(source.captureMatrix);
    }
    if (source.timeoutMs && Number.isFinite(source.timeoutMs)) {
      settings.timeoutMs = Math.max(0, source.timeoutMs);
    }
    if (source.retry && typeof source.retry === 'object') {
      const retry = deepMerge(settings.retry, source.retry);
      retry.attempts = Math.max(0, parseInt(retry.attempts, 10) || 0);
      retry.backoffFactor = Math.max(1, Number(retry.backoffFactor) || 1);
      retry.delayMs = Math.max(0, Number(retry.delayMs) || 0);
      settings.retry = retry;
    }
    if (source.hmac && typeof source.hmac === 'object') {
      const hmac = deepMerge(settings.hmac, source.hmac);
      hmac.enabled = Boolean(hmac.enabled);
      if (typeof hmac.header === 'string') {
        hmac.header = hmac.header.trim() || settings.hmac.header;
      }
      if (typeof hmac.secret === 'string') {
        hmac.secret = hmac.secret;
      }
      if (typeof hmac.algorithm === 'string') {
        hmac.algorithm = hmac.algorithm.trim().toUpperCase() || 'SHA-256';
      }
      if (typeof hmac.format === 'string') {
        const format = hmac.format.toLowerCase();
        hmac.format = format === 'hex' ? 'hex' : 'base64';
      }
      if (typeof hmac.signer === 'function') {
        hmac.signer = hmac.signer;
      } else {
        hmac.signer = null;
      }
      settings.hmac = hmac;
    }
    if (source.user && typeof source.user === 'object') {
      const user = deepMerge(settings.user, source.user);
      user.ipHash = typeof user.ipHash === 'string' ? user.ipHash : null;
      user.ipResolver = typeof user.ipResolver === 'function' ? user.ipResolver : null;
      settings.user = user;
    }
    if (source.request && typeof source.request === 'object') {
      const requestCfg = deepMerge(settings.request, source.request);
      requestCfg.campaignKeys = normalizeList(requestCfg.campaignKeys);
      requestCfg.utmKeys = normalizeList(requestCfg.utmKeys);
      if (!requestCfg.utmKeys.length) {
        requestCfg.utmKeys = normalizeList(settings.request.utmKeys);
      }
      requestCfg.sourceResolver =
        typeof requestCfg.sourceResolver === 'function'
          ? requestCfg.sourceResolver
          : null;
      settings.request = requestCfg;
    }
    if (typeof source.consentResolver === 'function') {
      settings.consentResolver = source.consentResolver;
    }
    return settings;
  };

  const state = {
    settings: normalizeSettings(),
    enabled: false,
    secureEndpoint: false,
    hasEndpoint: false,
    consentGranted: true,
    dntOptOut: false,
    listeners: new Set()
  };

  const isDoNotTrackEnabled = () => {
    if (!state.settings.respectDnt) {
      return false;
    }
    const nav = typeof getNavigator === 'function' ? getNavigator() : null;
    const dnt =
      (nav && (nav.doNotTrack || nav.msDoNotTrack)) ||
      (typeof window !== 'undefined' && window.doNotTrack);
    if (typeof dnt === 'string') {
      const normalized = dnt.toLowerCase();
      return normalized === '1' || normalized === 'yes';
    }
    return false;
  };

  const evaluateConsent = () => {
    if (typeof state.settings.consentResolver === 'function') {
      try {
        const result = state.settings.consentResolver();
        if (result === false) {
          return false;
        }
      } catch (err) {
        if (debug && typeof debug.error === 'function') {
          debug.error('Errore nel resolver di consenso', err, { scope: 'tracking' });
        }
      }
    }
    return true;
  };

  const recomputeFlags = () => {
    state.dntOptOut = isDoNotTrackEnabled();
    state.consentGranted = evaluateConsent();
    state.hasEndpoint = Boolean(state.settings.endpoint);
    state.secureEndpoint = state.hasEndpoint
      ? /^https:\/\//i.test(state.settings.endpoint)
      : false;
    state.enabled = Boolean(state.settings.enabled) && state.consentGranted && !state.dntOptOut;
  };

  recomputeFlags();

  const notifyChange = () => {
    if (!state.listeners.size) return;
    const snapshot = runtime.getSettings();
    state.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        if (debug && typeof debug.error === 'function') {
          debug.error('Listener tracking runtime fallito', err, { scope: 'tracking' });
        }
      }
    });
  };

  const shouldTrackHost = (host) => {
    if (!host) return true;
    const normalized = host.toLowerCase();
    if (state.settings.blocklist.length) {
      const blocked = state.settings.blocklist.some((pattern) => matchDomain(normalized, pattern));
      if (blocked) {
        return false;
      }
    }
    if (state.settings.allowlist.length) {
      return state.settings.allowlist.some((pattern) => matchDomain(normalized, pattern));
    }
    return true;
  };

  const resolveMatrixForUrl = (urlObj) => {
    const matrixCfg = state.settings.captureMatrix || normalizeMatrixConfig();
    const presets = matrixCfg.presets && typeof matrixCfg.presets === 'object'
      ? matrixCfg.presets
      : matrixPresets();
    const fallbackPreset = presets.standard || DEFAULT_PRESETS.standard;
    const defaultPresetName = matrixCfg.activePreset && presets[matrixCfg.activePreset]
      ? matrixCfg.activePreset
      : 'standard';
    let activeMatrix = deepClone(presets[defaultPresetName] || fallbackPreset);
    let presetUsed = defaultPresetName;
    const overridesApplied = [];

    const domainOverrides = matrixCfg.overrides?.domains || {};
    const pageOverrides = matrixCfg.overrides?.pages || {};

    const host = urlObj?.host || '';
    const pathname = urlObj?.pathname || '';

    const domainOverride = findBestDomainOverride(host, domainOverrides);
    if (domainOverride) {
      if (domainOverride.preset && presets[domainOverride.preset]) {
        activeMatrix = deepClone(presets[domainOverride.preset]);
        presetUsed = domainOverride.preset;
      }
      if (domainOverride.matrix) {
        activeMatrix = mergeMatrix(activeMatrix, domainOverride.matrix);
      }
      overridesApplied.push({ type: 'domain', pattern: host });
    }

    const pageOverride = findPageOverride(pathname, pageOverrides);
    if (pageOverride) {
      if (pageOverride.preset && presets[pageOverride.preset]) {
        activeMatrix = deepClone(presets[pageOverride.preset]);
        presetUsed = pageOverride.preset;
      }
      if (pageOverride.matrix) {
        activeMatrix = mergeMatrix(activeMatrix, pageOverride.matrix);
      }
      overridesApplied.push({ type: 'page', pattern: pathname });
    }

    return { matrix: activeMatrix, preset: presetUsed, overridesApplied };
  };

  const applyMatrix = (matrix, context) => {
    const result = {};
    if (!matrix || !context) {
      return result;
    }
    Object.keys(matrix).forEach((section) => {
      const fields = matrix[section];
      const data = context[section];
      if (!fields || typeof fields !== 'object' || !data) {
        return;
      }
      const filtered = {};
      Object.keys(fields).forEach((field) => {
        if (!fields[field]) return;
        const value = data[field];
        if (value === undefined || value === null) {
          return;
        }
        if (typeof value === 'string') {
          filtered[field] = value;
        } else if (typeof value === 'object') {
          if (Array.isArray(value)) {
            if (value.length) {
              filtered[field] = value.slice();
            }
          } else if (Object.keys(value).length) {
            filtered[field] = deepClone(value);
          }
        } else {
          filtered[field] = value;
        }
      });
      if (Object.keys(filtered).length) {
        result[section] = filtered;
      }
    });
    return result;
  };

  const sampleEvent = () => {
    const rate = Number(state.settings.samplingRate) || 0;
    if (rate <= 0) return false;
    if (rate >= 1) return true;
    return Math.random() < rate;
  };

  const resolveCampaignParams = (urlObj) => {
    const params = {};
    if (!urlObj || !urlObj.searchParams) {
      return params;
    }
    const keys = state.settings.request.campaignKeys;
    keys.forEach((key) => {
      if (!key) return;
      if (urlObj.searchParams.has(key)) {
        params[key] = urlObj.searchParams.get(key);
      }
    });
    return params;
  };

  const resolveUtmParams = (urlObj) => {
    const params = {};
    if (!urlObj || !urlObj.searchParams) {
      return params;
    }
    urlObj.searchParams.forEach((value, key) => {
      if (key && key.toLowerCase().startsWith('utm_')) {
        params[key] = value;
      }
    });
    const keys = state.settings.request.utmKeys;
    keys.forEach((key) => {
      if (!key) return;
      if (urlObj.searchParams.has(key)) {
        params[key] = urlObj.searchParams.get(key);
      }
    });
    return params;
  };

  const resolveSource = (options) => {
    if (options && options.sourceOverride) {
      return options.sourceOverride;
    }
    if (typeof state.settings.request.sourceResolver === 'function') {
      try {
        const resolved = state.settings.request.sourceResolver(options);
        if (resolved) return resolved;
      } catch (err) {
        if (debug && typeof debug.warn === 'function') {
          debug.warn('Source resolver error', err, { scope: 'tracking' });
        }
      }
    }
    if (options && options.event && options.event.type) {
      return String(options.event.type);
    }
    return 'click';
  };

  const resolveViewport = () => {
    const win = typeof getWindow === 'function' ? getWindow() : null;
    if (!win) {
      return null;
    }
    if (typeof win.innerWidth === 'number' && typeof win.innerHeight === 'number') {
      return { width: win.innerWidth, height: win.innerHeight };
    }
    const doc = typeof getDocument === 'function' ? getDocument() : null;
    const docEl = doc && doc.documentElement;
    if (docEl && typeof docEl.clientWidth === 'number') {
      return { width: docEl.clientWidth, height: docEl.clientHeight };
    }
    return null;
  };

  const resolveIpHash = async () => {
    if (state.settings.user.ipHash) {
      return state.settings.user.ipHash;
    }
    if (typeof state.settings.user.ipResolver === 'function') {
      try {
        const value = await state.settings.user.ipResolver();
        if (typeof value === 'string' && value) {
          return value;
        }
      } catch (err) {
        if (debug && typeof debug.warn === 'function') {
          debug.warn('Impossibile risolvere IP hash', err, { scope: 'tracking' });
        }
      }
    }
    return null;
  };

  const buildContext = async (options = {}) => {
    const trackingContext = options.trackingContext;
    if (!trackingContext || !trackingContext.href) {
      return null;
    }
    const urlObj = trackingContext.url || toURL(trackingContext.href);
    if (!urlObj) {
      return null;
    }
    if (!shouldTrackHost(urlObj.host)) {
      return null;
    }
    const locationObj = typeof getLocation === 'function' ? getLocation() : null;
    const documentObj = typeof getDocument === 'function' ? getDocument() : null;
    const navigatorObj = typeof getNavigator === 'function' ? getNavigator() : null;
    const languageSnapshot = typeof getLanguageSnapshot === 'function'
      ? getLanguageSnapshot()
      : null;

    const matrixInfo = resolveMatrixForUrl(urlObj);

    const languages = [];
    if (languageSnapshot && Array.isArray(languageSnapshot.alternatives)) {
      languages.push(...languageSnapshot.alternatives);
    }
    if (
      navigatorObj &&
      Array.isArray(navigatorObj.languages) &&
      navigatorObj.languages.length
    ) {
      navigatorObj.languages.forEach((lang) => {
        if (languages.indexOf(lang) === -1) {
          languages.push(lang);
        }
      });
    }

    const preferredLanguage =
      (languageSnapshot && languageSnapshot.preferred) ||
      (navigatorObj && navigatorObj.language) ||
      (languages.length ? languages[0] : null);

    const viewport = resolveViewport();
    const consent = state.consentGranted;
    const dntEnabled = state.dntOptOut;

    const requestSource = resolveSource(options);
    const campaignParams = resolveCampaignParams(urlObj);
    const utmParams = resolveUtmParams(urlObj);

    const ipHash = await resolveIpHash();

    const context = {
      timestamp: new Date().toISOString(),
      trackingId: trackingContext.trackingId,
      parameterName: state.settings.paramName,
      destination: trackingContext.href,
      original: trackingContext.originalHref || trackingContext.href,
      link: {
        href: urlObj.href,
        host: urlObj.host,
        path: urlObj.pathname,
        query: urlObj.search ? urlObj.search.slice(1) : '',
        hash: urlObj.hash ? urlObj.hash.slice(1) : '',
        text:
          options.anchor && typeof options.anchor.textContent === 'string'
            ? options.anchor.textContent.trim()
            : null,
        rel: options.anchor && typeof options.anchor.rel === 'string'
          ? options.anchor.rel
          : null
      },
      page: {
        url: locationObj && locationObj.href ? locationObj.href : null,
        referrer: documentObj && typeof documentObj.referrer === 'string'
          ? documentObj.referrer
          : '',
        title: documentObj && typeof documentObj.title === 'string'
          ? documentObj.title
          : null
      },
      user: {
        language: preferredLanguage,
        languages,
        timeZone: (() => {
          try {
            return Intl && typeof Intl.DateTimeFormat === 'function'
              ? new Intl.DateTimeFormat().resolvedOptions().timeZone
              : null;
          } catch (err) {
            return null;
          }
        })(),
        deviceType:
          navigatorObj && navigatorObj.userAgent
            ? detectDeviceType(navigatorObj.userAgent)
            : 'unknown',
        viewport,
        ipHash
      },
      request: {
        source: requestSource,
        campaign: campaignParams,
        utm: utmParams,
        consent,
        dnt: dntEnabled,
        sampled: Boolean(options.sampled),
        samplingRate: state.settings.samplingRate
      },
      matrix: matrixInfo.matrix,
      matrixPreset: matrixInfo.preset,
      matrixOverrides: matrixInfo.overridesApplied
    };

    return context;
  };

  const signPayload = async (serializedPayload) => {
    const { hmac } = state.settings;
    if (!hmac || !hmac.enabled) {
      return null;
    }
    if (typeof hmac.signer === 'function') {
      try {
        return await hmac.signer(serializedPayload);
      } catch (err) {
        if (debug && typeof debug.warn === 'function') {
          debug.warn('Firma HMAC personalizzata fallita', err, { scope: 'tracking' });
        }
      }
      return null;
    }
    const crypto = typeof getCrypto === 'function' ? getCrypto() : null;
    if (!crypto || !crypto.subtle || typeof crypto.subtle.importKey !== 'function') {
      return null;
    }
    try {
      const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
      if (!enc) return null;
      const keyData = enc.encode(hmac.secret || '');
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: { name: hmac.algorithm || 'SHA-256' } },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        enc.encode(serializedPayload)
      );
      const bytes = Array.from(new Uint8Array(signatureBuffer));
      if (hmac.format === 'hex') {
        return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
      }
      if (typeof btoa === 'function') {
        const binary = bytes.map((b) => String.fromCharCode(b)).join('');
        return btoa(binary);
      }
      return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
      if (debug && typeof debug.warn === 'function') {
        debug.warn('Firma HMAC fallita', err, { scope: 'tracking' });
      }
      return null;
    }
  };

  const dispatchPayload = async (payload, options = {}) => {
    if (!state.enabled || !state.hasEndpoint || !payload) {
      return false;
    }
    const endpoint = state.settings.endpoint;
    if (!state.secureEndpoint) {
      if (debug && typeof debug.warn === 'function') {
        debug.warn('Endpoint non sicuro, payload non inviato', { endpoint }, {
          scope: 'tracking'
        });
      }
      return false;
    }
    let baseSerialized;
    try {
      baseSerialized = JSON.stringify(payload);
    } catch (err) {
      if (debug && typeof debug.error === 'function') {
        debug.error('Serializzazione payload fallita', err, { scope: 'tracking' });
      }
      return false;
    }
    if (!baseSerialized) {
      return false;
    }
    const signature = await signPayload(baseSerialized);
    let finalPayload = payload;
    let serialized = baseSerialized;
    if (signature) {
      finalPayload = { ...payload, signature };
      try {
        serialized = JSON.stringify(finalPayload);
      } catch (err) {
        serialized = baseSerialized;
      }
    }

    if (debug && typeof debug.event === 'function') {
      const details = state.settings.captureMatrix && options.verbose
        ? { endpoint, payload: finalPayload }
        : {
            endpoint,
            clid: finalPayload.clid || finalPayload.trackingId,
            destination: finalPayload.link?.href || finalPayload.destination
          };
      debug.event('Invio tracking pixel', details, { scope: 'tracking' });
    }

    const nav = typeof getNavigator === 'function' ? getNavigator() : null;
    if (nav && typeof nav.sendBeacon === 'function') {
      try {
        const blob = new Blob([serialized], { type: 'application/json' });
        if (nav.sendBeacon(endpoint, blob)) {
          return true;
        }
      } catch (err) {
        // fallback fetch
      }
    }

    const attemptFetch = async () => {
      if (typeof fetch !== 'function') {
        throw new Error('fetch unavailable');
      }
      const headers = { 'Content-Type': 'application/json' };
      if (signature && state.settings.hmac.header) {
        headers[state.settings.hmac.header] = signature;
      }
      const controller = state.settings.timeoutMs
        ? new AbortController()
        : null;
      let timeoutId = null;
      if (controller && state.settings.timeoutMs > 0) {
        timeoutId = setTimeoutFn(() => {
          controller.abort();
        }, state.settings.timeoutMs);
      }
      try {
        await fetch(endpoint, {
          method: 'POST',
          headers,
          body: serialized,
          keepalive: true,
          credentials: 'omit',
          mode: 'cors',
          signal: controller ? controller.signal : undefined
        });
        return true;
      } finally {
        if (timeoutId) {
          clearTimeoutFn(timeoutId);
        }
      }
    };

    const { attempts, backoffFactor, delayMs } = state.settings.retry;
    let attempt = 0;
    let currentDelay = Math.max(0, delayMs);
    while (attempt <= attempts) {
      try {
        const success = await attemptFetch();
        if (success) {
          return true;
        }
      } catch (err) {
        if (attempt >= attempts) {
          break;
        }
      }
      if (currentDelay > 0) {
        await new Promise((resolve) => setTimeoutFn(resolve, currentDelay));
        currentDelay *= backoffFactor;
      }
      attempt += 1;
    }

    try {
      const pixel = new Image();
      pixel.src = `${endpoint}?data=${encodeURIComponent(serialized)}`;
      return true;
    } catch (err) {
      return false;
    }
  };

  const runtime = {
    init(overrides = {}) {
      state.settings = normalizeSettings({ ...state.settings, ...overrides });
      recomputeFlags();
      notifyChange();
      return runtime.getSettings();
    },
    enable() {
      state.settings.enabled = true;
      recomputeFlags();
      notifyChange();
      return state.enabled;
    },
    disable() {
      state.settings.enabled = false;
      recomputeFlags();
      notifyChange();
      return state.enabled;
    },
    setMatrix(matrixConfig) {
      if (!matrixConfig) return runtime.getSettings();
      if (typeof matrixConfig === 'string') {
        state.settings.captureMatrix.activePreset = matrixConfig;
      } else if (typeof matrixConfig === 'object') {
        if (matrixConfig.activePreset) {
          state.settings.captureMatrix.activePreset = matrixConfig.activePreset;
        }
        if (matrixConfig.presets) {
          state.settings.captureMatrix.presets = deepMerge(
            state.settings.captureMatrix.presets,
            matrixConfig.presets
          );
        }
        if (matrixConfig.overrides) {
          state.settings.captureMatrix.overrides = deepMerge(
            state.settings.captureMatrix.overrides,
            matrixConfig.overrides
          );
        }
        if (matrixConfig.matrix) {
          const currentPreset =
            state.settings.captureMatrix.presets[
              state.settings.captureMatrix.activePreset
            ] || DEFAULT_PRESETS.standard;
          state.settings.captureMatrix.presets[
            state.settings.captureMatrix.activePreset
          ] = mergeMatrix(currentPreset, matrixConfig.matrix);
        }
      }
      notifyChange();
      return runtime.getSettings();
    },
    isEnabled() {
      return state.enabled;
    },
    getSettings() {
      return deepClone(state.settings);
    },
    getParameterName() {
      return state.settings.paramName || 'myclid';
    },
    prepareNavigation(input, options = {}) {
      if (!state.enabled) {
        return null;
      }
      const href =
        typeof input === 'string'
          ? input
          : input && typeof input.href === 'string'
          ? input.href
          : null;
      if (!href) {
        return null;
      }
      const parameter = runtime.getParameterName();
      const forceNew = Boolean(options.forceNewId);
      const ensureResult = ensureTrackingParameter(
        href,
        parameter,
        () => generateTrackingId(),
        { forceNew }
      );
      if (!ensureResult) {
        return null;
      }
      const urlObj = ensureResult.url;
      if (!shouldTrackHost(urlObj.host)) {
        return null;
      }
      return {
        href: ensureResult.href,
        url: urlObj,
        trackingId: ensureResult.trackingId,
        originalHref:
          (options.existingContext && options.existingContext.originalHref) || href,
        parameterName: parameter,
        generatedAt: new Date().toISOString()
      };
    },
    async collectContext(options = {}) {
      return buildContext(options);
    },
    buildPayload(context) {
      if (!context) return null;
      const matrix = context.matrix || resolveMatrixForUrl(toURL(context.destination));
      const filteredSections = applyMatrix(matrix.matrix || matrix, context);
      const payload = {
        clid: context.trackingId,
        trackingId: context.trackingId,
        parameterName: context.parameterName,
        ts: context.timestamp,
        preset: context.matrixPreset || null,
        link: filteredSections.link || {},
        page: filteredSections.page || {},
        user: filteredSections.user || {},
        request: filteredSections.request || {},
        destination: context.destination,
        originalDestination: context.original
      };
      if (context.matrixOverrides && context.matrixOverrides.length) {
        payload.matrixOverrides = context.matrixOverrides.map((item) => ({ ...item }));
      }
      return payload;
    },
    async dispatch(payload, options = {}) {
      return dispatchPayload(payload, options);
    },
    async recordInteraction(options = {}) {
      if (!state.enabled) {
        return null;
      }
      const sampled = sampleEvent();
      const trackingContext = options.trackingContext;
      if (!trackingContext) {
        return null;
      }
      const context = await buildContext({
        ...options,
        trackingContext,
        sampled
      });
      if (!context) {
        return null;
      }
      const payload = runtime.buildPayload(context);
      if (!payload) {
        return null;
      }
      payload.request.sampled = sampled;
      if (sampled) {
        runtime.dispatch(payload, options).catch(() => {});
      }
      return payload;
    },
    onChange(listener) {
      if (typeof listener === 'function') {
        state.listeners.add(listener);
        return () => state.listeners.delete(listener);
      }
      return () => {};
    }
  };

  return runtime;
}


  const buildTrackingPayload = ({
    trackingId,
    parameterName,
    destination,
    original,
    metadata
  } = {}) => {
    const safeMetadata = metadata && typeof metadata === "object" ? metadata : {};
    const resolvedParameter =
      parameterName ||
      (trackingRuntime
        ? trackingRuntime.getParameterName()
        : cfg.trackingParameter || "myclid");
    const payload = {
      clid: trackingId || "",
      trackingId: trackingId || "",
      parameterName: resolvedParameter,
      destination: destination || "",
      originalDestination: original || destination || "",
      ts: safeMetadata.timestamp || safeMetadata.ts || new Date().toISOString(),
      link: safeMetadata.link ? { ...safeMetadata.link } : {},
      page: safeMetadata.page ? { ...safeMetadata.page } : {},
      user: safeMetadata.user ? { ...safeMetadata.user } : {},
      request: safeMetadata.request ? { ...safeMetadata.request } : {}
    };
    if (safeMetadata.matrixOverrides && safeMetadata.matrixOverrides.length) {
      payload.matrixOverrides = safeMetadata.matrixOverrides.map((item) => ({
        ...item
      }));
    }
    if (safeMetadata.preset) {
      payload.preset = safeMetadata.preset;
    }
    return payload;
  };

  const resolveTrackingRuntime = () => {
    if (trackingRuntime && typeof trackingRuntime.isEnabled === "function") {
      return trackingRuntime;
    }
    const namespaceRuntime =
      guardNamespace &&
      guardNamespace.tracking &&
      guardNamespace.tracking.runtime;
    if (
      namespaceRuntime &&
      typeof namespaceRuntime.isEnabled === "function"
    ) {
      return namespaceRuntime;
    }
    return null;
  };

  const prepareTrackedNavigation = (urlLike, options = {}) => {
    const activeRuntime = resolveTrackingRuntime();
    if (!activeRuntime || !activeRuntime.isEnabled()) {
      return null;
    }

    const prepared = activeRuntime.prepareNavigation(urlLike, {
      forceNewId: Boolean(options.forceNewId),
      existingContext: options.existingContext || null
    });

    if (prepared && cfg.debugMode) {
      const detail = {
        parameter: prepared.parameterName,
        trackingId: prepared.trackingId,
        destination: prepared.href,
        original: prepared.originalHref
      };
      const level = cfg.debugLevel === "verbose" ? "verbose" : "basic";
      debug.event("Parametro di tracking applicato", detail, {
        scope: "tracking",
        level
      });
    }

    return prepared;
  };

  /**
   * Applica il parametro di tracking all'ancora fornita sincronizzando lo stato locale.
   * Quando il parametro è già presente mantiene il valore esistente evitando duplicazioni.
   * @param {HTMLAnchorElement|{href?: string, setAttribute?: Function}} anchor
   * @param {{ url?: URL, trackingId?: string }|null} state
   * @returns {{ href: string, trackingId: string, url: URL, parameterName: string }|null}
   */
  const applyTrackingParameterToAnchor = (
    anchor,
    state = null,
    context = null
  ) => {
    const activeRuntime = resolveTrackingRuntime();
    if (!activeRuntime || !activeRuntime.isEnabled() || !anchor) {
      return null;
    }

    const baseSource =
      state && state.url && typeof state.url.href === "string"
        ? state.url
        : anchor;

    const trackingContext =
      context && context.href
        ? context
        : prepareTrackedNavigation(baseSource, {
            forceNewId: false,
            existingContext: state || null
          });
    if (!trackingContext || !trackingContext.href) {
      return null;
    }

    try {
      anchor.href = trackingContext.href;
    } catch (errSetHref) {
      if (typeof anchor.setAttribute === "function") {
        try {
          anchor.setAttribute("href", trackingContext.href);
        } catch (errSetAttr) {
          return null;
        }
      } else {
        return null;
      }
    }

    if (state && typeof state === "object") {
      state.url = trackingContext.url;
      state.trackingId = trackingContext.trackingId;
      state.parameterName = trackingContext.parameterName;
      if (trackingContext.originalHref) {
        state.originalHref = trackingContext.originalHref;
      }
      if (trackingContext.generatedAt) {
        state.trackingGeneratedAt = trackingContext.generatedAt;
      }
    }

    return trackingContext;
  };

  const dispatchTrackingPixel = (payload, options = {}) => {
    if (!trackingRuntime || !payload) {
      return;
    }
    try {
      const dispatchResult = trackingRuntime.dispatch(payload, options);
      if (dispatchResult && typeof dispatchResult.then === "function") {
        dispatchResult.catch(() => {});
      }
    } catch (errDispatch) {
      if (cfg.debugMode) {
        debug.warn("Invio tracking pixel fallito", serializeError(errDispatch), {
          scope: "tracking"
        });
      }
    }
  };

  if (!guardNamespace.utils) {
    guardNamespace.utils = {};
  }
  if (
    typeof guardNamespace.utils.buildTrackingPayload !== "function"
  ) {
    guardNamespace.utils.buildTrackingPayload = buildTrackingPayload;
  }
  if (typeof guardNamespace.utils.detectDeviceType !== "function") {
    guardNamespace.utils.detectDeviceType = detectDeviceType;
  }
  if (typeof guardNamespace.utils.ensureTrackingParameter !== "function") {
    guardNamespace.utils.ensureTrackingParameter = ensureTrackingParameter;
  }
  if (
    typeof guardNamespace.utils.applyTrackingParameterToAnchor !== "function"
  ) {
    guardNamespace.utils.applyTrackingParameterToAnchor =
      applyTrackingParameterToAnchor;
  }

  const followExternalUrl = (urlLike, options = {}) => {
    const anchor = options.element || null;
    let trackingContext = options.trackingContext || null;
    const event = options.event || null;
    const sourceOverride = options.source || null;
    let href =
      typeof urlLike === "string"
        ? urlLike
        : typeof urlLike?.href === "string"
        ? urlLike.href
        : null;

    if (trackingRuntime && trackingRuntime.isEnabled()) {
      if (!trackingContext || !trackingContext.href) {
        const existingState = anchor ? anchorStates.get(anchor) || null : null;
        trackingContext = prepareTrackedNavigation(urlLike, {
          forceNewId: true,
          existingContext: existingState
        });
      }

      if (trackingContext?.href) {
        href = trackingContext.href;

        if (anchor) {
          const updatedContext = applyTrackingParameterToAnchor(
            anchor,
            anchorStates.get(anchor) || null,
            trackingContext
          );
          if (updatedContext?.href) {
            trackingContext = updatedContext;
            href = updatedContext.href;
          }
        }

        try {
          const maybePromise = trackingRuntime.recordInteraction({
            anchor,
            trackingContext,
            event,
            sourceOverride
          });
          if (maybePromise && typeof maybePromise.catch === "function") {
            maybePromise.catch(() => {});
          }
        } catch (errRecord) {
          if (cfg.debugMode) {
            debug.warn(
              "Registrazione tracking fallita",
              serializeError(errRecord),
              { scope: "tracking" }
            );
          }
        }
      }
    }

    if (!href) return;

    if (cfg.newTab) {
      try {
        const openedWindow = window.open(href, "_blank");
        if (openedWindow) {
          try {
            openedWindow.opener = null;
          } catch (errAssignOpener) {
            // Alcuni browser potrebbero impedire l'accesso a opener: ignora l'errore.
          }
          return;
        }
      } catch (err) {
        // Se il browser blocca la nuova finestra passiamo al fallback nello stesso tab.
      }
    }

    try {
      window.location.assign(href);
    } catch (err) {
      try {
        window.location.href = href;
      } catch (err2) {
        debug.error(
          "Impossibile aprire l'URL",
          { href, error: serializeError(err2) },
          { scope: "navigation" }
        );
      }
    }
  };

  function createHoverFeedback(config) {
    const tooltipEnabled = config.hoverFeedback === "tooltip";
    if (!tooltipEnabled) {
      return {
        useTooltip: false,
        setMessage(node, message) {
          if (!node) return;
          if (!message) {
            node.removeAttribute("title");
            return;
          }
          node.setAttribute("title", message);
        },
        clearMessage(node, expectedMessage = null, force = false) {
          if (!node) return;
          if (force) {
            node.removeAttribute("title");
            return;
          }
          const titleAttr = node.getAttribute("title");
          if (!expectedMessage || titleAttr === expectedMessage) {
            node.removeAttribute("title");
          }
        }
      };
    }

    const tooltipHandlers = new WeakMap();
    let tooltipEl = null;
    let tooltipVisibleFor = null;

    const ensureTooltipEl = () => {
      if (tooltipEl) return tooltipEl;
      tooltipEl = document.createElement("div");
      tooltipEl.id = "slg-tooltip";
      tooltipEl.className = "slg-tooltip slg--hidden";
      document.body.appendChild(tooltipEl);
      return tooltipEl;
    };

    const positionTooltip = (node) => {
      if (!tooltipEl || tooltipVisibleFor !== node) return;
      if (!node.isConnected) {
        hideTooltip();
        return;
      }
      const rect = node.getBoundingClientRect();
      const tipRect = tooltipEl.getBoundingClientRect();
      let top = window.scrollY + rect.top - tipRect.height - 10;
      if (top < window.scrollY + 4) {
        top = window.scrollY + rect.bottom + 10;
      }
      let left = window.scrollX + rect.left + (rect.width - tipRect.width) / 2;
      const minLeft = window.scrollX + 4;
      if (left < minLeft) left = minLeft;
      const maxLeft =
        window.scrollX + document.documentElement.clientWidth - tipRect.width - 4;
      if (left > maxLeft) left = maxLeft;
      tooltipEl.style.top = `${Math.round(top)}px`;
      tooltipEl.style.left = `${Math.round(left)}px`;
      tooltipEl.style.visibility = "visible";
    };

    const hideTooltip = () => {
      if (!tooltipEl) return;
      tooltipEl.classList.add("slg--hidden");
      tooltipEl.style.visibility = "hidden";
      tooltipVisibleFor = null;
    };

    const showTooltipForNode = (node) => {
      if (!node) return;
      const message = node.getAttribute("data-slg-message");
      if (!message) return;
      const tip = ensureTooltipEl();
      tip.textContent = message;
      tip.style.visibility = "hidden";
      tip.classList.remove("slg--hidden");
      tooltipVisibleFor = node;
      requestAnimationFrame(() => positionTooltip(node));
    };

    const detachHandlers = (node) => {
      const handlers = tooltipHandlers.get(node);
      if (!handlers) return;
      node.removeEventListener("mouseenter", handlers.onEnter);
      node.removeEventListener("mouseleave", handlers.onLeave);
      node.removeEventListener("focus", handlers.onFocus);
      node.removeEventListener("blur", handlers.onBlur);
      node.removeEventListener("mousemove", handlers.onMove);
      tooltipHandlers.delete(node);
    };

    const bindTooltip = (node) => {
      if (!node || tooltipHandlers.has(node)) return;
      const onEnter = () => showTooltipForNode(node);
      const onLeave = () => {
        if (tooltipVisibleFor === node) hideTooltip();
      };
      const onFocus = onEnter;
      const onBlur = onLeave;
      const onMove = () => positionTooltip(node);
      node.addEventListener("mouseenter", onEnter);
      node.addEventListener("mouseleave", onLeave);
      node.addEventListener("focus", onFocus);
      node.addEventListener("blur", onBlur);
      node.addEventListener("mousemove", onMove);
      tooltipHandlers.set(node, { onEnter, onLeave, onFocus, onBlur, onMove });
    };

    const setMessage = (node, message) => {
      if (!node) return;
      if (!message) {
        clearMessage(node, null, true);
        return;
      }
      node.setAttribute("data-slg-message", message);
      bindTooltip(node);
      if (tooltipVisibleFor === node) {
        showTooltipForNode(node);
      }
    };

    const clearMessage = (node, expectedMessage = null, force = false) => {
      if (!node) return;
      const attr = node.getAttribute("data-slg-message");
      if (!attr && !tooltipHandlers.has(node)) return;
      if (force || !expectedMessage || attr === expectedMessage) {
        detachHandlers(node);
        node.removeAttribute("data-slg-message");
        if (tooltipVisibleFor === node) hideTooltip();
      }
    };

    window.addEventListener(
      "scroll",
      () => {
        if (tooltipVisibleFor) hideTooltip();
      },
      true
    );
    window.addEventListener("resize", () => {
      if (!tooltipVisibleFor) return;
      requestAnimationFrame(() => {
        if (tooltipVisibleFor) positionTooltip(tooltipVisibleFor);
      });
    });

    return {
      useTooltip: true,
      setMessage,
      clearMessage,
      hideAll: hideTooltip,
      detach: detachHandlers
    };
  }

  function hashFingerprint(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  function createPolicyCache(config, fingerprint) {
    const storageKeySuffix = fingerprint ? hashFingerprint(fingerprint) : "default";
    const storageKey = `SLG_POLICY_CACHE_V3::${storageKeySuffix}`;
    const store = new Map();

    const nowSec = () => Math.floor(Date.now() / 1000);

    const load = () => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        Object.entries(parsed || {}).forEach(([host, entry]) => {
          if (entry && typeof entry === "object") {
            store.set(host, entry);
          }
        });
        if (cfg.debugMode && store.size) {
          debug.verbose(
            "Cache policy ripristinata",
            { size: store.size },
            { scope: "cache" }
          );
        }
      } catch (e) {
        debug.warn(
          "Lettura cache non disponibile",
          serializeError(e) || String(e),
          { scope: "cache" }
        );
      }
    };

    const persist = () => {
      try {
        if (!store.size) {
          sessionStorage.removeItem(storageKey);
          return;
        }
        const obj = {};
        store.forEach((value, key) => {
          obj[key] = value;
        });
        sessionStorage.setItem(storageKey, JSON.stringify(obj));
      } catch (e) {
        debug.warn(
          "Scrittura cache non disponibile",
          serializeError(e) || String(e),
          { scope: "cache" }
        );
      }
    };

    return {
      load,
      get(host) {
        const entry = store.get(host);
        if (!entry) return null;
        const ttl = Number.isFinite(entry.ttl) ? entry.ttl : config.cacheTtlSec;
        if (entry.ts + ttl < nowSec()) {
          store.delete(host);
          if (cfg.debugMode) {
            debug.verbose(
              "Cache policy scaduta",
              { host, ttl, expiredAt: entry.ts + ttl },
              { scope: "cache", level: "verbose" }
            );
          }
          return null;
        }
        const normalizedMessage = normalizeMessageDescriptor(entry.message);
        if (normalizedMessage !== entry.message) {
          entry.message = normalizedMessage;
          store.set(host, entry);
          persist();
        }
        return entry;
      },
      set(host, action, ttl, message) {
        const descriptor = normalizeMessageDescriptor(message);
        store.set(host, {
          action,
          ttl: Number.isFinite(ttl) ? ttl : config.cacheTtlSec,
          ts: nowSec(),
          message: descriptor
        });
        persist();
        if (cfg.debugMode) {
          debug.event(
            "Policy memorizzata in cache",
            {
              host,
              action,
              ttl: Number.isFinite(ttl) ? ttl : config.cacheTtlSec
            },
            {
              scope: "cache",
              level: cfg.debugLevel === "verbose" ? "verbose" : "basic"
            }
          );
        }
      },
      clear() {
        store.clear();
        persist();
        if (cfg.debugMode) {
          debug.event(
            "Cache policy svuotata",
            null,
            { scope: "cache", level: "basic" }
          );
        }
      }
    };
  }

  // ===== Stato endpoint =====
  let endpointHealthy = false;

  // ===== CSS =====
  const injectStyles = () => {
    if (document.getElementById("slg-styles")) return;
    const style = document.createElement("style");
    style.id = "slg-styles";
    style.textContent = `
      .slg--hidden{display:none!important}
      .slg-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:saturate(120%) blur(1px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .24s ease}
      .slg-overlay.slg--visible{opacity:1;visibility:visible;pointer-events:auto}
      .slg-wrap{position:fixed;inset:0;display:grid;grid-template-columns:10px 1fr 10px;grid-template-rows:minmax(10px,1fr) auto minmax(10px,1fr);overflow:auto}
      .slg-dialog{grid-column:2;grid-row:2;max-width:640px;width:100%;margin-inline:auto;background:#fff;color:#111;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.25);outline:none;display:flex;flex-direction:column;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;opacity:0;transform:translateY(8px);transition:opacity .24s ease,transform .24s ease}
      .slg-overlay.slg--visible .slg-dialog{opacity:1;transform:none}
      @media (prefers-reduced-motion:reduce){.slg-overlay{transition:none}.slg-dialog{transform:none;transition:none}}
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
      .slg-tooltip{position:absolute;z-index:1000000;padding:6px 10px;border-radius:8px;background:rgba(17,24,39,.95);color:#f9fafb;font-size:13px;line-height:1.4;box-shadow:0 10px 30px rgba(15,23,42,.35);pointer-events:none;max-width:260px}
    `;
    document.head.appendChild(style);
  };

  // ===== Utility =====
  const ORIGIN_HOST = location.host.toLowerCase();
  const isHttpLike = (href) => /^(https?:)?\/\//i.test(href);
  const isExternal = (url) => url && url.host.toLowerCase() !== ORIGIN_HOST;

  const ensureAttrs = (a) => {
    if (cfg.newTab) {
      a.setAttribute("target", "_blank");
    } else {
      a.removeAttribute("target");
    }
    const cur = (a.getAttribute("rel") || "").split(/\s+/).filter(Boolean);
    const merged = Array.from(new Set([...cur, ...cfg.rel]));
    a.setAttribute("rel", merged.join(" "));
    a.dataset.safeLinkGuard = "1";
  };

  // Indice host → Set<nodo>
  const anchorsByHost = new Map();
  // Stato per ancoraggio → metadati (URL normalizzato, host) usato per i listener delegati
  const anchorStates = new WeakMap();

  const mapAdd = (host, node) => {
    let set = anchorsByHost.get(host);
    if (!set) { set = new Set(); anchorsByHost.set(host, set); }
    set.add(node);
  };
  const mapReplaceNode = (host, oldNode, newNode, overrideState) => {
    let set = anchorsByHost.get(host);

    const previousState = overrideState
      ? { ...overrideState }
      : anchorStates.get(oldNode)
      ? { ...anchorStates.get(oldNode) }
      : null;

    if (!set && previousState?.host) {
      set = anchorsByHost.get(previousState.host) || null;
    }

    if (set) {
      set.delete(oldNode);
    }

    if (anchorStates.has(oldNode)) {
      anchorStates.delete(oldNode);
    }

    if (newNode) {
      if (set) {
        set.add(newNode);
      }
      if (previousState) {
        anchorStates.set(newNode, previousState);
      }
    }
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
          debug.error(
            "Selettore non valido in data-exclude-selectors",
            { selector: sel, error: serializeError(e) },
            { scope: "bootstrap", tags: ["fallback"] }
          );
        }
      }
    }
    return false;
  };

  const disableLink = (a, reason = null, hostForIndex = null, policyMeta = null) => {
    const normalizedReason = normalizeMessageDescriptor(reason);
    const message =
      translateMessageDescriptor(normalizedReason || reason, defaultDenyMessage) ||
      defaultDenyMessage;
    const previousState = anchorStates.get(a) || null;
    const originalHref = (() => {
      try {
        if (typeof a.getAttribute === "function") {
          const attr = a.getAttribute("href");
          if (attr) {
            return attr;
          }
        }
      } catch (err) {
        // Alcuni ambienti potrebbero lanciare eccezioni sugli accessor: ignoriamo e passiamo oltre.
      }
      if (a && typeof a.href === "string" && a.href) {
        return a.href;
      }
      if (previousState?.url?.href) {
        return previousState.url.href;
      }
      return null;
    })();
    const resolveUrlFromHref = (href) => {
      if (!href) {
        return previousState?.url || null;
      }
      const parsed = toURL(href);
      return parsed || previousState?.url || null;
    };
    const normalizedHost = hostForIndex || previousState?.host || null;
    const nextState = (() => {
      if (!previousState && !normalizedHost && !originalHref) {
        return null;
      }
      const state = previousState ? { ...previousState } : {};
      if (normalizedHost && !state.host) {
        state.host = normalizedHost;
      }
      const resolvedUrl = resolveUrlFromHref(originalHref);
      if (resolvedUrl) {
        state.url = resolvedUrl;
      }
      state.originalHref = originalHref || state.originalHref || null;
      state.disabledAt = Date.now();
      state.removed = Boolean(cfg.removeNode);
      state.policy = {
        ...(previousState?.policy || {}),
        action: "deny",
        reason: message,
        source:
          policyMeta && typeof policyMeta.source === "string"
            ? policyMeta.source
            : previousState?.policy?.source || null
      };
      if (policyMeta && Number.isFinite(policyMeta.ttl)) {
        state.policy.ttl = policyMeta.ttl;
      } else if (state.policy.ttl && !Number.isFinite(state.policy.ttl)) {
        delete state.policy.ttl;
      }
      if (policyMeta && Number.isFinite(policyMeta.cacheAgeSec)) {
        state.policy.cacheAgeSec = policyMeta.cacheAgeSec;
      }
      if (policyMeta && Number.isFinite(policyMeta.cachedAt)) {
        state.policy.cachedAt = policyMeta.cachedAt;
      }
      const descriptorFromMeta = policyMeta?.message
        ? sanitizeDetails(policyMeta.message)
        : null;
      if (descriptorFromMeta) {
        state.policy.messageDescriptor = descriptorFromMeta;
      } else if (normalizedReason) {
        state.policy.messageDescriptor = sanitizeDetails(normalizedReason);
      }
      return state;
    })();

    clearHoverMessage(a, null, true);
    if (cfg.removeNode) {
      const span = document.createElement("span");
      span.innerHTML = a.innerHTML;
      const cls = (a.className || "").trim();
      span.className = cls ? `${cls} slg-disabled` : "slg-disabled";
      span.setAttribute("aria-disabled", "true");
      span.dataset.safeLinkGuard = "1";
      if (nextState) {
        nextState.replacementTag = "span";
      }
      setHoverMessage(span, message);
      const parent = a.parentNode;
      const hostKey = normalizedHost;
      if (parent) {
        parent.replaceChild(span, a);
      }
      mapReplaceNode(hostKey, a, span, nextState || undefined);
      return span;
    }

    a.removeAttribute("href");
    a.setAttribute("role", "link");
    a.setAttribute("aria-disabled", "true");
    a.classList.add("slg-disabled");
    setHoverMessage(a, message);
    a.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      { capture: true }
    );
    a.dataset.safeLinkGuard = "1";
    if (nextState) {
      nextState.replacementTag = a.tagName ? a.tagName.toLowerCase() : "a";
      anchorStates.set(a, nextState);
    } else if (anchorStates.has(a)) {
      anchorStates.delete(a);
    }
    return a;
  };

  // ===== Endpoint =====
  const fetchWithTimeout = (url, opts = {}, timeoutMs = 800) => {
    // Estrae un eventuale segnale esterno per propagare l'abort.
    const { signal: externalSignal, ...requestOpts } = opts || {};
    const ctrl = new AbortController();

    let timedOut = false;
    let externalListenerAttached = false;

    const timerId =
      typeof timeoutMs === "number" && timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            const timeoutError = new Error(`Timeout dopo ${timeoutMs} ms`);
            timeoutError.name = "TimeoutError";
            try {
              ctrl.abort(timeoutError);
            } catch (err) {
              ctrl.abort();
            }
          }, timeoutMs)
        : null;

    const abortFromExternal = () => {
      try {
        ctrl.abort(externalSignal.reason);
      } catch (err) {
        ctrl.abort();
      }
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        abortFromExternal();
      } else {
        externalSignal.addEventListener("abort", abortFromExternal, { once: true });
        externalListenerAttached = true;
      }
    }

    return fetch(url, { ...requestOpts, signal: ctrl.signal })
      .catch((error) => {
        if (error?.name === "AbortError") {
          const reason = ctrl.signal.reason;
          if (timedOut) {
            if (reason instanceof Error) throw reason;
            const timeoutError = new Error(`Timeout dopo ${timeoutMs} ms`);
            timeoutError.name = "TimeoutError";
            throw timeoutError;
          }
          if (reason instanceof Error) throw reason;
          if (reason !== undefined) {
            const reasonError = new Error(String(reason));
            reasonError.name = "AbortError";
            throw reasonError;
          }
        }
        throw error;
      })
      .finally(() => {
        if (timerId) clearTimeout(timerId);
        if (externalListenerAttached) {
          externalSignal.removeEventListener("abort", abortFromExternal);
        }
      });
  };

  async function checkEndpointHealth() {
    if (!cfg.endpoint) {
      debug.error(
        "Endpoint non impostato",
        { endpoint: cfg.endpoint },
        { scope: "network", tags: ["configuration"] }
      );
      endpointHealthy = false;
      return false;
    }
    const url = cfg.endpoint + (cfg.endpoint.includes("?") ? "&" : "?") + "health=1";
    try {
      const res = await fetchWithTimeout(
        url,
        { method: "GET", cache: "no-store", credentials: "same-origin" },
        cfg.timeoutMs
      );
      if (!res.ok) {
        debug.error(
          "Endpoint non raggiungibile",
          { url, status: res.status },
          { scope: "network", tags: ["fallback"] }
        );
        endpointHealthy = false;
        return false;
      }
      endpointHealthy = true;
      return true;
    } catch (e) {
      if (e?.name === "TimeoutError") {
        debug.warn(
          "Timeout durante il controllo di salute",
          { url, timeoutMs: cfg.timeoutMs },
          { scope: "network", tags: ["fallback"] }
        );
      } else {
        debug.error(
          "Errore di rete verso l'endpoint",
          { url, error: serializeError(e) },
          { scope: "network" }
        );
      }
      endpointHealthy = false;
      return false;
    }
  }

  const normalizeAction = (val) => {
    const a = String(val || "").toLowerCase().trim();
    return a === "allow" || a === "warn" || a === "deny" ? a : "warn";
  };

  async function getPolicy(host) {
    if (!endpointHealthy) {
      debug.warn(
        "Endpoint non disponibile, uso fallback 'warn'",
        { host },
        { scope: "policy", tags: ["fallback"] }
      );
      const fallback = "warn";
      const ttl = Math.min(300, cfg.cacheTtlSec);
      const descriptor = { key: "messages.endpointUnavailable" };
      policyCache.set(host, fallback, ttl, descriptor);
      return {
        action: fallback,
        source: "endpoint-fallback",
        ttl,
        message: descriptor
      };
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
      const message = extractMessageDescriptorFromResponse(json);
      policyCache.set(host, action, ttl, message);
      return {
        action,
        source: "network",
        ttl,
        message,
        response: cfg.debugLevel === "verbose" ? json : undefined
      };
    } catch (e) {
      const isTimeout = e?.name === "TimeoutError";
      if (isTimeout) {
        debug.warn(
          "Timeout policy",
          { host, timeoutMs: cfg.timeoutMs },
          { scope: "policy", tags: ["fallback"] }
        );
      } else {
        debug.error(
          "Errore durante il recupero della policy",
          { host, error: serializeError(e) },
          { scope: "policy" }
        );
      }
      const fallback = "warn";
      const ttl = Math.min(300, cfg.cacheTtlSec);
      const descriptor = isTimeout
        ? { key: "messages.timeout" }
        : { key: "messages.error" };
      policyCache.set(host, fallback, ttl, descriptor);
      return {
        action: fallback,
        source: isTimeout ? "timeout" : "network-error",
        ttl,
        message: descriptor,
        error: serializeError(e) || String(e)
      };
    }
  }

  // ===== Coda policy =====
  const queue = [];
  const inFlight = new Set();
  let running = 0;

  const applyPolicyToHost = (host, action, meta = {}) => {
    const set = anchorsByHost.get(host);
    if (!set) return;
    const cached = policyCache.get(host);
    const messageDescriptor = cached ? cached.message : meta.message || null;
    const warnFallback = cfg.warnMessageDefault || defaultWarnMessage;
    const warnMessage =
      translateMessageDescriptor(messageDescriptor, warnFallback) || warnFallback;
    const denyReason =
      translateMessageDescriptor(messageDescriptor, defaultDenyMessage) ||
      defaultDenyMessage;
    const nodes = Array.from(set);
    for (const node of nodes) {
      if (!node.isConnected) { set.delete(node); continue; }
      if (action === "deny") {
        disableLink(node, denyReason, host, meta);
      } else if (action === "allow") {
        if (node.tagName === "A") {
          ensureAttrs(node);
          if (keepWarnMessageOnAllow) {
            // I link consentiti mantengono un tooltip informativo per i contesti Reader/AMP.
            setHoverMessage(node, warnFallback);
          } else {
            clearHoverMessage(node, warnMessage, useTooltip);
          }
          // reset listener: clone per sicurezza
          const clone = node.cloneNode(true);
          clone.classList?.remove(cfg.warnHighlightClass);
          if (keepWarnMessageOnAllow) {
            setHoverMessage(clone, warnFallback);
          } else {
            clearHoverMessage(clone, warnMessage, useTooltip);
          }
          node.replaceWith(clone);
          mapReplaceNode(host, node, clone);
          if (trackingRuntime && trackingRuntime.isEnabled()) {
            const cloneState = anchorStates.get(clone) || null;
            applyTrackingParameterToAnchor(clone, cloneState);
          }
        } else {
          node.classList?.remove(cfg.warnHighlightClass);
          if (keepWarnMessageOnAllow) {
            // Anche per elementi non ancora sostituiti (es. <span>) manteniamo il messaggio di sicurezza.
            setHoverMessage(node, warnFallback);
          } else {
            clearHoverMessage(node, warnMessage, useTooltip);
          }
        }
      } else {
        if (node.tagName === "A") ensureAttrs(node); // warn
        if (cfg.mode !== "strict") {
          node.classList?.add(cfg.warnHighlightClass);
          setHoverMessage(node, warnMessage);
        } else {
          clearHoverMessage(node, warnMessage, useTooltip);
        }
      }
    }

    if (!cfg.debugMode) {
      return;
    }

    const sourceTag =
      typeof meta.source === "string" && meta.source.trim()
        ? meta.source.trim()
        : cached && meta.source !== "cache"
        ? "cache"
        : "runtime";
    const trackedSet = anchorsByHost.get(host);
    const level = cfg.debugLevel === "verbose" ? "verbose" : "basic";
    const summary = {
      host,
      action,
      linksMatched: nodes.length,
      mode: cfg.mode,
      source: sourceTag
    };
    if (runtimeLanguageSnapshot.preferred) {
      summary.language = runtimeLanguageSnapshot.preferred;
    }
    if (
      Array.isArray(runtimeLanguageSnapshot.alternatives) &&
      runtimeLanguageSnapshot.alternatives.length
    ) {
      summary.languages = runtimeLanguageSnapshot.alternatives;
    }
    if (runtimeLanguageSnapshot.documentLang) {
      summary.documentLanguage = runtimeLanguageSnapshot.documentLang;
    }
    if (
      Array.isArray(runtimeLanguageSnapshot.sources) &&
      runtimeLanguageSnapshot.sources.length
    ) {
      summary.languageSources = runtimeLanguageSnapshot.sources;
    }
    if (cfg.warnHighlightClass) {
      summary.warnHighlightClass = cfg.warnHighlightClass;
    }
    if (messageDescriptor) {
      summary.message = messageDescriptor;
    }
    const renderedMessage = action === "deny" ? denyReason : warnMessage;
    if (renderedMessage) {
      summary.renderedMessage = renderedMessage;
    }
    if (meta && Number.isFinite(meta.ttl)) {
      summary.ttl = meta.ttl;
    }
    if (meta && Number.isFinite(meta.cacheAgeSec)) {
      summary.cacheAgeSec = meta.cacheAgeSec;
    }
    if (meta && Number.isFinite(meta.cachedAt)) {
      summary.cachedAtSec = meta.cachedAt;
      try {
        summary.cachedAtIso = new Date(meta.cachedAt * 1000).toISOString();
      } catch (isoErr) {
        summary.cachedAtIso = null;
      }
    }
    if (meta && meta.error) {
      summary.error = meta.error;
    }
    if (trackedSet) {
      summary.totalTrackedNodes = trackedSet.size;
    } else {
      summary.totalTrackedNodes = nodes.length;
    }

    if (level === "verbose") {
      if (meta && meta.response) {
        summary.policyResponse = meta.response;
      }
      const sampleSource = trackedSet ? Array.from(trackedSet) : nodes;
      const samples = sampleSource.slice(0, 10).map((node) => {
        const state = anchorStates.get(node) || null;
        const textContent = (node.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160);
        const sample = {
          tag: node.tagName ? node.tagName.toLowerCase() : null,
          text: textContent || null,
          disabled:
            node.classList?.contains("slg-disabled") ||
            node.getAttribute?.("aria-disabled") === "true"
              ? true
              : undefined,
          hasWarnHighlight:
            cfg.warnHighlightClass &&
            node.classList?.contains(cfg.warnHighlightClass)
              ? true
              : undefined
        };
        if (node.tagName === "A") {
          sample.href = node.getAttribute("href") || node.href || null;
        }
        if (node.dataset?.safeLinkGuard) {
          sample.dataset = { safeLinkGuard: node.dataset.safeLinkGuard };
        }
        if (state) {
          const stateSummary = {};
          if (state.host) {
            stateSummary.host = state.host;
          }
          if (state.url && state.url.href) {
            stateSummary.url = state.url.href;
          }
          if (state.originalHref) {
            stateSummary.originalHref = state.originalHref;
          }
          if (state.removed) {
            stateSummary.removed = true;
          }
          if (state.disabledAt) {
            stateSummary.disabledAt = state.disabledAt;
          }
          if (state.replacementTag) {
            stateSummary.replacementTag = state.replacementTag;
          }
          if (state.policy) {
            const policyInfo = {};
            if (state.policy.action) {
              policyInfo.action = state.policy.action;
            }
            if (state.policy.reason) {
              policyInfo.reason = state.policy.reason;
            }
            if (state.policy.source) {
              policyInfo.source = state.policy.source;
            }
            if (Number.isFinite(state.policy.ttl)) {
              policyInfo.ttl = state.policy.ttl;
            }
            if (Number.isFinite(state.policy.cacheAgeSec)) {
              policyInfo.cacheAgeSec = state.policy.cacheAgeSec;
            }
            if (Number.isFinite(state.policy.cachedAt)) {
              policyInfo.cachedAt = state.policy.cachedAt;
            }
            if (state.policy.messageDescriptor) {
              policyInfo.messageDescriptor = state.policy.messageDescriptor;
            }
            if (Object.keys(policyInfo).length) {
              stateSummary.policy = policyInfo;
            }
          }
          if (Object.keys(stateSummary).length) {
            sample.state = stateSummary;
          }
        }
        return sample;
      });
      summary.sampleAnchors = samples;
      if (sampleSource.length > samples.length) {
        summary.sampleAnchorsTruncated = sampleSource.length - samples.length;
      }
    }

    const tags = [action];
    if (sourceTag) {
      tags.push(sourceTag);
    }

    debug.event("Policy applicata", summary, {
      scope: "policy",
      level,
      tags,
      depth: -2
    });

    if (action === "deny") {
      debug.warn(
        "Link bloccati per host sospetto",
        {
          host,
          linksMatched: nodes.length,
          message: messageDescriptor || { text: denyReason }
        },
        { scope: "policy", tags: ["deny", sourceTag || "runtime"] }
      );
    } else if (action === "warn") {
      debug.info(
        "Host contrassegnato come warning",
        {
          host,
          linksMatched: nodes.length,
          message: messageDescriptor || { text: warnMessage }
        },
        { scope: "policy", tags: ["warn", sourceTag || "runtime"] }
      );
    }
  };

  const enqueueHost = (host) => {
    const cached = policyCache.get(host);
    if (cached) {
      const nowSec = Math.floor(Date.now() / 1000);
      const meta = {
        source: "cache",
        ttl: cached.ttl,
        cachedAt: cached.ts,
        cacheAgeSec:
          Number.isFinite(cached.ts) && cached.ts <= nowSec
            ? nowSec - cached.ts
            : undefined,
        message: cached.message
      };
      applyPolicyToHost(host, cached.action, meta);
      return;
    }
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
          const result = await getPolicy(host);
          const action =
            result && typeof result === "object" && result.action
              ? result.action
              : typeof result === "string"
              ? result
              : "warn";
          const meta =
            result && typeof result === "object"
              ? result
              : { source: "network" };
          applyPolicyToHost(host, action, meta);
        } finally {
          inFlight.delete(host);
          running--;
          pump();
        }
      })();
    }
  };

  // ===== Modale + apertura robusta =====
  const MODAL_TEMPLATE_ID = "slg-modal-template";
  const MODAL_ROOT_SELECTOR = "[data-slg-root]";
  const modalElementSelector = (name) => `[data-slg-element="${name}"]`;
  const MODAL_SELECTORS = {
    dialog: modalElementSelector("dialog"),
    title: modalElementSelector("title"),
    message: modalElementSelector("message"),
    host: modalElementSelector("host"),
    hostLabel: modalElementSelector("host-label"),
    open: modalElementSelector("open"),
    cancel: modalElementSelector("cancel"),
    close: modalElementSelector("close"),
    copy: modalElementSelector("copy")
  };
  let modalRoot = null;
  let modalElements = null;
  let pendingUrl = null;
  let pendingMessageDescriptor = null;
  let pendingMessage = defaultWarnMessage;
  let lastFocused = null;
  let scrollLockState = null;
  let modalContentRenderer = null;

  // Costruisce un renderer i18n dichiarativo per sincronizzare i testi e gli
  // attributi della modale con il catalogo multilingua. In questo modo la
  // gestione dei contenuti resta centralizzata e reattiva ai cambi lingua.
  const ensureModalRenderer = () => {
    if (!modalElements) return null;
    const i18n = guardNamespace.i18n;
    if (!i18n || typeof i18n.createContentRenderer !== "function") {
      return null;
    }
    if (modalContentRenderer) {
      return modalContentRenderer;
    }
    const descriptors = [];
    if (modalElements.title) {
      descriptors.push({ node: modalElements.title, key: "modal.title" });
    }
    if (modalElements.close) {
      descriptors.push({
        node: modalElements.close,
        attributes: {
          "aria-label": "modal.closeLabel",
          title: "modal.closeTitle"
        }
      });
    }
    if (modalElements.open) {
      descriptors.push({ node: modalElements.open, key: "modal.openButton" });
    }
    if (modalElements.copy) {
      descriptors.push({ node: modalElements.copy, key: "modal.copyButton" });
    }
    if (modalElements.cancel) {
      descriptors.push({ node: modalElements.cancel, key: "modal.cancelButton" });
    }
    if (modalElements.hostLabel) {
      descriptors.push({ node: modalElements.hostLabel, key: "modal.hostLabel" });
    } else if (modalElements.hostLabelTextNode) {
      descriptors.push({
        node: modalElements.hostLabelTextNode,
        key: "modal.hostLabel",
        property: "nodeValue",
        transform: (value) => `${value} `
      });
    }
    if (!descriptors.length) {
      return null;
    }
    modalContentRenderer = i18n.createContentRenderer({
      descriptors,
      autoBind: false,
      renderInitial: false
    });
    return modalContentRenderer;
  };

  const applyModalTranslations = () => {
    if (!modalElements) return;
    const renderer = ensureModalRenderer();
    if (renderer) {
      renderer.render();
    } else {
      const titleText = translate("modal.title");
      if (modalElements.title) {
        modalElements.title.textContent = titleText;
      }
      if (modalElements.close) {
        modalElements.close.setAttribute(
          "aria-label",
          translate("modal.closeLabel")
        );
        modalElements.close.setAttribute(
          "title",
          translate("modal.closeTitle")
        );
      }
      if (modalElements.open) {
        modalElements.open.textContent = translate("modal.openButton");
      }
      if (modalElements.copy) {
        modalElements.copy.textContent = translate("modal.copyButton");
      }
      if (modalElements.cancel) {
        modalElements.cancel.textContent = translate("modal.cancelButton");
      }
      const hostLabelText = translate("modal.hostLabel");
      if (modalElements.hostLabel) {
        modalElements.hostLabel.textContent = hostLabelText;
      } else if (modalElements.hostLabelTextNode) {
        modalElements.hostLabelTextNode.nodeValue = `${hostLabelText} `;
      }
    }
    if (modalElements.message) {
      if (!pendingMessageDescriptor && (!pendingMessage || pendingMessage === defaultWarnMessage)) {
        modalElements.message.textContent = defaultWarnMessage;
      } else if (pendingMessage) {
        modalElements.message.textContent = pendingMessage;
      }
    }
  };

  const handleLanguageChange = () => {
    const previousWarnDefault = defaultWarnMessage;
    defaultWarnMessage = translate("messages.defaultWarn");
    defaultDenyMessage = translate("messages.denyDefault");
    if (!cfg.warnMessageDefault || cfg.warnMessageDefault === previousWarnDefault) {
      cfg.warnMessageDefault = defaultWarnMessage;
    }
    if (pendingMessageDescriptor) {
      const fallback = cfg.warnMessageDefault || defaultWarnMessage;
      pendingMessage =
        translateMessageDescriptor(pendingMessageDescriptor, fallback) || fallback;
      if (modalElements?.message) {
        modalElements.message.textContent = pendingMessage;
      }
    } else if (!pendingMessage || pendingMessage === previousWarnDefault) {
      pendingMessage = defaultWarnMessage;
      if (modalElements?.message) {
        modalElements.message.textContent = defaultWarnMessage;
      }
    }
    applyModalTranslations();
  };

  const subscribeToLanguageChanges = () => {
    if (!guardNamespace.i18n || typeof guardNamespace.i18n.onLanguageChange !== "function") {
      return null;
    }
    return guardNamespace.i18n.onLanguageChange(handleLanguageChange);
  };

  let unsubscribeLanguageChange = subscribeToLanguageChanges();

  if (!unsubscribeLanguageChange) {
    const readyQueueKey = "__i18nReadyQueue";
    const queue = guardNamespace[readyQueueKey] || [];
    queue.push((i18nApi) => {
      if (!i18nApi || typeof i18nApi.onLanguageChange !== "function") {
        return;
      }
      unsubscribeLanguageChange = i18nApi.onLanguageChange(handleLanguageChange);
      handleLanguageChange();
    });
    guardNamespace[readyQueueKey] = queue;
  }

  handleLanguageChange();

  /**
   * Restituisce il template HTML della modale da utilizzare, preferendo
   * eventuali template definiti nel DOM o esposti su `SafeExternalLinksGuard`.
   * Il fallback mantiene la compatibilità con le versioni precedenti creando
   * dinamicamente la struttura standard.
   * @returns {HTMLElement}
   */
  const ensureModalTemplateElement = () => {
    const domTemplate = document.getElementById(MODAL_TEMPLATE_ID);
    if (domTemplate && typeof domTemplate === "object") {
      guardNamespace.templates = guardNamespace.templates || {};
      guardNamespace.templates.modal = domTemplate;
      return domTemplate;
    }

    const namespaceTemplates = guardNamespace.templates;
    if (namespaceTemplates && namespaceTemplates.modal) {
      const candidate = namespaceTemplates.modal;
      if (candidate && typeof candidate === "object") {
        return candidate;
      }
      if (typeof candidate === "string") {
        const tpl = document.createElement("template");
        tpl.id = MODAL_TEMPLATE_ID;
        tpl.innerHTML = candidate;
        namespaceTemplates.modal = tpl;
        return tpl;
      }
    }

    const fallback = document.createElement("template");
    fallback.id = MODAL_TEMPLATE_ID;
    fallback.innerHTML = getDefaultModalTemplate();
    guardNamespace.templates = guardNamespace.templates || {};
    guardNamespace.templates.modal = fallback;
    return fallback;
  };

  const queryModalElement = (root, selector, fallbackSelector) => {
    if (!root) return null;
    const primary = selector ? root.querySelector(selector) : null;
    if (primary) return primary;
    if (!fallbackSelector) return null;
    return root.querySelector(fallbackSelector);
  };

  /**
   * Applica un padding aggiuntivo al body quando la scrollbar scompare per
   * mantenere fissa la larghezza del layout ed evitare shift visivi.
   */
  const applyScrollLockCompensation = () => {
    const body = document.body;
    if (!body) return;
    if (scrollLockState?.applied) return;

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    scrollLockState = {
      applied: true,
      inlinePaddingRight: body.style.paddingRight || ""
    };

    if (scrollbarWidth <= 0) return;

    const computed = window.getComputedStyle(body);
    const currentPadding = parseFloat(computed?.paddingRight || "0");
    const compensated = computeScrollLockPadding(currentPadding, scrollbarWidth);
    body.style.paddingRight = `${compensated}px`;
  };

  /**
   * Ripristina lo stato del body riportando padding e flag alla configurazione iniziale.
   */
  const releaseScrollLockCompensation = () => {
    const body = document.body;
    if (!body) return;
    if (!scrollLockState?.applied) {
      scrollLockState = null;
      return;
    }

    body.style.paddingRight = scrollLockState.inlinePaddingRight;
    scrollLockState = null;
  };

  const buildModal = () => {
    const templateEl = ensureModalTemplateElement();
    const fragment = templateEl.content
      ? templateEl.content.cloneNode(true)
      : document.importNode(templateEl, true);

    const container = document.createElement("div");
    container.appendChild(fragment);
    const root =
      container.querySelector(MODAL_ROOT_SELECTOR) || container.firstElementChild;
    if (!root) {
      throw new Error("SafeExternalLinksGuard: template della modale non valido");
    }

    root.id = "slg-modal-root";
    if (root.classList && !root.classList.contains("slg-overlay")) {
      root.classList.add("slg-overlay");
    }
    if (root.classList && !root.classList.contains("slg--hidden")) {
      root.classList.add("slg--hidden");
    }
    root.style.zIndex = String(cfg.zIndex);

    const dialog = queryModalElement(
      root,
      MODAL_SELECTORS.dialog,
      ".slg-dialog"
    );
    if (!dialog) {
      throw new Error(
        "SafeExternalLinksGuard: impossibile trovare l'elemento dialog nel template"
      );
    }

    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "slg-title");
    dialog.setAttribute("aria-describedby", "slg-message");
    if (dialog.tabIndex !== -1) {
      dialog.tabIndex = -1;
    }

    const titleEl = queryModalElement(
      root,
      MODAL_SELECTORS.title,
      "#slg-title"
    );
    if (titleEl && !titleEl.id) {
      titleEl.id = "slg-title";
    }

    const messageEl = queryModalElement(
      root,
      MODAL_SELECTORS.message,
      "#slg-message"
    );
    if (messageEl && !messageEl.id) {
      messageEl.id = "slg-message";
    }

    const hostEl = queryModalElement(
      root,
      MODAL_SELECTORS.host,
      "#slg-host"
    );
    if (hostEl && !hostEl.id) {
      hostEl.id = "slg-host";
    }

    const hostLabelEl = queryModalElement(
      root,
      MODAL_SELECTORS.hostLabel,
      ".slg-host-label"
    );
    let hostLabelTextNode = null;
    if (!hostLabelEl && hostEl) {
      const sibling = hostEl.previousSibling;
      if (sibling && sibling.nodeType === TEXT_NODE) {
        hostLabelTextNode = sibling;
      }
    }

    const openLink = queryModalElement(
      root,
      MODAL_SELECTORS.open,
      "#slg-open"
    );
    if (!openLink) {
      throw new Error(
        "SafeExternalLinksGuard: il template della modale richiede un elemento con data-slg-element=\"open\""
      );
    }

    const cancelBtn = queryModalElement(
      root,
      MODAL_SELECTORS.cancel,
      "#slg-cancel"
    );
    const closeBtn = queryModalElement(
      root,
      MODAL_SELECTORS.close,
      ".slg-close"
    );
    const copyBtn = queryModalElement(
      root,
      MODAL_SELECTORS.copy,
      "#slg-copy"
    );

    if (copyBtn) {
      copyBtn.hidden = !cfg.showCopyButton;
    }

    // Impediamo che gli elementi della modale vengano presi in carico dalla scansione principale
    // marcandoli come interni fin dalla creazione. Questo evita che la logica di protezione
    // applicata ai link esterni sovrascriva attributi come `title` o aggiunga listener
    // indesiderati ai controlli della UI.
    openLink.dataset.safeLinkGuard = "modal";

    const finalizeHide = () => {
      // Ripristina lo stato "nascosto" della modale dopo la transizione di fade-out.
      root.classList.remove("slg--visible");
      if (!root.classList.contains("slg--hidden")) {
        root.classList.add("slg--hidden");
      }
      document.body.classList.remove("slg-no-scroll");
      releaseScrollLockCompensation();
      pendingUrl = null;
      pendingMessageDescriptor = null;
      pendingMessage = defaultWarnMessage;
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    };

    const hide = () => {
      const onTransitionEnd = (evt) => {
        if (evt.target !== root || evt.propertyName !== "opacity") return;
        root.removeEventListener("transitionend", onTransitionEnd);
        finalizeHide();
      };

      if (root.classList.contains("slg--visible")) {
        // Attende il termine dell'animazione per evitare che l'overlay scompaia di colpo.
        root.addEventListener("transitionend", onTransitionEnd);
        root.classList.remove("slg--visible");
        setTimeout(() => {
          root.removeEventListener("transitionend", onTransitionEnd);
          finalizeHide();
        }, 320);
      } else {
        finalizeHide();
      }
    };

    root.addEventListener("click", (e) => { if (e.target === root) hide(); });
    if (closeBtn) {
      closeBtn.addEventListener("click", hide);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", hide);
    }

    openLink.addEventListener("click", (e) => {
      const href = openLink.getAttribute("href");
      if (!href) { hide(); return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      followExternalUrl(href);
      hide();
    }, { capture: true });

    if (copyBtn) {
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
    }

    if (modalContentRenderer) {
      modalContentRenderer.disconnect();
      modalContentRenderer = null;
    }

    modalElements = {
      dialog,
      title: titleEl,
      message: messageEl,
      host: hostEl,
      hostLabel: hostLabelEl,
      hostLabelTextNode,
      open: openLink,
      cancel: cancelBtn,
      close: closeBtn,
      copy: copyBtn
    };

    applyModalTranslations();

    return { root, dialog };
  };

  const ensureModal = () => {
    if (modalRoot) return modalRoot;
    const { root } = buildModal();
    document.body.appendChild(root);
    modalRoot = root;
    return modalRoot;
  };

  const isModalElement = (node) => {
    if (!modalRoot || !node) return false;
    return node === modalRoot || modalRoot.contains(node);
  };

  const showModal = (url, message) => {
    ensureModal();
    pendingUrl = url;
    pendingMessageDescriptor = normalizeMessageDescriptor(message);
    const fallback = cfg.warnMessageDefault || defaultWarnMessage;
    pendingMessage =
      translateMessageDescriptor(pendingMessageDescriptor, fallback) || fallback;
    applyModalTranslations();
    if (modalElements?.host) {
      modalElements.host.textContent = url.host;
    }
    if (modalElements?.open) {
      modalElements.open.setAttribute("href", url.href);
      if (cfg.newTab) {
        modalElements.open.setAttribute("target", "_blank");
      } else {
        modalElements.open.removeAttribute("target");
      }
      modalElements.open.setAttribute("rel", "noopener noreferrer nofollow");
    }
    if (modalElements?.message) {
      modalElements.message.textContent = pendingMessage;
    }
    lastFocused = document.activeElement;
    modalRoot.classList.remove("slg--hidden");
    requestAnimationFrame(() => {
      modalRoot.classList.add("slg--visible");
    });
    applyScrollLockCompensation();
    document.body.classList.add("slg-no-scroll");
    if (modalElements?.dialog && typeof modalElements.dialog.focus === "function") {
      modalElements.dialog.focus();
    }
  };
  // ===== Scansione =====
  const processAnchor = (a) => {
    if (!a) return null;
    if (a.dataset.safeLinkGuard === "modal") { a.dataset.safeLinkGuard = "modal"; return null; }
    if (a.dataset.safeLinkGuard === "1") {
      const cachedState = anchorStates.get(a);
      return cachedState || null;
    }

    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#")) { a.dataset.safeLinkGuard = "1"; return null; }
    if (/^(mailto:|tel:|javascript:|blob:|data:)/i.test(href)) { a.dataset.safeLinkGuard = "1"; return null; }

    const url = toURL(href);
    if (!url || !isHttpLike(url.href)) { a.dataset.safeLinkGuard = "1"; return null; }
    if (!isExternal(url)) { a.dataset.safeLinkGuard = "1"; return null; }

    const host = url.host.toLowerCase();
    const state = { url, host };
    anchorStates.set(a, state);
    mapAdd(host, a);

    // Se già in cache come DENY, blocca SUBITO (e sostituisci <a>→<span> se richiesto)
    const cached = policyCache.get(host);
    if (cached && cached.action === "deny") {
      const denyMsg =
        translateMessageDescriptor(cached.message, defaultDenyMessage) ||
        defaultDenyMessage;
      const nowSec = Math.floor(Date.now() / 1000);
      const meta = {
        source: "cache",
        ttl: cached.ttl,
        cachedAt: cached.ts,
        cacheAgeSec:
          Number.isFinite(cached.ts) && cached.ts <= nowSec ? nowSec - cached.ts : undefined,
        message: cached.message
      };
      disableLink(a, denyMsg, host, meta);
      return state;
    }

    // Altrimenti impone attributi e chiede la policy in background
    ensureAttrs(a);
    if (keepWarnMessageOnAllow) {
      // Mantiene un messaggio di avviso accessibile anche quando la policy finale è `allow`.
      const warnFallback = cfg.warnMessageDefault || defaultWarnMessage;
      setHoverMessage(a, warnFallback);
    }
    enqueueHost(host);

    return state;
  };

  const processAll = (root = document) => {
    root.querySelectorAll("a[href]:not([data-safe-link-guard])").forEach((node) => {
      if (isModalElement(node)) {
        node.dataset.safeLinkGuard = "modal";
        return;
      }
      if (shouldExclude(node)) {
        node.dataset.safeLinkGuard = "1";
        return;
      }
      processAnchor(node);
    });
  };

  const resolveAnchorFromTarget = (target) => {
    if (!target) return null;
    if (target.tagName === "A") return target;
    if (typeof target.closest === "function") {
      try {
        const closestAnchor = target.closest("a[href]");
        if (closestAnchor) {
          return closestAnchor;
        }
      } catch (errClosest) {
        // Alcuni ambienti possono limitare l'uso di closest: fallback manuale.
      }
    }
    let node = target.parentNode;
    while (node) {
      if (node.tagName === "A") return node;
      node = node.parentNode;
    }
    return null;
  };

  const ensureAnchorState = (anchor) => {
    if (!anchor) return null;
    let state = anchorStates.get(anchor);
    if (state) {
      return state;
    }
    return processAnchor(anchor);
  };

  const handleAnchorActivation = async (event, anchor) => {
    if (!anchor || event.defaultPrevented) {
      return;
    }
    if (anchor.dataset.safeLinkGuard === "modal") {
      return;
    }

    const state = ensureAnchorState(anchor);
    if (!state) {
      return;
    }

    let { url, host } = state;
    let trackingContext = null;

    if (trackingRuntime && trackingRuntime.isEnabled()) {
      trackingContext = applyTrackingParameterToAnchor(
        anchor,
        state
      );
      if (trackingContext?.url) {
        url = trackingContext.url;
      }
    }

    const isModified =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1;
    if (isModified) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    const cachedDecision = policyCache.get(host);
    if (!cachedDecision) {
      const result = await getPolicy(host);
      const action =
        result && typeof result === "object" && result.action
          ? result.action
          : typeof result === "string"
          ? result
          : "warn";
      const meta =
        result && typeof result === "object" ? result : { source: "network" };
      applyPolicyToHost(host, action, meta);
      const finalCached = policyCache.get(host);
      if (action === "allow") {
        followExternalUrl(trackingContext?.url || url, {
          element: anchor,
          trackingContext,
          event
        });
      } else if (action === "warn") {
        if (cfg.mode !== "soft") {
          showModal(trackingContext?.url || url, finalCached?.message);
        }
      }
      return;
    }

    if (cachedDecision.action === "deny") {
      return;
    }
    if (cachedDecision.action === "warn") {
      if (cfg.mode !== "soft") {
        showModal(trackingContext?.url || url, cachedDecision.message);
      }
      return;
    }

    followExternalUrl(trackingContext?.url || url, {
      element: anchor,
      trackingContext,
      event
    });
  };

  const collectExternalLinksForAmp = (root, options = {}) => {
    const fallbackDocument =
      typeof document !== "undefined" ? document : null;
    const scope =
      root && typeof root.querySelectorAll === "function"
        ? root
        : fallbackDocument;
    if (!scope || typeof scope.querySelectorAll !== "function") {
      return [];
    }

    const anchors = Array.from(scope.querySelectorAll("a[href]"));
    const results = [];
    anchors.forEach((node, index) => {
      const href =
        typeof node.getAttribute === "function"
          ? node.getAttribute("href")
          : node.href;
      if (!href || href.startsWith("#")) {
        return;
      }
      if (/^(mailto:|tel:|javascript:|blob:|data:)/i.test(href)) {
        return;
      }
      const url = toURL(href);
      if (!url || !isHttpLike(url.href) || !isExternal(url)) {
        return;
      }

      results.push({
        index,
        href: url.href,
        host: url.host.toLowerCase(),
        origin: url.origin,
        text: options.includeText ? (node.textContent || "").trim() : undefined,
        id: typeof node.getAttribute === "function" ? node.getAttribute("id") : undefined
      });
    });

    return results;
  };

  const normalizeAmpPolicies = (policies) => {
    const map = new Map();
    if (!policies) {
      return map;
    }

    const pushEntry = (key, value) => {
      if (!key) {
        return;
      }
      const normalizedKey = String(key).toLowerCase();
      if (!normalizedKey) {
        return;
      }
      if (!value || typeof value !== "object") {
        return;
      }
      const action = normalizeAction(value.action);
      if (!action) {
        return;
      }
      map.set(normalizedKey, {
        action,
        message: normalizeMessageDescriptor(value.message) || null
      });
    };

    if (policies instanceof Map) {
      policies.forEach((value, key) => {
        pushEntry(key, value);
      });
      return map;
    }

    if (Array.isArray(policies)) {
      policies.forEach((entry) => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        pushEntry(entry.href || entry.host || entry.origin, entry);
      });
      return map;
    }

    if (typeof policies === "object") {
      Object.keys(policies).forEach((key) => {
        pushEntry(key, policies[key]);
      });
    }

    return map;
  };

  const applyAmpPolicies = (root, policies, options = {}) => {
    const fallbackDocument =
      typeof document !== "undefined" ? document : null;
    const scope =
      root && typeof root.querySelectorAll === "function"
        ? root
        : fallbackDocument;
    if (!scope || typeof scope.querySelectorAll !== "function") {
      return { processed: 0, denied: 0, warned: 0 };
    }

    const normalizedPolicies = normalizeAmpPolicies(policies);
    const warnClass = options.warnClass || cfg.warnHighlightClass || "slg-warn-highlight";
    const warnFallback = cfg.warnMessageDefault || defaultWarnMessage;
    const results = { processed: 0, denied: 0, warned: 0 };

    const anchors = Array.from(scope.querySelectorAll("a[href]"));
    anchors.forEach((node) => {
      const href =
        typeof node.getAttribute === "function"
          ? node.getAttribute("href")
          : node.href;
      if (!href || href.startsWith("#")) {
        return;
      }
      if (/^(mailto:|tel:|javascript:|blob:|data:)/i.test(href)) {
        return;
      }
      const url = toURL(href);
      if (!url || !isHttpLike(url.href) || !isExternal(url)) {
        return;
      }

      const host = url.host.toLowerCase();
      const originKey = url.origin.toLowerCase();
      const hrefKey = url.href.toLowerCase();
      const pathKey = `${originKey}${url.pathname}${url.search}`;

      const policy =
        normalizedPolicies.get(hrefKey) ||
        normalizedPolicies.get(pathKey) ||
        normalizedPolicies.get(originKey) ||
        normalizedPolicies.get(host);
      if (!policy) {
        return;
      }

      results.processed += 1;

      if (policy.action === "deny") {
        results.denied += 1;
        disableLink(node, policy.message || null, host, {
          source: "amp",
          message: policy.message || null
        });
        return;
      }

      if (policy.action === "warn") {
        results.warned += 1;
        ensureAttrs(node);
        if (node.classList && warnClass) {
          node.classList.add(warnClass);
        }
        const messageText =
          translateMessageDescriptor(policy.message, warnFallback) || warnFallback;
        setHoverMessage(node, messageText);
        return;
      }

      if (policy.action === "allow") {
        ensureAttrs(node);
        if (cfg.keepWarnMessageOnAllow) {
          // In ambienti limitati manteniamo un avviso visibile anche per i link consentiti.
          setHoverMessage(node, warnFallback);
        } else {
          clearHoverMessage(node, null, true);
        }
        if (node.classList && warnClass) {
          node.classList.remove(warnClass);
        }
      }
    });

    return results;
  };

  const delegatedClickHandler = async (event) => {
    if (!event) {
      return;
    }
    const anchor = resolveAnchorFromTarget(event.target);
    if (!anchor || anchor.tagName !== "A") {
      return;
    }
    if (shouldExclude(anchor)) {
      anchor.dataset.safeLinkGuard = "1";
      return;
    }
    if (isModalElement(anchor)) {
      anchor.dataset.safeLinkGuard = "modal";
      return;
    }
    try {
      await handleAnchorActivation(event, anchor);
    } catch (errHandleAnchor) {
      debug.error(
        "Errore durante la gestione del click delegato",
        serializeError(errHandleAnchor) || String(errHandleAnchor),
        { scope: "runtime" }
      );
    }
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.tagName === "A") {
          if (isModalElement(node)) { node.dataset.safeLinkGuard = "modal"; return; }
          if (shouldExclude(node)) { node.dataset.safeLinkGuard = "1"; return; }
          processAnchor(node);
        } else {
          node.querySelectorAll?.("a[href]")?.forEach((anchor) => {
            if (isModalElement(anchor)) { anchor.dataset.safeLinkGuard = "modal"; return; }
            if (shouldExclude(anchor)) { anchor.dataset.safeLinkGuard = "1"; return; }
            processAnchor(anchor);
          });
        }
      });
    }
  });

  if (!guardNamespace.amp) {
    guardNamespace.amp = {};
  }
  if (typeof guardNamespace.amp.collectExternalLinks !== "function") {
    guardNamespace.amp.collectExternalLinks = collectExternalLinksForAmp;
  }
  if (typeof guardNamespace.amp.applyPolicies !== "function") {
    guardNamespace.amp.applyPolicies = applyAmpPolicies;
  }

  // ===== Init =====
  const init = async () => {
    injectStyles();
    policyCache.load();
    await checkEndpointHealth();
    if (!endpointHealthy) {
      debug.warn(
        "Verifica endpoint fallita: attivazione fallback 'warn'",
        { endpoint: cfg.endpoint },
        { scope: "network", tags: ["fallback"] }
      );
    }
    processAll(document);
    document.addEventListener("click", delegatedClickHandler, { capture: true, passive: false });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  // ===== API =====
  window.SafeLinkGuard = {
    rescan(root) { processAll(root || document); },
    clearCache() { policyCache.clear(); },
    setMode(m) {
      const normalized = typeof m === "string" ? m.trim().toLowerCase() : "";
      cfg.mode = VALID_MODES.has(normalized) ? normalized : "strict";
    },
    getConfigSignature() {
      return configFingerprint;
    }
  };
})();
