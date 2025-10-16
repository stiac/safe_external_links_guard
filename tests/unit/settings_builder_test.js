const assert = require('assert');
const path = require('path');

const settingsModule = require(path.resolve(__dirname, '../../links-guard.settings.js'));
const { SafeExternalLinksGuard } = settingsModule;

class FakeScript {
  constructor(attrs = {}) {
    this.attrs = { ...attrs };
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name)
      ? this.attrs[name]
      : null;
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name);
  }
}

(() => {
  const script = new FakeScript();
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(cfg.timeoutMs, SafeExternalLinksGuard.defaults.timeoutMs, 'timeoutMs should fallback to defaults');
  assert.strictEqual(cfg.cacheTtlSec, SafeExternalLinksGuard.defaults.cacheTtlSec, 'cacheTtlSec should fallback to defaults');
  assert.strictEqual(cfg.mode, 'strict', 'mode should fallback to strict when not provided');
  assert.strictEqual(cfg.configVersion, SafeExternalLinksGuard.defaults.configVersion, 'configVersion should fallback to defaults');
  assert.strictEqual(cfg.showCopyButton, false, 'showCopyButton should respect default false when attribute is missing');
  assert.strictEqual(cfg.trackingEnabled, false, 'trackingEnabled should be disabled by default');
  assert.strictEqual(cfg.trackingParameter, 'myclid', 'trackingParameter should fallback to default name');
  assert.strictEqual(cfg.trackingPixelEndpoint, '', 'trackingPixelEndpoint should fallback to empty string');
  assert.strictEqual(cfg.trackingIncludeMetadata, true, 'trackingIncludeMetadata should default to true to collect anonymous data');
  assert.strictEqual(cfg.trackingSamplingRate, 1, 'trackingSamplingRate should default to full sampling');
  assert.deepStrictEqual(cfg.trackingAllowlist, [], 'trackingAllowlist should default to empty array');
  assert.deepStrictEqual(cfg.trackingBlocklist, [], 'trackingBlocklist should default to empty array');
  assert.strictEqual(cfg.trackingRespectDnt, true, 'trackingRespectDnt should default to true');
  assert.strictEqual(cfg.trackingTimeoutMs, SafeExternalLinksGuard.defaults.trackingTimeoutMs, 'trackingTimeoutMs should fallback to defaults');
  assert.deepStrictEqual(
    cfg.trackingRetry,
    SafeExternalLinksGuard.defaults.trackingRetry,
    'trackingRetry should fallback to default strategy'
  );
  assert.strictEqual(cfg.debugMode, false, 'debugMode should be disabled by default');
  assert.strictEqual(cfg.debugLevel, 'basic', 'debugLevel should default to basic');
})();

