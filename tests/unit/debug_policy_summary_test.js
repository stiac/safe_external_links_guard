const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const scriptSource = fs.readFileSync(
  path.resolve(__dirname, '../../links-guard.js'),
  'utf8'
);

// Element stub che implementa le API minime usate dallo script runtime.
class ElementStub {
  constructor(tagName) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.eventListeners = {};
    this.style = { setProperty: () => {}, removeProperty: () => {} };
    this._innerHTML = '';
    this._textContent = '';
    this.className = '';
    const updateClassName = (updater) => {
      const current = new Set(
        this.className
          .split(/\s+/)
          .map((cls) => cls.trim())
          .filter(Boolean)
      );
      updater(current);
      this.className = Array.from(current).join(' ');
    };
    this.classList = {
      add: (...names) => updateClassName((set) => names.forEach((n) => set.add(n))),
      remove: (...names) => updateClassName((set) => names.forEach((n) => set.delete(n))),
      contains: (name) =>
        this.className
          .split(/\s+/)
          .map((cls) => cls.trim())
          .filter(Boolean)
          .includes(name),
      toggle: (name, force) => {
        if (force === true) {
          updateClassName((set) => set.add(name));
          return true;
        }
        if (force === false) {
          updateClassName((set) => set.delete(name));
          return false;
        }
        if (this.classList.contains(name)) {
          updateClassName((set) => set.delete(name));
          return false;
        }
        updateClassName((set) => set.add(name));
        return true;
      }
    };
    Object.defineProperty(this, 'innerHTML', {
      get: () => this._innerHTML,
      set: (value) => {
        this._innerHTML = String(value || '');
        if (!this.children.length) {
          this._textContent = String(value || '');
        }
      }
    });
    Object.defineProperty(this, 'textContent', {
      get: () => this._textContent,
      set: (value) => {
        this._textContent = String(value || '');
        this._innerHTML = String(value || '');
      }
    });
  }

  setAttribute(name, value) {
    const normalized = String(name);
    this.attributes.set(normalized, String(value));
    if (normalized === 'href') {
      this.href = String(value);
    }
    if (normalized === 'rel') {
      this.rel = String(value);
    }
    if (normalized === 'class') {
      this.className = String(value);
    }
    if (normalized.startsWith('data-')) {
      const key = normalized
        .slice(5)
        .split('-')
        .map((part, index) =>
          index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
        )
        .join('');
      this.dataset[key] = String(value);
    }
  }

  getAttribute(name) {
    if (this.attributes.has(name)) {
      return this.attributes.get(name);
    }
    if (name === 'href' && this.href) {
      return this.href;
    }
    if (name === 'rel' && this.rel) {
      return this.rel;
    }
    if (name === 'title' && this.attributes.has('title')) {
      return this.attributes.get('title');
    }
    return null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'href') {
      delete this.href;
    }
    if (name === 'rel') {
      delete this.rel;
    }
    if (name.startsWith('data-')) {
      const key = name
        .slice(5)
        .split('-')
        .map((part, index) =>
          index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
        )
        .join('');
      delete this.dataset[key];
    }
  }

  appendChild(child) {
    if (!child || typeof child !== 'object') {
      return child;
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index === -1) {
      return child;
    }
    this.children.splice(index, 1);
    if (child && typeof child === 'object') {
      child.parentNode = null;
    }
    return child;
  }

  replaceChild(newChild, oldChild) {
    const index = this.children.indexOf(oldChild);
    if (index === -1) {
      return oldChild;
    }
    if (newChild && typeof newChild === 'object') {
      newChild.parentNode = this;
      this.children[index] = newChild;
    } else {
      this.children.splice(index, 1);
    }
    if (oldChild && typeof oldChild === 'object') {
      oldChild.parentNode = null;
    }
    return oldChild;
  }

  addEventListener(type, handler) {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    if (!this.eventListeners[type]) {
      return;
    }
    this.eventListeners[type] = this.eventListeners[type].filter((fn) => fn !== handler);
  }

  querySelectorAll(selector) {
    const results = [];
    this.children.forEach((child) => {
      if (child.matches && child.matches(selector)) {
        results.push(child);
      }
      if (typeof child.querySelectorAll === 'function') {
        results.push(...child.querySelectorAll(selector));
      }
    });
    return results;
  }

  matches(selector) {
    if (selector === 'a[href]') {
      return this.tagName === 'A' && Boolean(this.getAttribute('href'));
    }
    if (selector === 'a[href]:not([data-safe-link-guard])') {
      return (
        this.tagName === 'A' &&
        Boolean(this.getAttribute('href')) &&
        this.dataset.safeLinkGuard !== '1' &&
        this.dataset.safeLinkGuard !== 'modal'
      );
    }
    if (selector === '[data-slg-root]') {
      return Boolean(this.dataset && this.dataset.slgRoot);
    }
    return false;
  }

  querySelector(selector) {
    const matches = this.querySelectorAll(selector);
    return matches.length ? matches[0] : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  cloneNode() {
    const clone = new ElementStub(this.tagName);
    clone.className = this.className;
    clone._innerHTML = this._innerHTML;
    clone._textContent = this._textContent;
    clone.href = this.href;
    clone.rel = this.rel;
    this.attributes.forEach((value, key) => {
      clone.attributes.set(key, value);
    });
    clone.dataset = { ...this.dataset };
    return clone;
  }

  getBoundingClientRect() {
    return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 };
  }

  get isConnected() {
    return Boolean(this.parentNode);
  }
}

