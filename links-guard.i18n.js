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
    pt: 'pt'
  };
  // Alias aggiuntivi per normalizzare varianti regionali o codici legacy.
  const LANGUAGE_ALIASES = {
    'pt-pt': 'pt',
    br: 'pt-br'
  };

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
  let activeLanguageNormalized = null;
  let activeTranslator = null;
  const listeners = [];
  const translatorCache = new Map();
  let sourceRefs = { base: null, preload: null };
  let pendingLoad = null;

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
      const resolved = resolveAlias(normalized, data);
      if (resolved) return formatDisplayLanguage(resolved);
      if (available.includes(normalized)) return formatDisplayLanguage(normalized);
      if (normalized.includes('-')) {
        const base = normalized.split('-')[0];
        if (available.includes(base)) return formatDisplayLanguage(base);
      }
      if (normalized === 'br' && available.includes('pt-br')) {
        return formatDisplayLanguage('pt-br');
      }
    }

    return formatDisplayLanguage(DEFAULT_LANGUAGE);
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
