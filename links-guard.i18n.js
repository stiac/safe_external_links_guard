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
      render();
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