(() => {
  const script = new FakeScript({
    'data-timeout': '1500',
    'data-cache-ttl': '1200',
    'data-mode': 'soft',
    'data-remove-node': 'true',
    'data-exclude-selectors': '.ignore, .skip',
    'data-new-tab': 'false',
    'data-tracking-enabled': 'true',
    'data-tracking-parameter': 'myclid',
    'data-tracking-pixel-endpoint': '/collect',
    'data-tracking-include-metadata': 'false',
    'data-tracking-sampling-rate': '0.5',
    'data-tracking-allowlist': 'example.com, docs.example.com',
    'data-tracking-blocklist': 'bad.example.com',
    'data-tracking-respect-dnt': 'false',
    'data-tracking-timeout-ms': '5000',
    'data-tracking-retry-attempts': '3',
    'data-tracking-retry-delay': '250',
    'data-tracking-retry-backoff': '1.5',
    'data-tracking-matrix-preset': 'extended',
    'data-tracking-user-ip-hash': 'hash-value',
    'data-tracking-campaign-keys': 'cid,gclid',
    'data-tracking-utm-keys': 'utm_source,utm_medium,utm_campaign'
  });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(cfg.timeoutMs, 1500, 'data-timeout should be parsed as integer');
  assert.strictEqual(cfg.cacheTtlSec, 1200, 'data-cache-ttl should be parsed as integer');
  assert.strictEqual(cfg.mode, 'soft', 'data-mode="soft" should enable soft mode');
  assert.strictEqual(cfg.removeNode, true, 'data-remove-node="true" should enable node removal');
  assert.deepStrictEqual(cfg.excludeSelectors, ['.ignore', '.skip'], 'data-exclude-selectors should produce cleaned array');
  assert.strictEqual(cfg.newTab, false, 'data-new-tab="false" should disable new tab opening');
  assert.strictEqual(cfg.trackingEnabled, true, 'data-tracking-enabled="true" should activate tracking');
  assert.strictEqual(cfg.trackingParameter, 'myclid', 'data-tracking-parameter should override the default name');
  assert.strictEqual(cfg.trackingPixelEndpoint, '/collect', 'data-tracking-pixel-endpoint should override the default endpoint');
  assert.strictEqual(cfg.trackingIncludeMetadata, false, 'data-tracking-include-metadata="false" should disable metadata collection');
  assert.strictEqual(cfg.trackingSamplingRate, 0.5, 'data-tracking-sampling-rate should cap sampling rate');
  assert.deepStrictEqual(cfg.trackingAllowlist, ['example.com', 'docs.example.com'], 'data-tracking-allowlist should parse CSV');
  assert.deepStrictEqual(cfg.trackingBlocklist, ['bad.example.com'], 'data-tracking-blocklist should parse CSV');
  assert.strictEqual(cfg.trackingRespectDnt, false, 'data-tracking-respect-dnt="false" should disable DNT honouring');
  assert.strictEqual(cfg.trackingTimeoutMs, 5000, 'data-tracking-timeout-ms should override timeout');
  assert.strictEqual(cfg.trackingRetry.attempts, 3, 'data-tracking-retry-attempts should override attempts');
  assert.strictEqual(cfg.trackingRetry.delayMs, 250, 'data-tracking-retry-delay should override delay');
  assert.strictEqual(cfg.trackingRetry.backoffFactor, 1.5, 'data-tracking-retry-backoff should override factor');
  assert.strictEqual(cfg.trackingCaptureMatrix.activePreset, 'extended', 'data-tracking-matrix-preset should set active preset');
  assert.strictEqual(cfg.trackingUserIpHash, 'hash-value', 'data-tracking-user-ip-hash should be applied');
  assert.deepStrictEqual(cfg.trackingCampaignKeys, ['cid', 'gclid'], 'data-tracking-campaign-keys should parse list');
  assert.deepStrictEqual(cfg.trackingUtmKeys, ['utm_source', 'utm_medium', 'utm_campaign'], 'data-tracking-utm-keys should parse list');
  assert.strictEqual(cfg.debugMode, false, 'debugMode should remain disabled when not provided');
  assert.strictEqual(cfg.debugLevel, 'basic', 'debugLevel should stay basic when attribute is missing');
})();

(() => {
  const script = new FakeScript({
    'data-tracking-matrix-overrides': '{"domains":{"example.com":{"preset":"minimal"}}}'
  });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.ok(cfg.trackingCaptureMatrix, 'trackingCaptureMatrix should be initialised when overrides are provided');
  assert.strictEqual(
    cfg.trackingCaptureMatrix.overrides.domains.example.com.preset,
    'minimal',
    'matrix overrides should parse JSON content'
  );
})();

(() => {
  const script = new FakeScript({
    'data-tracking-hmac-secret': 'secret',
    'data-tracking-hmac-algorithm': 'sha-512',
    'data-tracking-hmac-format': 'hex',
    'data-tracking-hmac-header': 'X-Test-Signature'
  });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.ok(cfg.trackingHmac, 'trackingHmac should be initialised when attributes are provided');
  assert.strictEqual(cfg.trackingHmac.secret, 'secret', 'HMAC secret should be read from attribute');
  assert.strictEqual(cfg.trackingHmac.algorithm, 'SHA-512', 'HMAC algorithm should normalise the value');
  assert.strictEqual(cfg.trackingHmac.format, 'hex', 'HMAC format should respect explicit value');
  assert.strictEqual(cfg.trackingHmac.header, 'X-Test-Signature', 'HMAC header should be applied');
})();

(() => {
  const script = new FakeScript({
    'data-debug-mode': 'true',
    'data-debug-level': 'verbose'
  });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(cfg.debugMode, true, 'data-debug-mode="true" should enable debug mode');
  assert.strictEqual(cfg.debugLevel, 'verbose', 'data-debug-level="verbose" should enable verbose logging');
})();

