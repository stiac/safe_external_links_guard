const fs = require('fs');
const path = require('path');
const assert = require('assert');

const sourcePath = path.join(__dirname, '..', '..', 'links-guard.js');
const source = fs.readFileSync(sourcePath, 'utf8');

const runtimeMatch = source.match(
  /function createMyclidTrackingRuntime\([^)]*\) {([\s\S]*?)\n}\n/
);
if (!runtimeMatch) {
  throw new Error('Funzione createMyclidTrackingRuntime non trovata in links-guard.js');
}
const createRuntime = new Function(
  `${runtimeMatch[0]}; return createMyclidTrackingRuntime;`
)();

const helpersMatch = source.match(
  /const TRACKING_IGNORED_PROTOCOLS =[\s\S]*?const applyTrackingParameterToAnchor = ([\s\S]*?\n  };)/
);
if (!helpersMatch) {
  throw new Error('Funzione applyTrackingParameterToAnchor non trovata in links-guard.js');
}

const factory = new Function(
  'trackingRuntime',
  `const location = { href: 'https://origin.test/base', host: 'origin.test' };
   const cfg = {
     trackingEnabled: true,
     trackingParameter: 'myclid',
     debugMode: false,
     debugLevel: 'basic'
   };
   const toURL = (href) => { try { return new URL(href, location.href); } catch { return null; } };
   const debug = { event() {}, warn() {}, error() {}, verbose() {}, info() {} };
   const guardNamespace = { utils: {} };
   const window = {};
   ${helpersMatch[0]}
   return { prepareTrackedNavigation, applyTrackingParameterToAnchor, ensureTrackingParameter, generateTrackingId, cfg };
  `
);

const initialHelpers = factory(null);
const runtime = createRuntime({
  toURL: (href) => {
    try {
      return new URL(href, 'https://origin.test/base');
    } catch (err) {
      return null;
    }
  },
  detectDeviceType: () => 'desktop',
  generateTrackingId: initialHelpers.generateTrackingId,
  ensureTrackingParameter: initialHelpers.ensureTrackingParameter,
  getDocument: () => ({ referrer: 'https://origin.test', title: 'Page Title' }),
  getWindow: () => ({ innerWidth: 1280, innerHeight: 720 }),
  getLocation: () => ({ href: 'https://origin.test/base', host: 'origin.test' }),
  getNavigator: () => ({ language: 'it-IT', languages: ['it-IT'], userAgent: 'TestAgent' }),
  getLanguageSnapshot: () => ({ preferred: 'it-IT', alternatives: ['it-IT'] }),
  debug: { event() {}, warn() {}, error() {}, info() {}, verbose() {} },
  getCrypto: () => null,
  setTimeoutFn: (fn, delay) => setTimeout(fn, delay),
  clearTimeoutFn: (id) => clearTimeout(id)
});

runtime.init({
  enabled: true,
  paramName: 'myclid',
  endpoint: 'https://collector.test/pixel',
  samplingRate: 1
});

const helpers = factory(runtime);
const { applyTrackingParameterToAnchor, prepareTrackedNavigation } = helpers;

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
    href: 'https://example.com/path?myclid=keep',
    setAttribute(name, value) {
      if (name === 'href') {
        this.href = value;
      }
    }
  };
  const state = { url: new URL(anchor.href), trackingId: 'keep', originalHref: anchor.href };
  const trackingContext = prepareTrackedNavigation(anchor.href, {
    existingContext: state,
    forceNewId: true
  });
  const context = applyTrackingParameterToAnchor(anchor, state, trackingContext);
  assert.ok(context, 'il contesto deve essere disponibile anche quando forziamo un nuovo ID');
  assert.notStrictEqual(state.trackingId, 'keep', 'lo stato deve aggiornare il trackingId quando viene rigenerato');
  assert.ok(
    anchor.href.includes(state.trackingId),
    'l\'href deve includere il nuovo identificatore generato'
  );
})();

(() => {
  const anchor = { href: 'https://example.com/landing' };
  const state = { url: new URL(anchor.href) };
  runtime.disable();
  const context = applyTrackingParameterToAnchor(anchor, state);
  assert.strictEqual(context, null, 'quando il tracking è disabilitato non deve avvenire alcuna modifica');
  assert.strictEqual(
    anchor.href,
    'https://example.com/landing',
    'l\'href non deve cambiare quando il tracking è disabilitato'
  );
  runtime.enable();
})();

console.log('tracking_parameter_application_test: OK');
