const fs = require('fs');
const path = require('path');
const assert = require('assert');

const sourcePath = path.join(__dirname, '..', '..', 'links-guard.js');
const source = fs.readFileSync(sourcePath, 'utf8');

const helpersMatch = source.match(
  /const TRACKING_IGNORED_PROTOCOLS =[^;]+;[\s\S]*?const ensureTrackingParameter = \([\s\S]*?\n  };/
);
if (!helpersMatch) {
  throw new Error('Funzione ensureTrackingParameter non trovata in links-guard.js');
}

if (!source.includes('const toURL = (href) => {')) {
  throw new Error('Funzione toURL non trovata in links-guard.js');
}

const factory = new Function(`
  const location = { href: 'https://origin.test/base', host: 'origin.test' };
  const toURL = (href) => { try { return new URL(href, location.href); } catch { return null; } };
  ${helpersMatch[0]}
  return ensureTrackingParameter;
`);

const ensureTrackingParameter = factory();

(() => {
  let generated = 0;
  const result = ensureTrackingParameter(
    'https://example.com/path?foo=1',
    'myclid',
    () => {
      generated += 1;
      return 'uuid-1';
    }
  );
  assert.ok(result, 'il risultato non deve essere nullo per URL validi');
  assert.strictEqual(generated, 1, 'il generatore deve essere invocato quando il parametro è assente');
  assert.strictEqual(
    result.href,
    'https://example.com/path?foo=1&myclid=uuid-1',
    'la query string esistente deve essere preservata aggiungendo il parametro di tracking'
  );
  assert.strictEqual(
    result.url.searchParams.get('myclid'),
    'uuid-1',
    'il parametro aggiunto deve essere accessibile tramite URLSearchParams'
  );
})();

(() => {
  const result = ensureTrackingParameter(
    'https://example.com/download#section',
    'myclid',
    () => 'uuid-2'
  );
  assert.ok(result, 'il risultato deve essere disponibile per link con hash');
  assert.strictEqual(
    result.href,
    'https://example.com/download?myclid=uuid-2#section',
    'il frammento deve essere preservato dopo l\'aggiunta del parametro'
  );
})();

(() => {
  let generated = 0;
  const result = ensureTrackingParameter(
    'https://example.com/path?myclid=keep&foo=1',
    'myclid',
    () => {
      generated += 1;
      return 'uuid-3';
    }
  );
  assert.ok(result, 'il risultato deve esistere anche quando il parametro è già presente');
  assert.strictEqual(generated, 0, 'il generatore non deve essere invocato se il parametro è già presente');
  assert.strictEqual(
    result.href,
    'https://example.com/path?myclid=keep&foo=1',
    'l\'ordine dei parametri esistenti deve rimanere invariato quando il parametro è già presente'
  );
  assert.strictEqual(
    result.url.searchParams.getAll('myclid').length,
    1,
    'il parametro non deve essere duplicato'
  );
})();

(() => {
  const result = ensureTrackingParameter('/relative/path?lang=it', 'myclid', () => 'uuid-4');
  assert.ok(result, 'gli URL relativi devono essere gestiti correttamente');
  assert.strictEqual(
    result.href,
    'https://origin.test/relative/path?lang=it&myclid=uuid-4',
    'gli URL relativi devono essere risolti rispetto alla location corrente'
  );
})();

(() => {
  const result = ensureTrackingParameter('//cdn.example.com/app.js', 'myclid', () => 'uuid-5');
  assert.ok(result, 'gli URL protocol-relative devono essere gestiti');
  assert.strictEqual(
    result.href,
    'https://cdn.example.com/app.js?myclid=uuid-5',
    'gli URL protocol-relative devono mantenere il dominio corretto'
  );
})();

(() => {
  const mailto = ensureTrackingParameter('mailto:user@example.com', 'myclid', () => 'uuid-6');
  const tel = ensureTrackingParameter('tel:+39123456789', 'myclid', () => 'uuid-7');
  const js = ensureTrackingParameter('javascript:alert(1)', 'myclid', () => 'uuid-8');
  assert.strictEqual(mailto, null, 'i link mailto non devono essere modificati');
  assert.strictEqual(tel, null, 'i link tel non devono essere modificati');
  assert.strictEqual(js, null, 'i link javascript non devono essere modificati');
})();

(() => {
  const result = ensureTrackingParameter(
    'https://example.com/path',
    'myclid',
    () => 'valore con spazi & simboli'
  );
  assert.ok(result, 'il risultato deve essere disponibile anche per valori con caratteri speciali');
  assert.strictEqual(
    result.href,
    'https://example.com/path?myclid=valore+con+spazi+%26+simboli',
    'il valore deve essere correttamente codificato nella query string'
  );
})();

console.log('tracking_url_rewrite_test: OK');
