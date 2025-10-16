'use strict';

const path = require('path');

/**
 * Carica i file di traduzione JSON disponibili in resources/lang.
 * Questo modulo è destinato all'esecuzione in ambienti Node.js (test, build)
 * e non viene utilizzato direttamente dal browser.
 */
const loadJson = (name) => {
  const filePath = path.resolve(__dirname, '../../../resources/lang', `${name}.json`);
  // require() su file JSON restituisce direttamente l'oggetto parsificato.
  // L'uso di path.resolve garantisce che il modulo funzioni anche quando
  // viene eseguito da directory differenti (es. test automatizzati).
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(filePath);
};

module.exports = {
  en: loadJson('en'),
  it: loadJson('it'),
  es: loadJson('es'),
  fr: loadJson('fr'),
  de: loadJson('de'),
  pt: loadJson('pt'),
  'pt-br': loadJson('pt-br'),
  ru: loadJson('ru')
};
