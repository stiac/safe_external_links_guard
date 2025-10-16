const assert = require('assert');
const path = require('path');

const purgeModule = (modulePath) => {
  try {
    const resolved = require.resolve(modulePath);
    delete require.cache[resolved];
  } catch (err) {
    if (err && err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
  }
};

const run = () => {
  const i18nPath = path.resolve(__dirname, '../../links-guard.i18n.js');
  const registryPath = path.resolve(
    __dirname,
    '../../app/Services/Localization/translationRegistry.js'
  );

  purgeModule(i18nPath);
  purgeModule(registryPath);

  const queue = [];
  global.SafeExternalLinksGuard = { __i18nReadyQueue: queue };

  let queueTriggered = false;
  let notifiedLanguage = null;
  let translatorInstance = null;

  queue.push((api) => {
    queueTriggered = true;
    api.onLanguageChange((language, translator) => {
      notifiedLanguage = language;
      translatorInstance = translator;
    });
  });

  // eslint-disable-next-line global-require, import/no-dynamic-require
  require(i18nPath);

  assert.strictEqual(queueTriggered, true, 'La coda __i18nReadyQueue deve essere svuotata');
  assert.strictEqual(
    notifiedLanguage,
    'en',
    'Il listener registrato nella coda deve ricevere la lingua iniziale'
  );
  assert.ok(
    translatorInstance && typeof translatorInstance.t === 'function',
    'Il traduttore deve essere fornito al listener registrato'
  );

  let postReadyLanguage = null;
  global.SafeExternalLinksGuard.__i18nReadyQueue.push((api) => {
    postReadyLanguage = api.getLanguage();
  });
  assert.strictEqual(
    postReadyLanguage,
    'en',
    'Le callback aggiunte dopo il caricamento del modulo devono essere eseguite immediatamente'
  );

  delete global.SafeExternalLinksGuard;

  console.log('i18n_ready_queue_test: OK');
};

run();