class AbortControllerMock {
  constructor() {
    this.signal = {
      aborted: false,
      reason: undefined,
      listeners: [],
      addEventListener: (type, listener) => {
        if (type === 'abort') {
          this.signal.listeners.push(listener);
        }
      }
    };
  }

  abort(reason) {
    this.signal.aborted = true;
    this.signal.reason = reason;
    this.signal.listeners.forEach((listener) => {
      try {
        listener({ type: 'abort' });
      } catch (err) {
        // Ignoriamo eventuali eccezioni nel listener di test.
      }
    });
  }
}

const createStorage = () => ({
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
    const hostPart = href.replace(/^https?:\/\//, '').split('/')[0] || 'example.com';
    this.host = hostPart.toLowerCase();
    this.hostname = this.host;
    this.origin = `${this.protocol}//${this.host}`;
    this.pathname = '/';
    this.search = '';
    this.hash = '';
  }
}

class URLSearchParamsMock {
  constructor(query) {
    this.store = new Map();
    const source = typeof query === 'string' ? query : '';
    const normalized = source.startsWith('?') ? source.slice(1) : source;
    if (!normalized) {
      return;
    }
    normalized.split('&').forEach((pair) => {
      if (!pair) {
        return;
      }
      const [key, value] = pair.split('=');
      this.store.set(decodeURIComponent(key), value ? decodeURIComponent(value) : '');
    });
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
    return Array.from(this.store.entries())
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }
}

const createContext = () => {
  const html = new ElementStub('html');
  const head = new ElementStub('head');
  const body = new ElementStub('body');
  html.appendChild(head);
  html.appendChild(body);

  const anchorWrapper = new ElementStub('div');
  const anchor = new ElementStub('a');
  anchor.setAttribute('href', 'https://malware.test/phishing');
  anchor.textContent = 'Visita il sito';
  anchorWrapper.appendChild(anchor);
  body.appendChild(anchorWrapper);

  const currentScriptAttributes = new Map([
    ['data-endpoint', '/links/policy'],
    ['data-remove-node', 'true'],
    ['data-debug-mode', 'true'],
    ['data-debug-level', 'verbose']
  ]);

  const currentScript = {
    dataset: {},
    getAttribute: (name) => (currentScriptAttributes.has(name) ? currentScriptAttributes.get(name) : null),
    hasAttribute: (name) => currentScriptAttributes.has(name)
  };

  const timers = new Map();
  let timerId = 0;

  const context = {
    document: {
      currentScript,
      documentElement: html,
      head,
      body,
      readyState: 'complete',
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: (tag) => new ElementStub(tag),
      querySelectorAll: (selector) => html.querySelectorAll(selector),
      getElementsByTagName: (tag) => (tag === 'script' ? [currentScript] : []),
      getElementById: () => null,
      getElementsByClassName: () => [],
      querySelector: () => null
    },
    window: null,
    self: null,
    globalThis: null,
    navigator: {
      languages: ['it-IT', 'en-US'],
      language: 'it-IT',
      clipboard: null,
      userAgent: 'SafeExternalLinksGuard/Test'
    },
    location: {
      href: 'https://app.test/dashboard',
      host: 'app.test',
      hostname: 'app.test',
      origin: 'https://app.test',
      protocol: 'https:',
      pathname: '/',
      search: '',
      hash: ''
    },
    SafeExternalLinksGuard: {},
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout: (fn, delay) => {
      timerId += 1;
      if (typeof fn === 'function') {
        timers.set(timerId, fn);
      }
      return timerId;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
    requestAnimationFrame: (fn) => {
      if (typeof fn === 'function') {
        fn();
      }
      return 1;
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
    AbortController: AbortControllerMock,
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
          buffer[i] = (i + 13) % 255;
        }
        return buffer;
      }
    },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    Intl,
    fetch: () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          action: 'deny',
          ttl: 120,
          message: { text: 'Blocked via policy' },
          analysis: { reason: 'blacklist', category: 'phishing' }
        })
      }),
    getComputedStyle: () => ({ getPropertyValue: () => '0px' }),
    scrollX: 0,
    scrollY: 0
  };

  context.window = context;
  context.self = context;
  context.globalThis = context;
  context.addEventListener = () => {};
  context.removeEventListener = () => {};

  return { context, anchor };
};

