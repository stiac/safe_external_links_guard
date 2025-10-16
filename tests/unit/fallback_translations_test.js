const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const scriptSource = fs.readFileSync(
  path.resolve(__dirname, '../../links-guard.js'),
  'utf8'
);

const storageFactory = () => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
});

class URLMock {
  constructor(input, base) {
    const fallback = typeof base === 'string' ? base : 'https://example.com/';
    const href = input || fallback;
    this.href = href;
    this.protocol = href.includes(':') ? `${href.split(':')[0]}:` : 'https:';
    this.host = 'example.com';
    this.hostname = 'example.com';
    this.pathname = '/';
    this.search = '';
    this.hash = '';
    this.origin = `${this.protocol}//${this.host}`;
  }
}

class URLSearchParamsMock {
  constructor(init) {
    this.store = new Map();
    const source = typeof init === 'string' ? init : '';
    const trimmed = source.startsWith('?') ? source.slice(1) : source;
    if (trimmed) {
      trimmed.split('&').forEach((pair) => {
        if (!pair) return;
        const parts = pair.split('=');
        const key = decodeURIComponent(parts[0]);
        const value = parts.length > 1 ? decodeURIComponent(parts[1]) : '';
        this.store.set(key, value);
      });
    }
  }

  get(name) {
    return this.store.has(name) ? this.store.get(name) : null;
  }

  set(name, value) {
    this.store.set(String(name), String(value));
  }

  append(name, value) {
    this.set(name, value);
  }

  delete(name) {
    this.store.delete(name);
  }

  toString() {
    const parts = [];
    this.store.forEach((value, key) => {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    });
    return parts.join('&');
  }
}

const createContext = (options) => {
  const preferred = options && options.preferred ? options.preferred : '';
  const navigatorLanguages =
    options && Array.isArray(options.navigatorLanguages)
      ? options.navigatorLanguages
      : [];

  const currentScript = {
    dataset: {},
    getAttribute: () => null,
    hasAttribute: () => false
  };

  const documentElement = {
    lang: preferred,
    classList: { contains: () => false, add: () => {}, remove: () => {} },
    getAttribute: () => null,
    removeAttribute: () => {},
    hasAttribute: () => false
  };

  const body = {
    appendChild: () => {},
    removeChild: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: () => {}, removeProperty: () => {} },
    getBoundingClientRect: () => ({
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      right: 0,
      bottom: 0
    }),
    clientWidth: 0,
    offsetWidth: 0,
    scrollWidth: 0
  };

  const head = {
    appendChild: () => {},
    removeChild: () => {}
  };

  const document = {
    currentScript,
    documentElement,
    body,
    head,
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({
      setAttribute: () => {},
      removeAttribute: () => {},
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      cloneNode: () => ({})
    }),
    getElementsByTagName: () => [currentScript]
  };

  const navigator = {
    languages: navigatorLanguages,
    language: preferred,
    clipboard: null,
    userAgent: 'SafeExternalLinksGuard/Test'
  };

  const context = {
    document,
    navigator,
    location: {
      href: 'https://example.com/',
      host: 'example.com',
      hostname: 'example.com',
      origin: 'https://example.com',
      protocol: 'https:',
      pathname: '/',
      search: '',
      hash: ''
    },
    SafeExternalLinksGuard: {},
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout: (fn) => {
      if (typeof fn === 'function') fn();
      return 0;
    },
    clearTimeout: () => {},
    requestAnimationFrame: (fn) => {
      if (typeof fn === 'function') fn();
      return 0;
    },
    cancelAnimationFrame: () => {},
    MutationObserver: function () {
      this.observe = () => {};
      this.disconnect = () => {};
    },
    IntersectionObserver: function () {
      this.observe = () => {};
      this.unobserve = () => {};
      this.disconnect = () => {};
    },
    URL: URLMock,
    URLSearchParams: URLSearchParamsMock,
    Node: { TEXT_NODE: 3 },
    performance: { now: () => 0 },
    crypto: {
      randomUUID: () => '00000000-0000-4000-8000-000000000000',
      getRandomValues: (buffer) => {
        if (!buffer || typeof buffer.length !== 'number') {
          return buffer;
        }
        for (let i = 0; i < buffer.length; i += 1) {
          buffer[i] = (i + 1) % 255;
        }
        return buffer;
      }
    },
    localStorage: storageFactory(),
    sessionStorage: storageFactory(),
    Intl,
    getComputedStyle: () => ({ getPropertyValue: () => '0px' })
  };

  context.window = context;
  context.self = context;
  context.globalThis = context;
  context.addEventListener = () => {};
  context.removeEventListener = () => {};

  return context;
};

const loadGuard = (options) => {
  const context = createContext(options || {});
  vm.runInNewContext(scriptSource, context, { filename: 'links-guard.js' });
  return context.SafeExternalLinksGuard;
};

const run = () => {
  const guard = loadGuard({
    preferred: 'it-IT',
    navigatorLanguages: ['it-IT', 'en-US']
  });

  const fallbackIt = guard.__internals.resolveFallbackText('modal.openButton');
  assert.strictEqual(
    fallbackIt,
    'Apri link',
    'Il fallback runtime deve restituire la traduzione italiana per modal.openButton'
  );

  const fallbackRu = guard.__internals.resolveFallbackText(
    'messages.denyDefault',
    null,
    'ru-RU'
  );
  assert.strictEqual(
    fallbackRu,
    'Домен заблокирован. Действуйте с осторожностью.',
    'Il fallback deve supportare la variante russa quando fornita esplicitamente'
  );

  const guardNoLang = loadGuard({ preferred: '', navigatorLanguages: [] });
  const fallbackUnknown = guardNoLang.__internals.resolveFallbackText(
    'modal.copyButton',
    null,
    'sv-SE'
  );
  assert.strictEqual(
    fallbackUnknown,
    'Copy link',
    'Lingue non coperte devono utilizzare il fallback inglese'
  );

  console.log('fallback_translations_test: OK');
};

run();
