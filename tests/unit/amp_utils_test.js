const fs = require('fs');
const path = require('path');
const assert = require('assert');

const sourcePath = path.join(__dirname, '..', '..', 'links-guard.js');
const source = fs.readFileSync(sourcePath, 'utf8');

const collectMatch = source.match(
  /const collectExternalLinksForAmp = \(root, options = \{\}\) => {[\s\S]*?return results;\n  };/
);
const normalizePoliciesMatch = source.match(
  /const normalizeAmpPolicies = \(policies\) => {[\s\S]*?return map;\n  };/
);
const applyPoliciesMatch = source.match(
  /const applyAmpPolicies = \(root, policies, options = \{\}\) => {[\s\S]*?return results;\n  };/
);

if (!collectMatch || !normalizePoliciesMatch || !applyPoliciesMatch) {
  throw new Error('Funzioni AMP non trovate in links-guard.js');
}

const factory = new Function(`
  const cfg = {
    warnHighlightClass: 'slg-warn-highlight',
    warnMessageDefault: 'Default warn',
    newTab: false,
    rel: ['noopener'],
    keepWarnMessageOnAllow: false
  };
  const defaultWarnMessage = 'Default warn fallback';
  const defaultDenyMessage = 'Denied';
  const toURL = (href) => { try { return new URL(href, 'https://origin.test/base'); } catch { return null; } };
  const isHttpLike = (href) => /^(https?:)?\\/\\//i.test(href);
  const isExternal = (url) => url && url.host !== 'origin.test';
  const normalizeMessageDescriptor = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return { text: value };
    if (typeof value === 'object' && value.text) return { text: value.text };
    return null;
  };
  const normalizeAction = (val) => {
    const normalized = typeof val === 'string' ? val.trim().toLowerCase() : '';
    return normalized === 'allow' || normalized === 'warn' || normalized === 'deny'
      ? normalized
      : null;
  };
  const ensureAttrs = (node) => {
    node.attrs = node.attrs || {};
    node.attrs.rel = 'noopener';
    node.dataset = node.dataset || {};
    node.dataset.safeLinkGuard = '1';
  };
  const disableLink = (node, reason) => {
    node.disabled = true;
    node.disabledReason = reason;
    if (!node.dataset) node.dataset = {};
    node.dataset.safeLinkGuard = '1';
    if (typeof node.removeAttribute === 'function') {
      node.removeAttribute('href');
    }
    node.setAttribute && node.setAttribute('aria-disabled', 'true');
    return node;
  };
  const setHoverMessage = (node, message) => {
    node.tooltip = message;
  };
  const clearHoverMessage = (node) => {
    if (!node) return;
    delete node.tooltip;
  };
  const translateMessageDescriptor = (descriptor, fallback) => {
    if (!descriptor) return fallback;
    if (descriptor.text) return descriptor.text;
    return fallback;
  };
  ${normalizePoliciesMatch[0]}
  ${collectMatch[0]}
  ${applyPoliciesMatch[0]}
  return {
    collectExternalLinksForAmp,
    applyAmpPolicies,
    normalizeAmpPolicies,
    setKeepWarnMessageOnAllow(value) {
      cfg.keepWarnMessageOnAllow = Boolean(value);
    }
  };
`);

const helpers = factory();

class StubAnchor {
  constructor(href, text = '', id = null) {
    this._href = href;
    this.textContent = text;
    this._id = id;
    const classSet = new Set();
    this.classList = {
      add: (cls) => classSet.add(cls),
      has: (cls) => classSet.has(cls),
      remove: (cls) => classSet.delete(cls)
    };
    this.dataset = {};
  }

  getAttribute(name) {
    if (name === 'href') return this._href;
    if (name === 'id') return this._id;
    return null;
  }

  setAttribute(name, value) {
    if (name === 'href') this._href = value;
    if (name === 'role') this.role = value;
    if (name === 'aria-disabled') this.ariaDisabled = value;
    if (name === 'id') this._id = value;
  }

  removeAttribute(name) {
    if (name === 'href') {
      this._href = '';
    }
  }
}

(() => {
  const anchors = [
    new StubAnchor('https://example.com/path', 'Example'),
    new StubAnchor('/internal', 'Internal'),
    new StubAnchor('mailto:test@example.com'),
    new StubAnchor('https://malicious.test', 'Malicious', 'ext-1')
  ];
  const root = {
    querySelectorAll: (selector) => (selector === 'a[href]' ? anchors : [])
  };
  const snapshot = helpers.collectExternalLinksForAmp(root, { includeText: true });
  assert.strictEqual(snapshot.length, 2, 'Devono essere raccolti solo i link esterni supportati');
  assert.deepStrictEqual(
    snapshot.map((item) => item.host),
    ['example.com', 'malicious.test'],
    'Gli host estratti devono essere normalizzati'
  );
  assert.strictEqual(
    snapshot.find((item) => item.host === 'malicious.test').id,
    'ext-1',
    'L\'ID deve essere incluso quando disponibile'
  );
})();

(() => {
  const anchors = [
    new StubAnchor('https://example.com/path', 'Example'),
    new StubAnchor('https://malicious.test/', 'Bad actor'),
    new StubAnchor('/internal', 'Internal')
  ];
  const root = {
    querySelectorAll: (selector) => (selector === 'a[href]' ? anchors : [])
  };
  const policies = {
    'example.com': { action: 'warn', message: 'Verifica prima di procedere' },
    'https://malicious.test/': { action: 'deny', message: 'Dominio bloccato' }
  };
  const stats = helpers.applyAmpPolicies(root, policies, { warnClass: 'warn-class' });
  assert.deepStrictEqual(
    stats,
    { processed: 2, denied: 1, warned: 1 },
    'Le statistiche di applicazione devono riflettere warn e deny'
  );
  assert.ok(
    anchors[0].classList.has('warn-class'),
    'Il link warn deve ricevere la classe configurata'
  );
  assert.strictEqual(
    anchors[0].tooltip,
    'Verifica prima di procedere',
    'Il messaggio di warning deve essere applicato come tooltip'
  );
  assert.ok(anchors[1].disabled, 'Il link deny deve essere disabilitato');
  assert.strictEqual(
    anchors[1].disabledReason && anchors[1].disabledReason.text,
    'Dominio bloccato',
    'Il messaggio di deny deve essere preservato'
  );
  assert.strictEqual(
    anchors[1]._href,
    '',
    'L\'href del link deny deve essere rimosso dal fallback disabilitante'
  );
})();

(() => {
  const anchors = [new StubAnchor('https://allowed.example/path', 'Allowed anchor')];
  const root = {
    querySelectorAll: (selector) => (selector === 'a[href]' ? anchors : [])
  };

  helpers.setKeepWarnMessageOnAllow(false);
  helpers.applyAmpPolicies(root, { 'allowed.example': { action: 'allow' } }, { warnClass: 'warn-class' });
  assert.strictEqual(
    anchors[0].tooltip,
    undefined,
    'Il tooltip deve essere rimosso per i link allow quando keepWarnMessageOnAllow è false'
  );

  helpers.setKeepWarnMessageOnAllow(true);
  helpers.applyAmpPolicies(root, { 'allowed.example': { action: 'allow' } }, { warnClass: 'warn-class' });
  assert.strictEqual(
    anchors[0].tooltip,
    'Default warn',
    'Il tooltip deve usare il messaggio di default quando keepWarnMessageOnAllow è true'
  );
})();

console.log('amp_utils_test: OK');
