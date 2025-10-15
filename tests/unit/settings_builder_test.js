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
})();

(() => {
  const script = new FakeScript({
    'data-timeout': '1500',
    'data-cache-ttl': '1200',
    'data-mode': 'soft',
    'data-remove-node': 'true',
    'data-exclude-selectors': '.ignore, .skip'
  });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(cfg.timeoutMs, 1500, 'data-timeout should be parsed as integer');
  assert.strictEqual(cfg.cacheTtlSec, 1200, 'data-cache-ttl should be parsed as integer');
  assert.strictEqual(cfg.mode, 'soft', 'data-mode="soft" should enable soft mode');
  assert.strictEqual(cfg.removeNode, true, 'data-remove-node="true" should enable node removal');
  assert.deepStrictEqual(cfg.excludeSelectors, ['.ignore', '.skip'], 'data-exclude-selectors should produce cleaned array');
})();

(() => {
  const script = new FakeScript({ 'data-mode': 'soft' });
  const cfg = SafeExternalLinksGuard.buildSettings(script, { mode: 'strict', cacheTtlSec: 600 });
  assert.strictEqual(cfg.mode, 'strict', 'manual override should win over script attribute');
  assert.strictEqual(cfg.cacheTtlSec, 600, 'manual override should apply numeric values');
})();

(() => {
  const script = new FakeScript({ 'data-mode': 'invalid' });
  const cfg = SafeExternalLinksGuard.buildSettings(script);
  assert.strictEqual(cfg.mode, 'strict', 'invalid data-mode should fallback to strict');
})();

console.log('settings_builder_test: OK');
