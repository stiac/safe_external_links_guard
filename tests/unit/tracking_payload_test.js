const fs = require('fs');
const path = require('path');
const assert = require('assert');

const sourcePath = path.join(__dirname, '..', '..', 'links-guard.js');
const source = fs.readFileSync(sourcePath, 'utf8');

const match = source.match(
  /const buildTrackingPayload = \([\s\S]*?\) => \{[\s\S]*?return payload;[\s\S]*?};/
);

if (!match) {
  throw new Error('Funzione buildTrackingPayload non trovata in links-guard.js');
}

const buildTrackingPayload = new Function(
  `${match[0]}; return buildTrackingPayload;`
)();

const fullPayload = buildTrackingPayload({
  trackingId: 'uuid-1234',
  parameterName: 'myclid',
  destination: 'https://example.com/page?myclid=uuid-1234',
  original: 'https://example.com/page',
  metadata: {
    timestamp: '2025-11-12T10:00:00.000Z',
    referrer: 'https://origin.test',
    privacyMode: 'extended',
    language: 'it-IT',
    languages: ['it-IT', 'en-US'],
    timeZone: 'Europe/Rome',
    deviceType: 'desktop'
  }
});

assert.strictEqual(fullPayload.trackingId, 'uuid-1234', 'trackingId deve essere propagato');
assert.strictEqual(fullPayload.parameterName, 'myclid', 'parameterName deve essere propagato');
assert.strictEqual(fullPayload.destination, 'https://example.com/page?myclid=uuid-1234', 'destination deve essere propagato');
assert.strictEqual(fullPayload.originalDestination, 'https://example.com/page', 'originalDestination deve riflettere l\'URL originale');
assert.strictEqual(fullPayload.timestamp, '2025-11-12T10:00:00.000Z', 'timestamp deve essere incluso se presente nei metadati');
assert.strictEqual(fullPayload.referrer, 'https://origin.test', 'referrer deve essere incluso se presente nei metadati');
assert.strictEqual(fullPayload.privacyMode, 'extended', 'privacyMode deve essere incluso');
assert.strictEqual(fullPayload.language, 'it-IT', 'language deve essere incluso');
assert.deepStrictEqual(fullPayload.languages, ['it-IT', 'en-US'], 'languages deve includere tutte le lingue disponibili');
assert.strictEqual(fullPayload.timeZone, 'Europe/Rome', 'timeZone deve essere incluso');
assert.strictEqual(fullPayload.deviceType, 'desktop', 'deviceType deve essere incluso');

const minimalPayload = buildTrackingPayload({
  trackingId: 'uuid-0000',
  parameterName: 'clid',
  destination: 'https://example.com/download',
  metadata: {
    timestamp: '2025-11-12T11:00:00.000Z',
    referrer: '',
    privacyMode: 'minimal'
  }
});

assert.strictEqual(minimalPayload.trackingId, 'uuid-0000', 'trackingId deve essere valorizzato anche in modalità minimale');
assert.strictEqual(minimalPayload.originalDestination, 'https://example.com/download', 'quando manca l\'originale deve usare destination');
assert.strictEqual(minimalPayload.privacyMode, 'minimal', 'privacyMode minimale deve essere mantenuto');
assert.strictEqual(minimalPayload.timestamp, '2025-11-12T11:00:00.000Z', 'timestamp minimale deve essere presente');
assert.strictEqual(minimalPayload.referrer, '', 'referrer vuoto deve essere propagato');
assert.strictEqual(typeof minimalPayload.language, 'undefined', 'language non deve essere presente in modalità minimale');
assert.strictEqual(typeof minimalPayload.languages, 'undefined', 'languages non deve essere presente in modalità minimale');
assert.strictEqual(typeof minimalPayload.timeZone, 'undefined', 'timeZone non deve essere presente senza metadati estesi');
assert.strictEqual(typeof minimalPayload.deviceType, 'undefined', 'deviceType non deve essere presente senza metadati estesi');

console.log('tracking_payload_test: OK');
