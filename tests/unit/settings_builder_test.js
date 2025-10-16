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
    'data-tracking-include-metadata': 'false'
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