(() => {
  const script = new FakeScript({ 'data-debug-level': 'unsupported' });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(cfg.debugLevel, 'basic', 'invalid data-debug-level should fallback to basic');
})();

(() => {
  const script = new FakeScript({
    'data-tracking-enabled': 'true',
    'data-tracking-parameter': 'clid'
  });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(
    cfg.trackingEnabled,
    true,
    'trackingEnabled should stay active to append the parameter even without a pixel endpoint'
  );
  assert.strictEqual(
    cfg.trackingPixelEndpoint,
    '',
    'trackingPixelEndpoint should remain empty when not provided'
  );
})();

(() => {
  const script = new FakeScript({ 'data-config-version': 'deploy-2025-11-01' });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(cfg.configVersion, 'deploy-2025-11-01', 'data-config-version should override default version');
})();

(() => {
  const script = new FakeScript({ 'data-show-copy-button': 'true' });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(cfg.showCopyButton, true, 'data-show-copy-button="true" should display the copy button');
})();

(() => {
  const script = new FakeScript({ 'data-show-copy-button': 'false' });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(cfg.showCopyButton, false, 'data-show-copy-button="false" should hide the copy button');
})();

(() => {
  const script = new FakeScript({ 'data-mode': 'soft' });
  const cfg = SafeExternalLinksGuard.buildSettings(script, { mode: 'strict', cacheTtlSec: 600 });
  assert.strictEqual(cfg.mode, 'strict', 'manual override should win over script attribute');
  assert.strictEqual(cfg.cacheTtlSec, 600, 'manual override should apply numeric values');
})();

(() => {
  const script = new FakeScript({
    'data-tracking-enabled': 'true',
    'data-tracking-parameter': 'clid',
    'data-tracking-pixel-endpoint': 'https://example.com/pixel'
  });
  const cfg = SafeExternalLinksGuard.buildSettings(script, {
    trackingEnabled: false,
    trackingParameter: 'override',
    trackingIncludeMetadata: true
  });
  assert.strictEqual(cfg.trackingEnabled, false, 'manual override should disable tracking even if data attribute enables it');
  assert.strictEqual(cfg.trackingParameter, 'override', 'manual override should change parameter name');
  assert.strictEqual(cfg.trackingPixelEndpoint, 'https://example.com/pixel', 'manual override keeps explicit endpoint');
  assert.strictEqual(cfg.trackingIncludeMetadata, true, 'manual override restores metadata collection');
})();

(() => {
  const script = new FakeScript({ 'data-new-tab': 'false' });
  const cfg = SafeExternalLinksGuard.buildSettings(script, { newTab: true });
  assert.strictEqual(cfg.newTab, true, 'manual override should be able to force new tab behaviour');
})();

(() => {
  const script = new FakeScript({ 'data-show-copy-button': 'true' });
  const cfg = SafeExternalLinksGuard.buildSettings(script, { showCopyButton: false });
  assert.strictEqual(cfg.showCopyButton, false, 'manual override should have the highest priority on showCopyButton');
})();

(() => {
  const script = new FakeScript({ 'data-mode': 'warn' });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(cfg.mode, 'warn', 'data-mode="warn" should enable warn mode');
})();

(() => {
  const script = new FakeScript();
  const cfg = SafeExternalLinksGuard.buildSettings(script, { mode: 'warn' });
  assert.strictEqual(cfg.mode, 'warn', 'manual override should accept warn mode');
})();

(() => {
  const script = new FakeScript({ 'data-mode': 'invalid' });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(cfg.mode, 'strict', 'invalid data-mode should fallback to strict');
})();

(() => {
  const script = new FakeScript({ 'data-timeout': '1500' });
  const baseCfg = SafeExternalLinksGuard.buildSettings(script);
  const overrideCfg = SafeExternalLinksGuard.buildSettings(script, { timeoutMs: 900 });
  const fingerprintA = SafeExternalLinksGuard.utils.computeSettingsFingerprint(baseCfg);
  const fingerprintB = SafeExternalLinksGuard.utils.computeSettingsFingerprint(overrideCfg);
  assert.notStrictEqual(fingerprintA, fingerprintB, 'fingerprint should change when configuration changes');
})();

console.log('settings_builder_test: OK');
