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

  // Catalogo di fallback per garantire sempre la disponibilità della lingua inglese
  // e delle lingue predefinite anche quando i file JSON non sono accessibili.
  const FALLBACK_TRANSLATIONS = {
    en: {
      messages: {
        defaultWarn:
          'This link is not verified and may share your browsing data with a third-party site. Make sure the destination is trustworthy before continuing.'
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
          'Questo link non è verificato e può contenere dati della tua navigazione che saranno condivisi con un sito di terzi. Prima di procedere, assicurati che il link sia affidabile.'
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
          'Este enlace no está verificado y puede compartir tus datos de navegación con un sitio de terceros. Antes de continuar, asegúrate de que el destino sea de confianza.'
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
          "Ce lien n'est pas vérifié et peut partager vos données de navigation avec un site tiers. Avant de continuer, assurez-vous que la destination est fiable."
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
          'Dieser Link ist nicht verifiziert und könnte Ihre Browserdaten mit einer Drittseite teilen. Stellen Sie vor dem Fortfahren sicher, dass das Ziel vertrauenswürdig ist.'
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
          'Esta ligação não está verificada e pode partilhar os seus dados de navegação com um site de terceiros. Antes de continuar, confirme que o destino é de confiança.'
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
          'Este link não está verificado e pode compartilhar seus dados de navegação com um site de terceiros. Antes de continuar, confirme que o destino é confiável.'
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
          'Эта ссылка не проверена и может передавать ваши данные просмотра стороннему сайту. Прежде чем продолжить, убедитесь, что назначение надежно.'
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
  let activeTranslator = null;
  const listeners = [];
  const translatorCache = new Map();

  const normalizeLanguageCode = (lang) => {
    if (!lang || typeof lang !== 'string') return '';
    return lang.trim().toLowerCase().replace('_', '-');
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

  const ensureCatalog = () => {
    if (catalog) return catalog;
    let source = null;
    if (typeof module === 'object' && module.exports) {
      try {
        // eslint-disable-next-line global-require
        source = require('./app/Services/Localization/translationRegistry.js');
      } catch (err) {
        source = null;
      }
    }
    const globalData =
      guardNamespace.preloadedTranslations || root.SafeExternalLinksGuardTranslations;
    const base = source || globalData || FALLBACK_TRANSLATIONS;
    catalog = mergeDeep({}, base);
    if (!catalog[DEFAULT_LANGUAGE]) {
      catalog[DEFAULT_LANGUAGE] = deepClone(FALLBACK_TRANSLATIONS[DEFAULT_LANGUAGE]);
    }
    return catalog;
  };

  const fetchDictionary = (lang) => {
    const data = ensureCatalog();
    const normalized = normalizeLanguageCode(lang);
    if (normalized && data[normalized]) {
      return data[normalized];
    }
    if (normalized && normalized.includes('-')) {
      const base = normalized.split('-')[0];
      if (data[base]) return data[base];
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

  const buildTranslator = (lang) => {
    if (translatorCache.has(lang)) {
      return translatorCache.get(lang);
    }
    const translator = {
      language: lang,
      dictionary: deepClone(fetchDictionary(lang)),
      has(key) {
        return resolveKey(lang, key) != null;
      },
      t(key, replacements) {
        const resolved = resolveKey(lang, key);
        const text = resolved != null ? resolved : key;
        return applyReplacements(text, replacements);
      }
    };
    translatorCache.set(lang, translator);
    return translator;
  };

  const findBestLanguage = (lang) => {
    const data = ensureCatalog();
    const normalized = normalizeLanguageCode(lang);
    if (!normalized) return DEFAULT_LANGUAGE;
    if (data[normalized]) return normalized;
    const base = normalized.split('-')[0];
    if (data[base]) return base;
    return DEFAULT_LANGUAGE;
  };

  const parseQueryLanguage = (search, paramName) => {
    if (!search || typeof search !== 'string') return '';
    const query = search.startsWith('?') ? search.substring(1) : search;
    const params = new URLSearchParams(query);
    return params.get(paramName) || '';
  };

  const detectLanguage = (options = {}) => {
    const data = ensureCatalog();
    const available = Object.keys(data);
    const paramName = options.paramName || 'lang';
    const defaultLang = options.defaultLanguage || DEFAULT_LANGUAGE;
    const candidates = [];

    if (options.lang) {
      candidates.push(options.lang);
    }

    const search =
      Object.prototype.hasOwnProperty.call(options, 'search')
        ? options.search
        : typeof root.location === 'object'
        ? root.location.search
        : '';
    const queryLang = parseQueryLanguage(search, paramName);
    if (queryLang) candidates.push(queryLang);

    const navigatorLanguages = options.navigatorLanguages
      ? options.navigatorLanguages
      : typeof root.navigator !== 'undefined'
      ? root.navigator.languages || [root.navigator.language]
      : [];

    if (Array.isArray(navigatorLanguages)) {
      navigatorLanguages.forEach((langCode) => {
        if (langCode) candidates.push(langCode);
      });
    }

    candidates.push(defaultLang);

    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      const normalized = normalizeLanguageCode(candidate);
      if (!normalized) continue;
      if (available.includes(normalized)) return normalized;
      const base = normalized.split('-')[0];
      if (available.includes(base)) return base;
      if (normalized === 'br' && available.includes('pt-br')) return 'pt-br';
      if (normalized === 'pt' && available.includes('pt')) return 'pt';
    }

    return DEFAULT_LANGUAGE;
  };

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
    const next = findBestLanguage(lang);
    if (activeLanguage === next) return activeLanguage;
    activeLanguage = next;
    activeTranslator = buildTranslator(next);
    notifyLanguageChange();
    return activeLanguage;
  };

  const registerLanguage = (lang, dictionary, options = {}) => {
    if (!lang || typeof dictionary !== 'object') return;
    const normalized = normalizeLanguageCode(lang);
    const data = ensureCatalog();
    const merged = mergeDeep(data[normalized] ? data[normalized] : {}, dictionary);
    data[normalized] = merged;
    translatorCache.delete(normalized);
    if (activeLanguage === normalized && !options.makeActive) {
      activeTranslator = buildTranslator(activeLanguage);
      notifyLanguageChange();
    }
    if (options.makeActive) {
      setLanguage(normalized);
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

  const api = {
    DEFAULT_LANGUAGE,
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
