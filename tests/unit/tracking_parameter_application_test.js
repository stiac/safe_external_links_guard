const fs = require('fs');
const path = require('path');
const assert = require('assert');

const sourcePath = path.join(__dirname, '..', '..', 'links-guard.js');
const source = fs.readFileSync(sourcePath, 'utf8');

const helpersMatch = source.match(
  /const TRACKING_IGNORED_PROTOCOLS =[^;]+;[\s\S]*?const applyTrackingParameterToAnchor = \([\s\S]*?\n  };/
);

if (!helpersMatch) {
  throw new Error('Funzione applyTrackingParameterToAnchor non trovata in links-guard.js');
}

const factory = new Function(`
  const location = { href: 'https://origin.test/base', host: 'origin.test' };
  const cfg = {
    trackingEnabled: true,
    trackingParameter: 'myclid',
    debugMode: false,
    debugLevel: 'basic'
  };
  const toURL = (href) => { try { return new URL(href, location.href); } catch { return null; } };
  const debug = { event() {}, warn() {}, error() {}, verbose() {} };
  const guardNamespace = { utils: {} };
  const window = {};
  ${helpersMatch[0]}
  return { prepareTrackedNavigation, applyTrackingParameterToAnchor, cfg };
`);

const { applyTrackingParameterToAnchor, cfg } = factory();

(() => {
  const anchor = {
    href: 'https://example.com/path',
    setAttribute(name, value) {
      if (name === 'href') {
        this.href = value;
      }
    }
  };
  const state = { url: new URL(anchor.href) };
  const context = applyTrackingParameterToAnchor(anchor, state);
  assert.ok(context, 'il contesto deve essere restituito quando il tracking è abilitato');
  assert.ok(anchor.href.includes('myclid='), 'il parametro myclid deve essere aggiunto all\'href');
  assert.strictEqual(
    state.url.href,
    anchor.href,
    'lo stato deve essere sincronizzato con il nuovo href'
  );
  assert.strictEqual(
    state.trackingId,
    context.trackingId,
    'lo stato deve tracciare lo stesso identificatore applicato al link'
  );
})();

(() => {
  const anchor = {
    href: 'https://example.com/path?myclid=keep'
  };
  const state = { url: new URL(anchor.href), trackingId: 'keep' };
  const context = applyTrackingParameterToAnchor(anchor, state);
  assert.ok(context, 'anche in presenza del parametro il contesto deve essere disponibile');
  assert.strictEqual(
    anchor.href,
    'https://example.com/path?myclid=keep',
    'il valore esistente non deve essere sovrascritto'
  );
  assert.strictEqual(state.trackingId, 'keep', 'lo stato deve preservare il trackingId esistente');
})();

(() => {
  cfg.trackingEnabled = false;
  const anchor = { href: 'https://example.com/landing' };
  const state = { url: new URL(anchor.href) };
  const context = applyTrackingParameterToAnchor(anchor, state);
  assert.strictEqual(context, null, 'quando il tracking è disabilitato non deve avvenire alcuna modifica');
  assert.strictEqual(
    anchor.href,
    'https://example.com/landing',
    'l\'href non deve cambiare quando il tracking è disabilitato'
  );
})();

console.log('tracking_parameter_application_test: OK');
