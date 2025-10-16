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

(() => {
  const createStubNode = () => {
    const attributes = {};
    return {
      textContent: '',
      attributes,
      setAttribute(name, value) {
        attributes[name] = value;
      }
    };
  };

  i18n.setLanguage('en');
  const heading = createStubNode();
  const button = createStubNode();

  const renderer = i18n.createContentRenderer({
    descriptors: [
      { node: heading, key: 'modal.title' },
      {
        node: button,
        key: 'modal.openButton',
        attributes: { 'aria-label': 'modal.openButton' }
      }
    ],
    autoBind: false
  });

  assert.strictEqual(
    heading.textContent,
    'Check that this link is safe',
    'Renderer should hydrate text content with English translation'
  );
  assert.strictEqual(
    button.textContent,
    'Open link',
    'Renderer should hydrate button label with English translation'
  );
  assert.strictEqual(
    button.attributes['aria-label'],
    'Open link',
    'Renderer should hydrate mapped attribute translations'
  );

  i18n.setLanguage('it');
  assert.strictEqual(
    heading.textContent,
    'Controlla che questo link sia sicuro',
    'Renderer should react to language changes for text nodes'
  );
  assert.strictEqual(
    button.textContent,
    'Apri link',
    'Renderer should react to language changes for buttons'
  );

  renderer.disconnect();
})();

(() => {
  const node = {
    textContent: 'Custom message'
  };
  const renderer = i18n.createContentRenderer({
    descriptors: [
      {
        node,
        key: 'modal.title',
        shouldRender: () => false
      }
    ],
    autoBind: false
  });

  assert.strictEqual(
    node.textContent,
    'Custom message',
    'Descriptors with shouldRender=false must preserve existing content'
  );

  renderer.disconnect();
})();

(() => {
  i18n.setLanguage('es');
  const label = { textContent: '' };
  const renderer = i18n.createContentRenderer({
    descriptors: [
      {
        node: label,
        key: 'modal.nonexistent',
        fallbackKey: 'modal.cancelButton'
      }
    ],
    autoBind: false
  });

  assert.strictEqual(
    label.textContent,
    'Cancelar',
    'Renderer should fallback to provided keys when the primary key is missing'
  );

  renderer.disconnect();
})();

(() => {
  i18n.setLanguage('en');
  const node = { textContent: '' };
  const renderer = i18n.createContentRenderer({
    autoBind: false,
    watch: false,
    renderInitial: false
  });

  const unregister = renderer.register({ node, key: 'modal.copyButton' });
  assert.strictEqual(
    node.textContent,
    'Copy link',
    'Register should render immediately when a descriptor is provided'
  );

  unregister();
  node.textContent = 'Manual';
  i18n.setLanguage('fr');
  renderer.render();
  assert.strictEqual(
    node.textContent,
    'Manual',
    'Unregistered descriptors must not be updated after removal'
  );

  renderer.disconnect();
})();

console.log('translation_service_test: OK');
