const assert = require('assert');
const path = require('path');

const { SafeExternalLinksGuard } = require(path.resolve(__dirname, '../../links-guard.i18n.js'));
const i18n = SafeExternalLinksGuard.i18n;

(() => {
  const detected = i18n.detectLanguage({ lang: 'es', navigatorLanguages: ['en-US'] });
  assert.strictEqual(detected, 'es', 'detectLanguage should prioritise explicit lang option');
})();

(() => {
  const detected = i18n.detectLanguage({ search: '?lang=fr', navigatorLanguages: ['en-US'] });
  assert.strictEqual(detected, 'fr', 'detectLanguage should read the lang query parameter');
})();

(() => {
  const detected = i18n.detectLanguage({ navigatorLanguages: ['pt-BR'] });
  assert.strictEqual(detected, 'pt-br', 'detectLanguage should normalise navigator languages');
})();

(() => {
  i18n.setLanguage('it');
  const translator = i18n.getTranslator();
  assert.strictEqual(translator.t('modal.openButton'), 'Apri link', 'Italian translation for modal.openButton should match JSON value');
})();

(() => {
  i18n.setLanguage('ru');
  const translator = i18n.getTranslator();
  assert.strictEqual(translator.t('modal.cancelButton'), 'Отмена', 'Russian translation for modal.cancelButton should match JSON value');
})();

(() => {
  i18n.registerLanguage('custom-demo', { modal: { openButton: 'Demo open' } });
  i18n.setLanguage('custom-demo');
  const translator = i18n.getTranslator();
  assert.strictEqual(translator.t('modal.openButton'), 'Demo open', 'Custom language should override provided keys');
  assert.strictEqual(
    translator.t('modal.cancelButton'),
    'Cancel',
    'Custom language should fallback to English when key is missing'
  );
})();

(() => {
  i18n.setLanguage('unknown');
  const translator = i18n.getTranslator();
  assert.strictEqual(translator.language, 'en', 'Unknown language should fallback to default English');
})();

console.log('translation_service_test: OK');
