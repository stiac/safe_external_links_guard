/*!
 * Safe External Links Guard — i18n helper
 * Gestisce il caricamento centralizzato delle traduzioni, la rilevazione
 * automatica della lingua e fornisce un'API coerente per recuperare i testi
 * da mostrare all'utente. Il modulo è scritto in UMD per funzionare sia
 * in ambienti browser sia Node.js (test e build offline).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    factory(root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const guardNamespace = (root.SafeExternalLinksGuard =
    root.SafeExternalLinksGuard || {});

  const DEFAULT_LANGUAGE = 'en';
  // Mappa dei codici normalizzati -> forma canonica mostrata ai consumatori dell'API pubblica.
  const CANONICAL_DISPLAY = {
    'pt-br': 'pt-BR',
    pt: 'pt',
    'it-it': 'it-IT'
  };
  // Alias aggiuntivi per normalizzare varianti regionali o codici legacy.
  const LANGUAGE_ALIASES = {
    'pt-pt': 'pt',
    br: 'pt-br',
    'it-it': 'it'
  };
  // Mapping dei ccTLD più comuni verso la lingua presumibile del sito.
  const HOST_LANGUAGE_TLD_MAP = {
    it: 'it-IT',
    fr: 'fr-FR',
    es: 'es-ES',
    de: 'de-DE',
    pt: 'pt-PT',
    br: 'pt-BR',
    ru: 'ru-RU',
    mx: 'es-MX',
    ar: 'es-AR',
    cl: 'es-CL',
    co: 'es-CO',
    pe: 'es-PE',
    uy: 'es-UY',
    gb: 'en-GB',
    uk: 'en-GB',
    ie: 'en-IE',
    us: 'en-US',
    ca: 'en-CA',
    au: 'en-AU',
    nz: 'en-NZ'
  };
  // Token di sottodominio comuni che rimandano a versioni localizzate del sito.
  const HOST_LANGUAGE_SUBDOMAIN_MAP = {
    it: 'it-IT',
    'it-it': 'it-IT',
    fr: 'fr-FR',
    'fr-fr': 'fr-FR',
    es: 'es-ES',
    'es-es': 'es-ES',
    'es-mx': 'es-MX',
    mx: 'es-MX',
    'es-ar': 'es-AR',
    ar: 'es-AR',
    de: 'de-DE',
    'de-de': 'de-DE',
    pt: 'pt-PT',
    'pt-pt': 'pt-PT',
    'pt-br': 'pt-BR',
    br: 'pt-BR',
    ru: 'ru-RU',
    'ru-ru': 'ru-RU',
    en: 'en-US',
    'en-gb': 'en-GB',
    'en-us': 'en-US'
  };
  // Sottodomini da ignorare esplicitamente perché non legati alla localizzazione.
  const HOST_LANGUAGE_IGNORED_TOKENS = new Set(['www', 'ww2', 'm', 'app', 'beta']);
  // Chiavi comuni utilizzate per salvare la preferenza linguistica nei vari storage del browser.
  const LANGUAGE_STORAGE_KEYS = [
    'SafeExternalLinksGuard.language',
    'SafeExternalLinksGuard.lang',
    'SafeExternalLinksGuardLang',
    'SafeExternalLinksGuard_language'
  ];

  // Catalogo di fallback per garantire sempre la disponibilità della lingua inglese
  // e delle lingue predefinite anche quando i file JSON non sono accessibili.
  const FALLBACK_TRANSLATIONS = {
    en: {
      messages: {
        defaultWarn:
          'This link is not verified and may share your browsing data with a third-party site. Make sure the destination is trustworthy before continuing.',
        denyDefault: 'This domain is blocked. Proceed with caution.',
        endpointUnavailable: 'Policy resolver temporarily unavailable. Proceed with caution.',
        timeout: 'The request to verify this domain timed out. Proceed with caution.',
        error: 'An error occurred while verifying this domain. Proceed with caution.',
        missingHost: 'Host is missing from the request.',
        policy: {
          phishing: 'Domain reported for phishing.',
          ruBlock: 'All .ru sub-domains are blocked.',
          github: 'Verified GitHub repository.',
          officialSubdomain: 'Official tuo-sito.it sub-domain.',
          beta: 'Beta environment: verify before continuing.'
        }
      },
      modal: {
        title: 'Check that this link is safe',
        closeLabel: 'Close',
        closeTitle: 'Close',
        hostLabel: 'Host:',
        openButton: 'Open link',
        copyButton: 'Copy link',
        cancelButton: 'Cancel'
      },
      tooltip: {
        warn: 'External link not verified'
      }
    },
    it: {
      messages: {
        defaultWarn:
          'Questo link non è verificato e può contenere dati della tua navigazione che saranno condivisi con un sito di terzi. Prima di procedere, assicurati che il link sia affidabile.',
        denyDefault: 'Dominio bloccato. Procedi con cautela.',
        endpointUnavailable: 'Resolver delle policy temporaneamente non disponibile. Procedi con cautela.',
        timeout: 'La verifica del dominio è scaduta. Procedi con cautela.',
        error: 'Si è verificato un errore durante la verifica del dominio. Procedi con cautela.',
        missingHost: 'Host mancante nella richiesta.',
        policy: {
          phishing: 'Dominio segnalato per phishing.',
          ruBlock: 'Tutti i sottodomini .ru sono bloccati.',
          github: 'Repository GitHub verificato.',
          officialSubdomain: 'Sottodominio ufficiale tuo-sito.it.',
          beta: 'Ambiente beta: verifica prima di procedere.'
        }
      },
      modal: {
        title: 'Controlla che questo link sia sicuro',
        closeLabel: 'Chiudi',
        closeTitle: 'Chiudi',
        hostLabel: 'Host:',
        openButton: 'Apri link',
        copyButton: 'Copia link',
        cancelButton: 'Annulla'
      },
      tooltip: {
        warn: 'Link esterno non verificato'
      }
    },
    es: {
      messages: {
        defaultWarn:
          'Este enlace no está verificado y puede compartir tus datos de navegación con un sitio de terceros. Antes de continuar, asegúrate de que el destino sea de confianza.',
        denyDefault: 'Dominio bloqueado. Procede con precaución.',
        endpointUnavailable: 'El resolvedor de políticas no está disponible temporalmente. Procede con precaución.',
        timeout: 'La verificación del dominio superó el tiempo límite. Procede con precaución.',
        error: 'Se produjo un error al verificar el dominio. Procede con precaución.',
        missingHost: 'Falta el host en la solicitud.',
        policy: {
          phishing: 'Dominio reportado por phishing.',
          ruBlock: 'Se bloquean todos los subdominios .ru.',
          github: 'Repositorio de GitHub verificado.',
          officialSubdomain: 'Subdominio oficial de tuo-sito.it.',
          beta: 'Entorno beta: verifica antes de continuar.'
        }
      },
      modal: {
        title: 'Comprueba que este enlace sea seguro',
        closeLabel: 'Cerrar',
        closeTitle: 'Cerrar',
        hostLabel: 'Host:',
        openButton: 'Abrir enlace',
        copyButton: 'Copiar enlace',
        cancelButton: 'Cancelar'
      },
      tooltip: {
        warn: 'Enlace externo no verificado'
      }
    },
    fr: {
      messages: {
        defaultWarn:
          "Ce lien n'est pas vérifié et peut partager vos données de navigation avec un site tiers. Avant de continuer, assurez-vous que la destination est fiable.",
        denyDefault: 'Domaine bloqué. Procédez avec prudence.',
        endpointUnavailable: 'Le résolveur de politiques est temporairement indisponible. Procédez avec prudence.',
        timeout: 'La vérification du domaine a expiré. Procédez avec prudence.',
        error: "Une erreur est survenue lors de la vérification du domaine. Procédez avec prudence.",
        missingHost: "L'hôte est manquant dans la requête.",
        policy: {
          phishing: 'Domaine signalé pour phishing.',
          ruBlock: 'Tous les sous-domaines .ru sont bloqués.',
          github: 'Dépôt GitHub vérifié.',
          officialSubdomain: 'Sous-domaine officiel de tuo-sito.it.',
          beta: 'Environnement bêta : vérifiez avant de continuer.'
        }
      },
      modal: {
        title: 'Vérifiez que ce lien est sûr',
        closeLabel: 'Fermer',
        closeTitle: 'Fermer',
        hostLabel: 'Hôte :',
        openButton: 'Ouvrir le lien',
        copyButton: 'Copier le lien',
        cancelButton: 'Annuler'
      },
      tooltip: {
        warn: 'Lien externe non vérifié'
      }
    },
    de: {
      messages: {
        defaultWarn:
          'Dieser Link ist nicht verifiziert und könnte Ihre Browserdaten mit einer Drittseite teilen. Stellen Sie vor dem Fortfahren sicher, dass das Ziel vertrauenswürdig ist.',
        denyDefault: 'Domain blockiert. Bitte vorsichtig fortfahren.',
        endpointUnavailable: 'Der Policy-Resolver ist vorübergehend nicht verfügbar. Bitte vorsichtig fortfahren.',
        timeout: 'Die Domainprüfung hat das Zeitlimit überschritten. Bitte vorsichtig fortfahren.',
        error: 'Beim Überprüfen der Domain ist ein Fehler aufgetreten. Bitte vorsichtig fortfahren.',
        missingHost: 'Host in der Anfrage fehlt.',
        policy: {
          phishing: 'Domain wegen Phishing gemeldet.',
          ruBlock: 'Alle .ru-Subdomains werden blockiert.',
          github: 'Verifiziertes GitHub-Repository.',
          officialSubdomain: 'Offizieller tuo-sito.it-Subdomain.',
          beta: 'Beta-Umgebung: vor dem Fortfahren prüfen.'
        }
      },
      modal: {
        title: 'Prüfen Sie, ob dieser Link sicher ist',
        closeLabel: 'Schließen',
        closeTitle: 'Schließen',
        hostLabel: 'Host:',
        openButton: 'Link öffnen',
        copyButton: 'Link kopieren',
        cancelButton: 'Abbrechen'
      },
      tooltip: {
        warn: 'Externer Link nicht verifiziert'
      }
    },
    pt: {
      messages: {
        defaultWarn:
          'Esta ligação não está verificada e pode partilhar os seus dados de navegação com um site de terceiros. Antes de continuar, confirme que o destino é de confiança.',
        denyDefault: 'Domínio bloqueado. Proceda com cautela.',
        endpointUnavailable: 'O resolvedor de políticas está temporariamente indisponível. Proceda com cautela.',
        timeout: 'A verificação do domínio expirou. Proceda com cautela.',
        error: 'Ocorreu um erro ao verificar o domínio. Proceda com cautela.',
        missingHost: 'Host ausente na solicitação.',
        policy: {
          phishing: 'Domínio sinalizado por phishing.',
          ruBlock: 'Todos os subdomínios .ru estão bloqueados.',
          github: 'Repositório GitHub verificado.',
          officialSubdomain: 'Subdomínio oficial de tuo-sito.it.',
          beta: 'Ambiente beta: verifique antes de prosseguir.'
        }
      },
      modal: {
        title: 'Confirme que esta ligação é segura',
        closeLabel: 'Fechar',
        closeTitle: 'Fechar',
        hostLabel: 'Host:',
        openButton: 'Abrir ligação',
        copyButton: 'Copiar ligação',
        cancelButton: 'Cancelar'
      },
      tooltip: {
        warn: 'Ligação externa não verificada'
      }
    },
    'pt-br': {
      messages: {
        defaultWarn:
          'Este link não está verificado e pode compartilhar seus dados de navegação com um site de terceiros. Antes de continuar, confirme que o destino é confiável.',
        denyDefault: 'Domínio bloqueado. Prossiga com cautela.',
        endpointUnavailable: 'O resolvedor de políticas está temporariamente indisponível. Prossiga com cautela.',
        timeout: 'A verificação do domínio excedeu o tempo limite. Prossiga com cautela.',
        error: 'Ocorreu um erro ao verificar o domínio. Prossiga com cautela.',
        missingHost: 'Host ausente na solicitação.',
        policy: {
          phishing: 'Domínio sinalizado por phishing.',
          ruBlock: 'Todos os subdomínios .ru estão bloqueados.',
          github: 'Repositório do GitHub verificado.',
          officialSubdomain: 'Subdomínio oficial de tuo-sito.it.',
          beta: 'Ambiente beta: verifique antes de continuar.'
        }
      },
      modal: {
        title: 'Verifique se este link é seguro',
        closeLabel: 'Fechar',
        closeTitle: 'Fechar',
        hostLabel: 'Host:',
        openButton: 'Abrir link',
        copyButton: 'Copiar link',
        cancelButton: 'Cancelar'
      },
      tooltip: {
        warn: 'Link externo não verificado'
      }
    },
    ru: {
      messages: {
        defaultWarn:
          'Эта ссылка не проверена и может передавать ваши данные просмотра стороннему сайту. Прежде чем продолжить, убедитесь, что назначение надежно.',
        denyDefault: 'Домен заблокирован. Действуйте с осторожностью.',
        endpointUnavailable: 'Решатель политик временно недоступен. Действуйте с осторожностью.',
        timeout: 'Проверка домена превысила время ожидания. Действуйте с осторожностью.',
        error: 'Произошла ошибка при проверке домена. Действуйте с осторожностью.',
        missingHost: 'В запросе отсутствует хост.',
        policy: {
          phishing: 'Домен отмечен как фишинговый.',
          ruBlock: 'Все поддомены .ru заблокированы.',
          github: 'Проверенный репозиторий GitHub.',
          officialSubdomain: 'Официальный поддомен tuo-sito.it.',
          beta: 'Тестовая среда: проверьте перед продолжением.'
        }
      },
      modal: {
        title: 'Проверьте, что эта ссылка безопасна',
        closeLabel: 'Закрыть',
        closeTitle: 'Закрыть',
        hostLabel: 'Хост:',
        openButton: 'Открыть ссылку',
        copyButton: 'Копировать ссылку',
        cancelButton: 'Отмена'
      },
      tooltip: {
        warn: 'Внешняя ссылка не проверена'
      }
    }
  };

  const deepClone = (value) => JSON.parse(JSON.stringify(value));

  let catalog = null;
  let activeLanguage = null;
  let activeLanguageNormalized = null;
  let activeTranslator = null;
  const listeners = [];
  const translatorCache = new Map();
  let sourceRefs = { base: null, preload: null };
  let pendingLoad = null;

  const safeAccess = (fn) => {
    try {
      return fn();
    } catch (err) {
      return undefined;
    }
  };

  const normalizeLanguageCode = (lang) => {
    if (!lang || typeof lang !== 'string') return '';
    const trimmed = lang.trim();
    if (!trimmed) return '';
    const sanitisedBase = trimmed.split(',')[0].split(';')[0].trim();
    if (!sanitisedBase) return '';
    const withoutExtensions = sanitisedBase.replace(/[_\s]+/g, '-').replace(/-(u|x)-.*/, '');
    return withoutExtensions.toLowerCase();
  };

  const mergeDeep = (target, source) => {
    if (!source || typeof source !== 'object') return target;
    const result = target || {};
    Object.keys(source).forEach((key) => {
      const value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = mergeDeep(result[key] ? { ...result[key] } : {}, value);
      } else {
        result[key] = value;
      }
    });
    return result;
  };

  /**
   * Restituisce il codice lingua da esporre pubblicamente (es. `pt-BR`)
   * partendo dalla forma normalizzata interna (lowercase).
   */
  const formatDisplayLanguage = (normalized) => {
    if (!normalized) {
      return DEFAULT_LANGUAGE;
    }
    if (CANONICAL_DISPLAY[normalized]) {
      return CANONICAL_DISPLAY[normalized];
    }
    if (!normalized.includes('-')) {
      return normalized;
    }
    const [base, region] = normalized.split('-');
    if (base === 'pt' && region === 'br') {
      return CANONICAL_DISPLAY['pt-br'];
    }
    if (region && region.length === 2) {
      return `${base}-${region.toUpperCase()}`;
    }
    return normalized;
  };

  /**
   * Risolve eventuali alias (pt-PT -> pt) contro il catalogo disponibile.
   * Restituisce la chiave effettivamente presente nel catalogo oppure stringa vuota.
   */
  const resolveAlias = (normalized, data) => {
    if (!normalized) return '';
    if (data && data[normalized]) {
      return normalized;
    }
    if (LANGUAGE_ALIASES[normalized] && data && data[LANGUAGE_ALIASES[normalized]]) {
      return LANGUAGE_ALIASES[normalized];
    }
    if (normalized.includes('-')) {
      const base = normalized.split('-')[0];
      if (data && data[base]) {
        return base;
      }
      if (LANGUAGE_ALIASES[base] && data && data[LANGUAGE_ALIASES[base]]) {
        return LANGUAGE_ALIASES[base];
      }
    }
    return '';
  };

  /**
   * Individua la sorgente corrente delle traduzioni (Node, preload JS o fallback).
   */
  const loadBaseCatalog = () => {
    if (typeof module === 'object' && module.exports) {
      try {
        // eslint-disable-next-line global-require
        return require('./app/Services/Localization/translationRegistry.js');
      } catch (err) {
        return null;
      }
    }
    return null;
  };

  const loadPreloadedCatalog = () =>
    guardNamespace.preloadedTranslations || root.SafeExternalLinksGuardTranslations || null;

  /**
   * Converte un dizionario di traduzioni in una struttura con chiavi normalizzate.
   */
  const normaliseCatalogInput = (data, includeFallback = false) => {
    if (!data || typeof data !== 'object') {
      return includeFallback ? mergeDeep({}, FALLBACK_TRANSLATIONS) : {};
    }
    const result = {};
    Object.keys(data).forEach((lang) => {
      const normalized = normalizeLanguageCode(lang);
      if (!normalized) return;
      result[normalized] = mergeDeep(result[normalized] || {}, data[lang]);
    });
    return result;
  };

  /**
   * Rigenera il catalogo interno partendo dalle sorgenti fornite
   * e riapplica la lingua attiva per notificare eventuali listener.
   */
  const rebuildCatalog = (baseSource, preloadSource) => {
    const normalisedBase = normaliseCatalogInput(baseSource);
    const normalisedPreload = normaliseCatalogInput(preloadSource);
    catalog = mergeDeep({}, FALLBACK_TRANSLATIONS);
    catalog = mergeDeep(catalog, normalisedBase);
    catalog = mergeDeep(catalog, normalisedPreload);
    guardNamespace.preloadedTranslations = mergeDeep({}, normalisedPreload);
    if (!catalog[DEFAULT_LANGUAGE]) {
      catalog[DEFAULT_LANGUAGE] = deepClone(FALLBACK_TRANSLATIONS[DEFAULT_LANGUAGE]);
    }
    translatorCache.clear();
    if (activeLanguageNormalized) {
      const current = activeLanguageNormalized;
      activeLanguageNormalized = null;
      setLanguage(current);
    }
  };

  const ensureCatalog = () => {
    const base = loadBaseCatalog();
    const preload = loadPreloadedCatalog();
    const changed =
      !catalog || sourceRefs.base !== base || sourceRefs.preload !== preload;
    if (changed) {
      rebuildCatalog(base, preload);
      sourceRefs = { base, preload: guardNamespace.preloadedTranslations };
    }
    return catalog;
  };

  const fetchDictionary = (lang) => {
    const data = ensureCatalog();
    const normalized = normalizeLanguageCode(lang);
    const resolved = resolveAlias(normalized, data) || DEFAULT_LANGUAGE;
    if (data[resolved]) {
      return data[resolved];
    }
    return data[DEFAULT_LANGUAGE];
  };

  const valueFromDictionary = (dictionary, key) => {
    if (!dictionary) return undefined;
    return key.split('.').reduce((acc, part) => {
      if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
        return acc[part];
      }
      return undefined;
    }, dictionary);
  };

  const applyReplacements = (text, replacements) => {
    if (!replacements || typeof replacements !== 'object') {
      return text;
    }
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token) => {
      if (Object.prototype.hasOwnProperty.call(replacements, token)) {
        const value = replacements[token];
        return value == null ? '' : String(value);
      }
      return match;
    });
  };

  const resolveKey = (lang, key) => {
    const dict = fetchDictionary(lang);
    let value = valueFromDictionary(dict, key);
    if (value == null && normalizeLanguageCode(lang) !== DEFAULT_LANGUAGE) {
      value = valueFromDictionary(fetchDictionary(DEFAULT_LANGUAGE), key);
    }
    if (typeof value === 'string') {
      return value;
    }
    return undefined;
  };

  /**
   * Gestisce il fallback a catena per una lista di chiavi e applica le sostituzioni.
   */
  const translateChain = (lang, keys, replacements) => {
    const chain = Array.isArray(keys) ? keys : [keys];
    for (let i = 0; i < chain.length; i += 1) {
      const candidate = chain[i];
      if (typeof candidate !== 'string') {
        continue;
      }
      const resolved = resolveKey(lang, candidate);
      if (resolved != null) {
        return applyReplacements(resolved, replacements);
      }
    }
    const fallbackKey = chain[chain.length - 1];
    if (typeof fallbackKey === 'string') {
      return applyReplacements(fallbackKey, replacements);
    }
    return '';
  };

  const buildTranslator = (lang) => {
    if (translatorCache.has(lang)) {
      return translatorCache.get(lang);
    }
    const translator = {
      language: formatDisplayLanguage(lang),
      dictionary: deepClone(fetchDictionary(lang)),
      has(key) {
        return resolveKey(lang, key) != null;
      },
      t(key, replacements) {
        return translateChain(lang, key, replacements);
      }
    };
    translatorCache.set(lang, translator);
    return translator;
  };

  const findBestLanguage = (lang) => {
    const data = ensureCatalog();
    const normalized = normalizeLanguageCode(lang);
    if (!normalized) return DEFAULT_LANGUAGE;
    const resolved = resolveAlias(normalized, data);
    if (resolved) {
      return resolved;
    }
    if (normalized === 'pt-br' && data['pt-br']) {
      return 'pt-br';
    }
    if (normalized && normalized.includes('-')) {
      const base = normalized.split('-')[0];
      if (data[base]) return base;
    }
    return DEFAULT_LANGUAGE;
  };

  const parseQueryLanguage = (search, paramName) => {
    if (!search || typeof search !== 'string') return '';
    const query = search.startsWith('?') ? search.substring(1) : search;
    const params = new URLSearchParams(query);
    return params.get(paramName) || '';
  };

  /**
   * Risolve il miglior candidato disponibile considerando alias e fallback alla lingua base.
   */
  const resolveCandidateLanguage = (candidate, data) => {
    const normalized = normalizeLanguageCode(candidate);
    if (!normalized) return '';

    const resolved = resolveAlias(normalized, data);
    if (resolved) {
      // Se il candidato include una variante regionale disponibile come alias
      // manteniamo la forma canonica con regione per esporre il codice atteso (es. it-IT -> it-IT).
      if (normalized !== resolved && normalized.startsWith(`${resolved}-`)) {
        return formatDisplayLanguage(normalized);
      }
      return formatDisplayLanguage(resolved);
    }

    if (data[normalized]) {
      return formatDisplayLanguage(normalized);
    }

    if (normalized.includes('-')) {
      const base = normalized.split('-')[0];
      if (data[base]) {
        return formatDisplayLanguage(base);
      }
      const baseAlias = LANGUAGE_ALIASES[base];
      if (baseAlias && data[baseAlias]) {
        return formatDisplayLanguage(baseAlias);
      }
    }

    return '';
  };

  /**
   * Recupera la lingua preferita salvata nei vari storage disponibili (local/session storage o cookie).
   */
  const readPersistedLanguage = (options) => {
    if (options && typeof options.persistedLang === 'string') {
      return options.persistedLang;
    }

    const storages = [];
    if (options && options.storage && typeof options.storage.getItem === 'function') {
      storages.push(options.storage);
    }

    const maybePushStorage = (getter) => {
      const storage = safeAccess(getter);
      if (storage && typeof storage.getItem === 'function') {
        storages.push(storage);
      }
    };

    maybePushStorage(() => root.localStorage);
    maybePushStorage(() => root.sessionStorage);

    for (let i = 0; i < storages.length; i += 1) {
      const storage = storages[i];
      for (let j = 0; j < LANGUAGE_STORAGE_KEYS.length; j += 1) {
        const key = LANGUAGE_STORAGE_KEYS[j];
        const value = safeAccess(() => storage.getItem(key));
        if (value && typeof value === 'string') {
          return value;
        }
      }
    }

    const cookieSource = options && Object.prototype.hasOwnProperty.call(options, 'cookies')
      ? options.cookies
      : safeAccess(() => root.document && root.document.cookie);

    if (cookieSource && typeof cookieSource === 'string') {
      const cookies = cookieSource.split(';');
      for (let i = 0; i < cookies.length; i += 1) {
        const raw = cookies[i];
        if (!raw) continue;
        const parts = raw.split('=');
        if (parts.length < 2) continue;
        const name = parts[0].trim();
        if (!name) continue;
        if (LANGUAGE_STORAGE_KEYS.includes(name)) {
          const rawValue = parts.slice(1).join('=').trim();
          if (rawValue) {
            return decodeURIComponent(rawValue);
          }
        }
      }
    }

    return '';
  };

  /**
   * Estrae la lingua indicata dal documento HTML (attributi lang, xml:lang o meta content-language).
   */
  const readDocumentLanguage = (options) => {
    if (options && typeof options.documentLang === 'string') {
      return options.documentLang;
    }

    const documentRef = options && options.document ? options.document : safeAccess(() => root.document);
    if (!documentRef) {
      return '';
    }

    const htmlNode = documentRef.documentElement || null;
    const pickNodeLang = (node) => {
      if (!node) return '';
      const attrs = ['lang', 'xml:lang'];
      for (let i = 0; i < attrs.length; i += 1) {
        const attr = attrs[i];
        const value = safeAccess(() =>
          typeof node.getAttribute === 'function' ? node.getAttribute(attr) : node[attr]
        );
        if (value && typeof value === 'string' && value.trim()) {
          return value;
        }
      }
      return '';
    };

    const htmlLang = pickNodeLang(htmlNode);
    if (htmlLang) {
      return htmlLang;
    }

    const bodyLang = pickNodeLang(documentRef.body || null);
    if (bodyLang) {
      return bodyLang;
    }

    const metaLang = safeAccess(() =>
      typeof documentRef.querySelector === 'function'
        ? documentRef.querySelector('meta[http-equiv="content-language"]')
        : null
    );
    if (metaLang && typeof metaLang.content === 'string' && metaLang.content.trim()) {
      const parts = metaLang.content.split(',');
      if (parts.length) {
        return parts[0].trim();
      }
    }

    return '';
  };

  /**
   * Recupera l'elenco delle lingue esposte dal browser, includendo le varianti storiche.
   */
  const collectNavigatorLanguages = (options) => {
    if (options && Array.isArray(options.navigatorLanguages)) {
      if (options.navigatorLanguages.length) {
        return options.navigatorLanguages;
      }
    }

    const navigatorRef = options && options.navigator ? options.navigator : safeAccess(() => root.navigator);
    if (!navigatorRef) {
      return [];
    }

    const result = [];
    const navigatorLanguages = safeAccess(() => navigatorRef.languages);
    if (Array.isArray(navigatorLanguages)) {
      navigatorLanguages.forEach((lang) => {
        if (lang) {
          result.push(lang);
        }
      });
    }

    const legacyKeys = ['language', 'browserLanguage', 'userLanguage', 'systemLanguage'];
    legacyKeys.forEach((key) => {
      const value = navigatorRef[key];
      if (typeof value === 'string' && value) {
        result.push(value);
      }
    });

    const uaData = safeAccess(() => navigatorRef.userAgentData);
    if (uaData) {
      const uaLanguages = safeAccess(() => uaData.languages);
      if (Array.isArray(uaLanguages)) {
        uaLanguages.forEach((lang) => {
          if (lang) {
            result.push(lang);
          }
        });
      }
      const uaLocale = safeAccess(() => uaData.locale);
      if (typeof uaLocale === 'string' && uaLocale) {
        result.push(uaLocale);
      }
    }

    return result;
  };

  /**
   * Recupera la lingua inferita dall'engine Intl quando il browser non espone informazioni esplicite.
   */
  const readIntlLocale = (options) => {
    if (options && typeof options.intlLocale === 'string') {
      return options.intlLocale;
    }

    const intlRef = options && options.intl ? options.intl : typeof Intl !== 'undefined' ? Intl : null;
    if (!intlRef || typeof intlRef.DateTimeFormat !== 'function') {
      return '';
    }

    const locale = safeAccess(() => {
      const formatter = intlRef.DateTimeFormat();
      if (!formatter || typeof formatter.resolvedOptions !== 'function') {
        return '';
      }
      const resolved = formatter.resolvedOptions();
      return resolved && resolved.locale ? resolved.locale : '';
    });

    return locale || '';
  };

  const readDatasetLanguage = (options) => {
    if (options && typeof options.datasetLang === 'string') {
      return options.datasetLang;
    }

    const documentRef = options && options.document ? options.document : safeAccess(() => root.document);
    if (!documentRef) {
      return '';
    }

    const pickFromNode = (node) => {
      if (!node) return '';

      const dataset = safeAccess(() => node.dataset);
      if (dataset && typeof dataset === 'object') {
        const keys = ['lang', 'language', 'locale', 'langId', 'i18n'];
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i];
          if (typeof dataset[key] === 'string' && dataset[key].trim()) {
            return dataset[key];
          }
        }
      }

      const attrs = ['data-lang', 'data-language', 'data-locale', 'data-ui-lang', 'data-ui-locale'];
      for (let i = 0; i < attrs.length; i += 1) {
        const attr = attrs[i];
        const value = safeAccess(() =>
          typeof node.getAttribute === 'function' ? node.getAttribute(attr) : node[attr]
        );
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
      }

      return '';
    };

    const htmlNode = documentRef.documentElement || null;
    const htmlLang = pickFromNode(htmlNode);
    if (htmlLang) {
      return htmlLang;
    }

    const bodyLang = pickFromNode(documentRef.body || null);
    if (bodyLang) {
      return bodyLang;
    }

    return '';
  };

  const collectMetaLanguages = (options) => {
    if (options && Array.isArray(options.metaLanguages)) {
      return options.metaLanguages;
    }

    const documentRef = options && options.document ? options.document : safeAccess(() => root.document);
    if (!documentRef) {
      return [];
    }

    const values = [];
    const pushValue = (value) => {
      if (typeof value === 'string' && value.trim()) {
        values.push(value);
      }
    };

    const selectors = [
      'meta[property="og:locale"]',
      'meta[property="og:locale:alternate"]',
      'meta[name="language"]',
      'meta[name="locale"]',
      'meta[name="dc.language"]',
      'meta[name="msapplication-locale"]'
    ];

    const queryNodes = (selector) => {
      const list = safeAccess(() =>
        typeof documentRef.querySelectorAll === 'function'
          ? documentRef.querySelectorAll(selector)
          : null
      );
      if (list && typeof list.length === 'number') {
        return Array.prototype.slice.call(list);
      }
      const single = safeAccess(() =>
        typeof documentRef.querySelector === 'function' ? documentRef.querySelector(selector) : null
      );
      return single ? [single] : [];
    };

    selectors.forEach((selector) => {
      const nodes = queryNodes(selector);
      nodes.forEach((node) => {
        const content = safeAccess(() =>
          node && typeof node.getAttribute === 'function' ? node.getAttribute('content') : node && node.content
        );
        if (typeof content === 'string' && content.trim()) {
          pushValue(content);
        }
      });
    });

    return values;
  };

  const readScriptLanguageHint = (options) => {
    if (options && typeof options.scriptLang === 'string') {
      return options.scriptLang;
    }

    const documentRef = options && options.document ? options.document : safeAccess(() => root.document);
    if (!documentRef) {
      return '';
    }

    const pickFromNode = (node) => {
      if (!node) return '';
      const dataset = safeAccess(() => node.dataset);
      if (dataset && typeof dataset === 'object') {
        const keys = ['slgLang', 'slgLocale', 'lang', 'locale', 'language'];
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i];
          if (typeof dataset[key] === 'string' && dataset[key].trim()) {
            return dataset[key];
          }
        }
      }
      const attrs = ['data-slg-lang', 'data-slg-locale', 'data-lang', 'data-locale', 'data-language'];
      for (let i = 0; i < attrs.length; i += 1) {
        const attr = attrs[i];
        const value = safeAccess(() =>
          typeof node.getAttribute === 'function' ? node.getAttribute(attr) : node[attr]
        );
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
      }
      return '';
    };

    const currentScript = safeAccess(() => documentRef.currentScript);
    const currentValue = pickFromNode(currentScript);
    if (currentValue) {
      return currentValue;
    }

    const scripts = safeAccess(() =>
      typeof documentRef.querySelectorAll === 'function'
        ? documentRef.querySelectorAll('script[data-slg-lang],script[data-lang],script[data-locale]')
        : null
    );
    if (scripts && typeof scripts.length === 'number') {
      for (let i = scripts.length - 1; i >= 0; i -= 1) {
        const value = pickFromNode(scripts[i]);
        if (value) {
          return value;
        }
      }
    }

    return '';
  };

  const readPathLanguageHint = (options, data) => {
    if (options && typeof options.pathLanguage === 'string') {
      return options.pathLanguage;
    }

    let segments = [];
    if (options && Array.isArray(options.pathSegments)) {
      segments = options.pathSegments.filter(Boolean);
    } else {
      const locationRef = options && options.location ? options.location : safeAccess(() => root.location);
      const pathname = locationRef && typeof locationRef.pathname === 'string' ? locationRef.pathname : '';
      if (pathname) {
        segments = pathname.split('/').filter(Boolean);
      }
    }

    if (!segments.length) {
      return '';
    }

    const parseSegment = (segment) => {
      if (!segment || typeof segment !== 'string') {
        return '';
      }
      const sanitized = segment.trim().replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').replace(/[_\s]+/g, '-');
      if (!/^[A-Za-z]{2,3}(-[A-Za-z]{2})?$/.test(sanitized)) {
        return '';
      }
      return sanitized;
    };

    const attempt = (segment) => {
      const candidate = parseSegment(segment);
      if (!candidate) {
        return '';
      }
      const normalized = normalizeLanguageCode(candidate);
      if (!normalized) {
        return '';
      }
      if (!data) {
        return candidate;
      }
      if (data[normalized]) {
        return candidate;
      }
      if (normalized.includes('-')) {
        const base = normalized.split('-')[0];
        if (data[base]) {
          return candidate;
        }
        const alias = LANGUAGE_ALIASES[normalized] || LANGUAGE_ALIASES[base];
        if (alias && data[alias]) {
          return candidate;
        }
      }
      const alias = LANGUAGE_ALIASES[normalized];
      if (alias && data[alias]) {
        return candidate;
      }
      return '';
    };

    const first = attempt(segments[0]);
    if (first) {
      return first;
    }

    if (segments.length > 1) {
      const combined = `${segments[0]}-${segments[1]}`;
      const combinedCandidate = attempt(combined);
      if (combinedCandidate) {
        return combinedCandidate;
      }
    }

    return '';
  };

  /**
   * Inferisce la lingua dal nome host, utilizzando ccTLD e sottodomini dedicati.
   * Utile quando gli header del browser sono oscurati da modalità privacy.
   */
  const readHostLanguageHint = (options, data) => {
    if (options && typeof options.hostLanguage === 'string') {
      return options.hostLanguage;
    }

    let hostname = '';
    if (options && typeof options.hostname === 'string') {
      hostname = options.hostname;
    } else if (options && typeof options.host === 'string') {
      hostname = options.host;
    } else {
      const locationRef = options && options.location ? options.location : safeAccess(() => root.location);
      if (locationRef) {
        if (typeof locationRef.hostname === 'string' && locationRef.hostname) {
          hostname = locationRef.hostname;
        } else if (typeof locationRef.host === 'string' && locationRef.host) {
          hostname = locationRef.host;
        }
      }
    }

    if (!hostname || typeof hostname !== 'string') {
      return '';
    }

    const sanitized = hostname.replace(/:\\d+$/, '').trim().toLowerCase();
    if (!sanitized || /^(\d{1,3}\.){3}\d{1,3}$/.test(sanitized)) {
      return '';
    }

    const segments = sanitized.split('.').filter(Boolean);
    if (!segments.length) {
      return '';
    }

    const attemptResolve = (candidate) => {
      if (!candidate) {
        return '';
      }
      const normalized = normalizeLanguageCode(candidate);
      if (!normalized || !/^[a-z]{2,3}(-[a-z]{2})?$/.test(normalized)) {
        return '';
      }
      if (!data) {
        return candidate;
      }
      const resolved = resolveCandidateLanguage(candidate, data);
      return resolved || candidate;
    };

    for (let i = 0; i < segments.length - 1; i += 1) {
      const token = segments[i];
      if (!token || HOST_LANGUAGE_IGNORED_TOKENS.has(token)) {
        continue;
      }
      const mapped = HOST_LANGUAGE_SUBDOMAIN_MAP[token] || token;
      const resolved = attemptResolve(mapped);
      if (resolved) {
        return resolved;
      }
    }

    const tld = segments[segments.length - 1];
    const mappedTld = HOST_LANGUAGE_TLD_MAP[tld];
    if (mappedTld) {
      const resolved = attemptResolve(mappedTld);
      if (resolved) {
        return resolved;
      }
    }

    return '';
  };

  const gatherLanguageHints = (options = {}, data) => {
    const paramName = options.paramName || 'lang';
    const defaultLang = options.defaultLanguage || DEFAULT_LANGUAGE;
    const seen = new Set();
    const hints = [];

    const register = (value, source) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach((item) => register(item, source));
        return;
      }
      if (typeof value !== 'string') {
        return;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }
      if (trimmed.includes(',') || trimmed.includes(';')) {
        trimmed.split(',').forEach((part) => {
          if (!part) return;
          const token = part.split(';')[0].trim();
          if (token) {
            register(token, source);
          }
        });
        return;
      }
      const normalized = normalizeLanguageCode(trimmed);
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      hints.push({ value: trimmed, normalized, source });
    };

    register(options.lang, 'explicit');

    const search =
      Object.prototype.hasOwnProperty.call(options, 'search')
        ? options.search
        : typeof root.location === 'object'
        ? root.location.search
        : '';
    register(parseQueryLanguage(search, paramName), 'query');

    register(readScriptLanguageHint(options), 'script');
    register(readPersistedLanguage(options), 'storage');
    register(readDocumentLanguage(options), 'document');
    register(readDatasetLanguage(options), 'dataset');
    register(collectMetaLanguages(options), 'meta');
    register(readPathLanguageHint(options, data), 'path');
    register(readHostLanguageHint(options, data), 'host');
    register(collectNavigatorLanguages(options), 'navigator');
    register(readIntlLocale(options), 'intl');

    if (options && Array.isArray(options.additionalHints)) {
      options.additionalHints.forEach((hint) => register(hint, 'additional'));
    } else if (options && typeof options.additionalHints === 'string') {
      register(options.additionalHints, 'additional');
    }

    register(defaultLang, 'default');
    if (defaultLang !== DEFAULT_LANGUAGE) {
      register(DEFAULT_LANGUAGE, 'fallback');
    }

    return hints;
  };

  const collectLanguageContext = (options = {}) => {
    const data = ensureCatalog();
    const hints = gatherLanguageHints(options, data);
    const resolved = [];
    const resolvedSet = new Set();

    for (let i = 0; i < hints.length; i += 1) {
      const hint = hints[i];
      const resolvedDisplay = resolveCandidateLanguage(hint.value, data);
      if (!resolvedDisplay) {
        continue;
      }
      const normalizedResolved = normalizeLanguageCode(resolvedDisplay);
      if (!normalizedResolved || resolvedSet.has(normalizedResolved)) {
        continue;
      }
      resolvedSet.add(normalizedResolved);
      resolved.push({
        language: resolvedDisplay,
        normalized: normalizedResolved,
        source: hint.source
      });
    }

    if (!resolved.length) {
      const fallback = formatDisplayLanguage(DEFAULT_LANGUAGE);
      const normalizedFallback = normalizeLanguageCode(fallback) || DEFAULT_LANGUAGE;
      resolved.push({
        language: fallback,
        normalized: normalizedFallback,
        source: 'fallback'
      });
    }

    return {
      language: resolved[0].language,
      languages: resolved.map((entry) => entry.language),
      sources: resolved.map((entry) => ({ language: entry.language, source: entry.source })),
      rawHints: hints
    };
  };

  const detectLanguage = (options = {}) => collectLanguageContext(options).language;

  const notifyLanguageChange = () => {
    if (!listeners.length) return;
    const translator = getTranslator();
    listeners.forEach((cb) => {
      try {
        cb(activeLanguage, translator);
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[SafeLinkGuard] Listener lingua fallito', err);
        }
      }
    });
  };

  const setLanguage = (lang) => {
    const target = findBestLanguage(lang);
    if (activeLanguageNormalized === target && activeLanguage) {
      return activeLanguage;
    }
    activeLanguageNormalized = target;
    activeLanguage = formatDisplayLanguage(target);
    activeTranslator = buildTranslator(target);
    notifyLanguageChange();
    return activeLanguage;
  };

  const registerLanguage = (lang, dictionary, options = {}) => {
    if (!lang || typeof dictionary !== 'object') return;
    const normalized = normalizeLanguageCode(lang);
    const data = ensureCatalog();
    const resolvedKey = resolveAlias(normalized, data) || normalized;
    const merged = mergeDeep(data[resolvedKey] ? data[resolvedKey] : {}, dictionary);
    data[resolvedKey] = merged;
    translatorCache.delete(resolvedKey);
    if (activeLanguageNormalized === resolvedKey && !options.makeActive) {
      activeTranslator = buildTranslator(activeLanguageNormalized);
      notifyLanguageChange();
    }
    if (options.makeActive) {
      setLanguage(resolvedKey);
    }
  };

  const onLanguageChange = (callback) => {
    if (typeof callback !== 'function') return () => {};
    listeners.push(callback);
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  };

  const getTranslator = () => {
    if (!activeTranslator) {
      const detected = detectLanguage();
      setLanguage(detected);
    }
    return activeTranslator;
  };

  const getAvailableLanguages = () => Object.keys(ensureCatalog());

  const evaluateTranslation = (translator, key, replacements, fallbackKey) => {
    if (!key || typeof key !== 'string') {
      return '';
    }
    const primary = translator.t(key, replacements);
    if (primary !== key || !fallbackKey || fallbackKey === key) {
      return primary;
    }
    return translator.t(fallbackKey, replacements);
  };

  const resolveReplacements = (source, descriptor, translator, context = {}) => {
    if (source == null) {
      source = descriptor.replacements;
    }
    if (typeof source === 'function') {
      return source({ descriptor, translator, ...context });
    }
    return source;
  };

  const parseAttributeMapping = (value) => {
    if (!value || typeof value !== 'string') {
      return null;
    }
    const attrs = {};
    value.split(/[,;]+/).forEach((pair) => {
      const trimmed = pair.trim();
      if (!trimmed) return;
      const parts = trimmed.split(':');
      if (parts.length < 2) return;
      const name = parts[0].trim();
      const key = parts.slice(1).join(':').trim();
      if (name && key) {
        attrs[name] = { key };
      }
    });
    return Object.keys(attrs).length ? attrs : null;
  };

  const normaliseAttributes = (input) => {
    if (!input || typeof input !== 'object') {
      return null;
    }
    const attrs = {};
    Object.keys(input).forEach((name) => {
      const value = input[name];
      if (typeof value === 'string') {
        attrs[name] = { key: value };
      } else if (value && typeof value === 'object' && typeof value.key === 'string') {
        attrs[name] = {
          key: value.key,
          fallbackKey: typeof value.fallbackKey === 'string' ? value.fallbackKey : null,
          replacements: value.replacements || null,
          transform: typeof value.transform === 'function' ? value.transform : null
        };
      }
    });
    return Object.keys(attrs).length ? attrs : null;
  };

  const normaliseDescriptor = (input) => {
    if (!input) {
      return null;
    }
    const node = input.node || (typeof input.getNode === 'function' ? input.getNode() : null);
    if (!node) {
      return null;
    }
    return {
      node,
      key: typeof input.key === 'string' ? input.key : null,
      fallbackKey: typeof input.fallbackKey === 'string' ? input.fallbackKey : null,
      html: Boolean(input.html),
      property: typeof input.property === 'string' ? input.property : null,
      replacements: input.replacements || null,
      transform: typeof input.transform === 'function' ? input.transform : null,
      shouldRender: typeof input.shouldRender === 'function' ? input.shouldRender : null,
      attributes: normaliseAttributes(
        input.attributes || (typeof input.attribute === 'object' ? input.attribute : null)
      )
    };
  };

  const applyTextDescriptor = (descriptor, translator) => {
    if (!descriptor.key) {
      return;
    }
    const replacements = resolveReplacements(null, descriptor, translator, { target: 'text' });
    let value = evaluateTranslation(
      translator,
      descriptor.key,
      replacements,
      descriptor.fallbackKey
    );
    if (descriptor.transform) {
      value = descriptor.transform(value, {
        node: descriptor.node,
        descriptor,
        translator,
        target: 'text'
      });
    }
    const node = descriptor.node;
    if (descriptor.property && descriptor.property in node) {
      node[descriptor.property] = value;
    } else if (descriptor.html && typeof node.innerHTML === 'string') {
      node.innerHTML = value;
    } else if (typeof node.textContent === 'string') {
      node.textContent = value;
    } else if (typeof node.nodeValue === 'string') {
      node.nodeValue = value;
    } else if ('value' in node) {
      node.value = value;
    }
  };

  const applyAttributeDescriptors = (descriptor, translator) => {
    if (!descriptor.attributes) {
      return;
    }
    const node = descriptor.node;
    Object.keys(descriptor.attributes).forEach((name) => {
      const attrDescriptor = descriptor.attributes[name];
      if (!attrDescriptor || typeof attrDescriptor.key !== 'string') {
        return;
      }
      const replacements = resolveReplacements(
        attrDescriptor.replacements,
        descriptor,
        translator,
        { target: 'attribute', attribute: name }
      );
      let value = evaluateTranslation(
        translator,
        attrDescriptor.key,
        replacements,
        attrDescriptor.fallbackKey || descriptor.fallbackKey
      );
      const transform = attrDescriptor.transform || descriptor.transform;
      if (transform) {
        value = transform(value, {
          node,
          descriptor,
          translator,
          target: 'attribute',
          attribute: name
        });
      }
      if (typeof node.setAttribute === 'function') {
        node.setAttribute(name, value);
      } else if (node.attributes && typeof node.attributes === 'object') {
        node.attributes[name] = value;
      } else {
        node[name] = value;
      }
    });
  };

  const renderDescriptor = (descriptor, translator) => {
    if (!descriptor || !descriptor.node) {
      return;
    }
    if (descriptor.shouldRender && !descriptor.shouldRender(descriptor, translator)) {
      return;
    }
    applyTextDescriptor(descriptor, translator);
    applyAttributeDescriptors(descriptor, translator);
  };

  // Renderer dichiarativo per collegare nodi del DOM (o oggetti compatibili)
  // ai cataloghi di traduzione. Gestisce binding iniziali, aggiornamenti
  // reattivi ai cambi lingua e supporta descriptor personalizzati.
  const createContentRenderer = (options = {}) => {
    const descriptors = [];
    const boundNodes = new WeakSet();
    const root = options.root || (typeof document !== 'undefined' ? document : null);
    const watch = options.watch !== false;
    const autoBind = options.autoBind !== false;
    const renderInitial = options.renderInitial !== false;

    const addDescriptor = (input) => {
      const normalized = normaliseDescriptor(input);
      if (!normalized) {
        return null;
      }
      descriptors.push(normalized);
      return () => {
        const index = descriptors.indexOf(normalized);
        if (index >= 0) {
          descriptors.splice(index, 1);
        }
      };
    };

    const bindFromNode = (node) => {
      if (!node || boundNodes.has(node)) {
        return;
      }
      const getAttr = (name) => {
        if (typeof node.getAttribute === 'function') {
          return node.getAttribute(name);
        }
        return null;
      };
      const hasAttr = (name) => {
        if (typeof node.hasAttribute === 'function') {
          return node.hasAttribute(name);
        }
        return false;
      };
      const descriptor = { node };
      const key = getAttr('data-slg-i18n');
      if (key) {
        descriptor.key = key;
      }
      const fallbackKey = getAttr('data-slg-i18n-fallback');
      if (fallbackKey) {
        descriptor.fallbackKey = fallbackKey;
      }
      if (hasAttr('data-slg-i18n-html')) {
        descriptor.html = true;
      }
      const attrMappings = parseAttributeMapping(getAttr('data-slg-i18n-attr'));
      if (attrMappings) {
        descriptor.attributes = attrMappings;
      }
      if (!descriptor.key && !descriptor.attributes) {
        return;
      }
      boundNodes.add(node);
      addDescriptor(descriptor);
    };

    const SELECTOR = '[data-slg-i18n], [data-slg-i18n-attr]';

    const autoBindNodes = () => {
      if (!autoBind || !root || typeof root.querySelectorAll !== 'function') {
        return;
      }
      if (typeof root.matches === 'function' && root.matches(SELECTOR)) {
        bindFromNode(root);
      }
      const nodes = root.querySelectorAll(SELECTOR);
      nodes.forEach(bindFromNode);
    };

    if (Array.isArray(options.descriptors)) {
      options.descriptors.forEach((descriptor) => {
        addDescriptor(descriptor);
      });
    }

    autoBindNodes();

    const render = () => {
      const translator = getTranslator();
      descriptors.forEach((descriptor) => {
        renderDescriptor(descriptor, translator);
      });
    };

    let unsubscribe = null;
    if (watch) {
      unsubscribe = onLanguageChange(() => {
        render();
      });
    }

    if (renderInitial) {
      if (pendingLoad) {
        pendingLoad
          .then(() => {
            render();
          })
          .catch(() => {
            render();
          });
      } else {
        render();
      }
    }

    return {
      render,
      refresh() {
        autoBindNodes();
        render();
      },
      register(descriptor) {
        const remove = addDescriptor(descriptor);
        if (!remove) {
          return () => {};
        }
        render();
        return () => {
          remove();
        };
      },
      disconnect() {
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        descriptors.splice(0, descriptors.length);
      },
      get size() {
        return descriptors.length;
      }
    };
  };

  const api = {
    DEFAULT_LANGUAGE,
    collectLanguageContext,
    detectLanguage,
    getAvailableLanguages,
    getDictionary(lang) {
      return deepClone(fetchDictionary(lang));
    },
    getLanguage() {
      return activeLanguage || DEFAULT_LANGUAGE;
    },
    getTranslator,
    onLanguageChange,
    registerLanguage,
    setLanguage,
    /**
     * Espone una promise che si risolve quando eventuali preload in corso terminano.
     */
    whenReady() {
      if (pendingLoad) {
        return pendingLoad.then(() => getTranslator());
      }
      return Promise.resolve(getTranslator());
    },
    /**
     * Permette di precaricare un bundle di traduzioni (oggetto, Promise o factory).
     * Restituisce una Promise risolta con il traduttore pronto all'uso.
     */
    loadTranslations(source) {
      let loader;
      if (typeof source === 'function') {
        try {
          loader = source();
        } catch (err) {
          loader = Promise.reject(err);
        }
      } else {
        loader = source;
      }

      let loadPromise;
      if (!loader) {
        loadPromise = Promise.reject(new Error('No translation source provided'));
      } else if (typeof loader.then === 'function') {
        loadPromise = loader.then((data) => {
          const base = loadBaseCatalog();
          rebuildCatalog(base, data);
          sourceRefs = { base, preload: guardNamespace.preloadedTranslations };
          return getTranslator();
        });
      } else if (typeof loader === 'object') {
        loadPromise = Promise.resolve(loader).then((data) => {
          const base = loadBaseCatalog();
          rebuildCatalog(base, data);
          sourceRefs = { base, preload: guardNamespace.preloadedTranslations };
          return getTranslator();
        });
      } else {
        loadPromise = Promise.reject(new Error('Unsupported translation source type'));
      }

      pendingLoad = loadPromise
        .catch((err) => {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[SafeLinkGuard] Unable to preload translations', err);
          }
          // Garantisce comunque la disponibilità del traduttore anche in caso di errore.
          const base = loadBaseCatalog();
          const preload = loadPreloadedCatalog();
          rebuildCatalog(base, preload);
          sourceRefs = { base, preload: guardNamespace.preloadedTranslations };
          return getTranslator();
        })
        .finally(() => {
          const translator = getTranslator();
          pendingLoad = null;
          return translator;
        });

      return pendingLoad;
    },
    createContentRenderer,
    t(key, replacements) {
      return getTranslator().t(key, replacements);
    }
  };

  guardNamespace.i18n = api;

  // Inizializzazione eager per evitare flash di lingua errata.
  const initialLanguage = detectLanguage();
  setLanguage(initialLanguage);

  return { SafeExternalLinksGuard: guardNamespace };
});