const run = async () => {
  const { context } = createContext();
  vm.runInNewContext(scriptSource, context, { filename: 'links-guard.js' });

  const guard = context.SafeExternalLinksGuard;
  assert(guard, 'SafeExternalLinksGuard deve essere esposto nel contesto globale');
  assert(guard.debug, 'Il namespace debug deve essere disponibile in modalità test');

  // Attende il completamento della policy queue asincrona.
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  const entries = guard.debug.getEntries();
  const policyEvent = entries.find((entry) => entry.message === 'Policy applicata');
  assert(policyEvent, "Il log 'Policy applicata' deve essere presente");
  assert(policyEvent.details, 'I dettagli del log devono essere disponibili');

  const samples = policyEvent.details.sampleAnchors;
  assert(Array.isArray(samples) && samples.length > 0, 'Devono essere presenti campioni di ancoraggi');

  const deniedSample = samples.find((sample) => sample.tag === 'span' && sample.state);
  // Il campione deve descrivere il link trasformato in `<span>` con tutti i metadati utili.
  assert(deniedSample, 'I link rimossi devono essere tracciati nei campioni di debug');

  assert.strictEqual(
    deniedSample.state.policy.action,
    'deny',
    'Lo stato del link rimosso deve riportare l\'azione deny'
  );
  assert.strictEqual(
    deniedSample.state.policy.source,
    'network',
    'La sorgente della policy deve riflettere la risposta di rete'
  );
  assert(deniedSample.state.url, 'Il link rimosso deve mantenere l\'URL originale nel debug');
  assert.strictEqual(
    deniedSample.state.removed,
    true,
    'Lo stato deve indicare esplicitamente che il link è stato rimosso'
  );
  assert.strictEqual(
    typeof deniedSample.state.policy.reason,
    'string',
    'La motivazione deve essere disponibile come stringa localizzata'
  );
  assert(
    deniedSample.state.policy.reason.includes('Dominio bloccato'),
    'La motivazione deve riflettere il messaggio tradotto della policy'
  );
  assert.strictEqual(
    deniedSample.state.policy.ttl,
    120,
    'Il TTL calcolato lato client deve essere riportato nello stato del link rimosso'
  );

  assert(policyEvent.details.policyResponse, 'La risposta completa della policy deve essere inclusa in verbose mode');
  assert.strictEqual(
    policyEvent.details.policyResponse.analysis.reason,
    'blacklist',
    'Il payload di analisi deve essere preservato nel log di debug'
  );

  console.log('debug_policy_summary_test: OK');
};

run();
