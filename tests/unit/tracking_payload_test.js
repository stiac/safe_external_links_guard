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
  throw new Error('Blocchi helper del tracking non trovati in links-guard.js');
}

const helpersFactory = new Function(
  'trackingRuntime',
  `const location = { href: 'https://origin.test/base', host: 'origin.test' };
   const cfg = { trackingEnabled: true, trackingParameter: 'myclid', debugMode: false, debugLevel: 'basic' };
   const toURL = (href) => { try { return new URL(href, location.href); } catch { return null; } };
   const debug = { event() {}, warn() {}, error() {}, verbose() {}, info() {} };
   const guardNamespace = { utils: {} };
   const window = {};
   ${helpersMatch[0]}
   return { ensureTrackingParameter, generateTrackingId };
  `
);

const helperFns = helpersFactory(null);

const buildPayloadMatch = source.match(
  /const buildTrackingPayload = \({[\s\S]*?return payload;\n  };/
);
if (!buildPayloadMatch) {
  throw new Error('Funzione buildTrackingPayload non trovata in links-guard.js');
}
const buildTrackingPayload = new Function(
  `${buildPayloadMatch[0]}; return buildTrackingPayload;`
)();

(async () => {
  const runtime = createRuntime({
    toURL: (href) => {
      try {
        return new URL(href, 'https://origin.test/base');
      } catch (err) {
        return null;
      }
    },
    detectDeviceType: () => 'desktop',
    generateTrackingId: helperFns.generateTrackingId,
    ensureTrackingParameter: helperFns.ensureTrackingParameter,
    getDocument: () => ({ referrer: 'https://origin.test/ref', title: 'Page Title' }),
    getWindow: () => ({ innerWidth: 1440, innerHeight: 900 }),
    getLocation: () => ({ href: 'https://origin.test/base', host: 'origin.test' }),
    getNavigator: () => ({ language: 'it-IT', languages: ['it-IT', 'en-US'], userAgent: 'TestAgent/1.0' }),
    getLanguageSnapshot: () => ({ preferred: 'it-IT', alternatives: ['it-IT', 'en-US'] }),
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

  const trackingContext = runtime.prepareNavigation('https://example.com/page?utm_source=news', {
    forceNewId: true
  });

  const anchor = { textContent: 'Example Link', rel: 'noopener' };
  const context = await runtime.collectContext({
    trackingContext,
    anchor,
    event: { type: 'click' },
    sourceOverride: 'click'
  });
  const payload = runtime.buildPayload(context);

  assert.strictEqual(payload.clid, trackingContext.trackingId, 'clid deve corrispondere al trackingId generato');
  assert.strictEqual(payload.link.host, 'example.com', 'il contesto link deve includere l\'host');
  assert.strictEqual(payload.link.query.includes('utm_source=news'), true, 'la query deve essere presente nel contesto link');
  assert.strictEqual(payload.page.referrer, 'https://origin.test/ref', 'il referrer deve essere popolato');
  assert.strictEqual(payload.user.language, 'it-IT', 'la lingua primaria deve essere presente');
  assert.ok(payload.request.utm.utm_source, 'i parametri UTM devono essere inclusi nel payload');

  runtime.setMatrix('minimal');
  const minimalContext = await runtime.collectContext({
    trackingContext,
    anchor,
    event: { type: 'click' },
    sourceOverride: 'click'
  });
  const minimalPayload = runtime.buildPayload(minimalContext);
  assert.ok(!minimalPayload.user.viewport, 'la matrice minimal non deve includere il viewport');
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(minimalPayload.page, 'title'),
    false,
    'la matrice minimal non deve includere il titolo della pagina'
  );

  const manualPayload = buildTrackingPayload({
    trackingId: 'uuid-manual',
    parameterName: 'clid',
    destination: 'https://example.com/manual?foo=1',
    original: 'https://example.com/manual',
    metadata: {
      timestamp: '2025-11-12T10:00:00.000Z',
      link: { host: 'example.com' },
      page: { referrer: 'https://origin.test' },
      user: { language: 'it-IT' },
      request: { source: 'manual-test' },
      preset: 'custom',
      matrixOverrides: [{ type: 'domain', pattern: 'example.com' }]
    }
  });

  assert.strictEqual(manualPayload.clid, 'uuid-manual', 'il payload manuale deve mantenere il clid specificato');
  assert.strictEqual(manualPayload.originalDestination, 'https://example.com/manual', 'l\'origine deve essere valorizzata');
  assert.strictEqual(manualPayload.request.source, 'manual-test', 'la sorgente manuale deve essere mantenuta');
  assert.strictEqual(manualPayload.preset, 'custom', 'il preset personalizzato deve essere mantenuto');
  assert.ok(Array.isArray(manualPayload.matrixOverrides), 'le overrides devono essere serializzate come array');

  console.log('tracking_payload_test: OK');
})().catch((err) => {
  console.error('tracking_payload_test: FAIL', err);
  process.exitCode = 1;
});
