const assert = require('assert');
const path = require('path');

const { SafeExternalLinksGuard } = require(path.resolve(__dirname, '../../links-guard.i18n.js'));
const i18n = SafeExternalLinksGuard.i18n;

const run = async () => {
  const detectedFromOption = i18n.detectLanguage({ lang: 'es', navigatorLanguages: ['en-US'] });
  assert.strictEqual(
    detectedFromOption,
    'es',
    'detectLanguage should prioritise explicit lang option'
  );

  const detectedFromQuery = i18n.detectLanguage({ search: '?lang=fr', navigatorLanguages: ['en-US'] });
  assert.strictEqual(
    detectedFromQuery,
    'fr',
    'detectLanguage should read the lang query parameter'
  );

  const detectedNavigator = i18n.detectLanguage({ navigatorLanguages: ['pt-BR'] });
  assert.strictEqual(
    detectedNavigator,
    'pt-BR',
    'detectLanguage should preserve the canonical code for supported regional languages'
  );

  const detectedFallback = i18n.detectLanguage({ navigatorLanguages: ['pt-PT'] });
  assert.strictEqual(
    detectedFallback,
    'pt-PT',
    'detectLanguage should preserve the canonical regional code even when it falls back to the base bundle'
  );

  const detectedItalian = i18n.detectLanguage({ navigatorLanguages: ['it-IT', 'en-US'] });
  assert.strictEqual(
    detectedItalian,
    'it-IT',
    'detectLanguage should expose the canonical Italian code when locale is it-IT'
  );

  const detectedFromDocument = i18n.detectLanguage({ navigatorLanguages: [], documentLang: 'it-IT' });
  assert.strictEqual(
    detectedFromDocument,
    'it-IT',
    'detectLanguage should fall back to document language when navigator data is not available'
  );

  const detectedFromStorage = i18n.detectLanguage({ navigatorLanguages: [], persistedLang: 'pt-BR' });
  assert.strictEqual(
    detectedFromStorage,
    'pt-BR',
    'detectLanguage should honour persisted language preferences'
  );

  const detectedFromDataset = i18n.detectLanguage({
    navigatorLanguages: [],
    document: {
      documentElement: {
        dataset: { lang: 'de-DE' },
        getAttribute: () => ''
      },
      body: null,
      querySelector: () => null,
      querySelectorAll: () => []
    }
  });
  assert.strictEqual(
    detectedFromDataset,
    'de-DE',
    'detectLanguage should read data-lang or dataset hints when standard attributes are missing'
  );

  const detectedFromMeta = i18n.detectLanguage({
    navigatorLanguages: [],
    document: {
      documentElement: {
        getAttribute: () => '',
        dataset: {}
      },
      body: null,
      querySelector: () => null,
      querySelectorAll: (selector) => {
        if (selector === 'meta[property="og:locale"]') {
          return [{ content: 'fr_FR' }];
        }
        return [];
      }
    }
  });
  assert.strictEqual(
    detectedFromMeta,
    'fr-FR',
    'detectLanguage should parse og:locale meta tags when explicit language hints are present'
  );

  const detectedFromIntl = i18n.detectLanguage({ navigatorLanguages: [], intlLocale: 'fr-CA' });
  assert.strictEqual(
    detectedFromIntl,
    'fr-CA',
    'detectLanguage should preserve the canonical regional code resolved through Intl locale information'
  );

  const detectedFromUaData = i18n.detectLanguage({
    navigatorLanguages: [],
    navigator: {
      userAgentData: { languages: ['de-DE', 'en-US'], locale: 'de-DE' }
    }
  });
  assert.strictEqual(
    detectedFromUaData,
    'de-DE',
    'detectLanguage should leverage navigator.userAgentData when available'
  );

  const detectedFromPath = i18n.detectLanguage({
    navigatorLanguages: [],
    location: { pathname: '/es-mx/app' }
  });
  assert.strictEqual(
    detectedFromPath,
    'es-MX',
    'detectLanguage should inspect URL path segments when browser APIs are not available'
  );

  const detectedFromQualityList = i18n.detectLanguage({ navigatorLanguages: ['es-ES;q=0.8', 'en-US'] });
  assert.strictEqual(
    detectedFromQualityList,
    'es-ES',
    'detectLanguage should parse navigator languages with quality values and preserve the canonical code'
  );

  const contextFromNavigator = i18n.collectLanguageContext({
    navigatorLanguages: ['it-IT', 'en-US'],
    defaultLanguage: 'en'
  });
  assert.strictEqual(
    contextFromNavigator.language,
    'it-IT',
    'collectLanguageContext should expose the resolved primary language'
  );
  assert.deepStrictEqual(
    contextFromNavigator.languages.slice(0, 2),
    ['it-IT', 'en-US'],
    'collectLanguageContext should list available languages preserving priority order'
  );
  assert.strictEqual(
    contextFromNavigator.sources[0].source,
    'navigator',
    'collectLanguageContext should retain the origin of the first language hint'
  );

  i18n.setLanguage('it');
  let translator = i18n.getTranslator();
  assert.strictEqual(
    translator.t('modal.openButton'),
    'Apri link',
    'Italian translation for modal.openButton should match JSON value'
  );

  i18n.setLanguage('ru');
  translator = i18n.getTranslator();
  assert.strictEqual(
    translator.t('modal.cancelButton'),
    'Отмена',
    'Russian translation for modal.cancelButton should match JSON value'
  );

  i18n.registerLanguage('custom-demo', { modal: { openButton: 'Demo open' } });
  i18n.setLanguage('custom-demo');
  translator = i18n.getTranslator();
  assert.strictEqual(
    translator.t('modal.openButton'),
    'Demo open',
    'Custom language should override provided keys'
  );
  assert.strictEqual(
    translator.t('modal.cancelButton'),
    'Cancel',
    'Custom language should fallback to English when key is missing'
  );

  i18n.setLanguage('pt-BR');
  translator = i18n.getTranslator();
  assert.strictEqual(
    translator.language,
    'pt-BR',
    'Translator should expose the canonical language code for supported locales'
  );
  assert.strictEqual(
    translator.t('modal.openButton'),
    'Abrir link',
    'Supported language should resolve translation keys from the matching bundle'
  );

  i18n.setLanguage('en');
  translator = i18n.getTranslator();
  assert.strictEqual(
    translator.t('messages.denyDefault'),
    'This domain is blocked. Proceed with caution.',
    'New deny default message should be available in English'
  );

  i18n.setLanguage('it');
  translator = i18n.getTranslator();
  assert.strictEqual(
    translator.t('messages.policy.beta'),
    'Ambiente beta: verifica prima di procedere.',
    'Italian bundle should expose policy-specific warning messages'
  );

  i18n.setLanguage('en');
  translator = i18n.getTranslator();
  assert.strictEqual(
    translator.t(['messages.policy.unknown', 'Fallback text']),
    'Fallback text',
    'Translator should fallback to raw text when keys are missing'
  );

  i18n.setLanguage('zh-CN');
  translator = i18n.getTranslator();
  assert.strictEqual(
    translator.language,
    'en',
    'Unsupported languages should fallback to English translator'
  );

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

  const shouldRenderNode = {
    textContent: 'Custom message'
  };
  const rendererConditional = i18n.createContentRenderer({
    descriptors: [
      {
        node: shouldRenderNode,
        key: 'modal.title',
        shouldRender: () => false
      }
    ],
    autoBind: false
  });

  assert.strictEqual(
    shouldRenderNode.textContent,
    'Custom message',
    'Descriptors with shouldRender=false must preserve existing content'
  );

  rendererConditional.disconnect();

  i18n.setLanguage('es');
  const label = { textContent: '' };
  const rendererFallback = i18n.createContentRenderer({
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

  rendererFallback.disconnect();

  i18n.setLanguage('en');
  const node = { textContent: '' };
  const rendererManual = i18n.createContentRenderer({
    autoBind: false,
    watch: false,
    renderInitial: false
  });

  const unregister = rendererManual.register({ node, key: 'modal.copyButton' });
  assert.strictEqual(
    node.textContent,
    'Copy link',
    'Register should render immediately when a descriptor is provided'
  );

  unregister();
  node.textContent = 'Manual';
  i18n.setLanguage('fr');
  rendererManual.render();
  assert.strictEqual(
    node.textContent,
    'Manual',
    'Unregistered descriptors must not be updated after removal'
  );

  rendererManual.disconnect();

  i18n.setLanguage('es');
  translator = i18n.getTranslator();
  assert.strictEqual(
    translator.t(['modal.nonexistent', 'modal.cancelButton']),
    'Cancelar',
    'Translator.t should resolve chained fallbacks before returning the key name'
  );

  await i18n.loadTranslations(
    Promise.resolve({
      'async-demo': {
        modal: {
          openButton: 'Async open'
        }
      }
    })
  );

  i18n.setLanguage('async-demo');
  await i18n.whenReady();
  translator = i18n.getTranslator();
  assert.strictEqual(
    translator.t('modal.openButton'),
    'Async open',
    'Asynchronously loaded bundles should be available before rendering'
  );

  i18n.setLanguage('en');
  translator = i18n.getTranslator();
  assert.strictEqual(
    translator.t('modal.missingKey'),
    'modal.missingKey',
    'Unknown keys without fallback must return the key name'
  );

  translator = i18n.getTranslator();
  assert.strictEqual(
    translator.language,
    'en',
    'Translator state should remain consistent after asynchronous loading'
  );

  console.log('translation_service_test: OK');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
