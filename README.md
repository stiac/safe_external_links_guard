# Safe External Links Guard

**Versione:** 1.10.2

## Panoramica
Safe External Links Guard è uno script JavaScript standalone che analizza i link esterni presenti in una pagina web e applica policy di sicurezza basate su una decisione server-side. Il progetto include anche un endpoint PHP di esempio che restituisce le azioni consentite per ciascun host.

Con la versione 1.5.0 la logica interna è stata riorganizzata in moduli indipendenti (tooltip, cache, coda delle richieste) per semplificare la manutenzione e migliorare la leggibilità del codice. La release 1.5.6 assicura che i click sui link consentiti vengano gestiti una sola volta, prevenendo aperture duplicate anche quando sono presenti handler `onclick` personalizzati, e mantiene il supporto diretto all'attributo `data-new-tab` nel file di configurazione. La release 1.5.7 migliora la gestione dei timeout di rete, restituendo messaggi più chiari e degradando a warning in modo controllato quando la policy non risponde in tempo utile. La release 1.5.8 evita i doppi redirect quando si apre un link dalla modale in una nuova scheda, mantenendo l'utente nella pagina originale, mentre la release 1.5.9 protegge la modale dagli automatismi della scansione dei link e ne affina l'accessibilità generale. La release 1.5.10 introduce una transizione di fade-in/fade-out per la modale, rispettosa delle preferenze di movimento ridotto dell'utente e allineata a un'esperienza più professionale, la release 1.5.11 risolve i problemi di cache in fase di deploy generando automaticamente una nuova firma di configurazione e aggiungendo l'attributo `data-config-version` per forzare aggiornamenti mirati, mentre la release 1.5.12 mantiene stabile il layout durante l'apertura della modale compensando la sparizione della scrollbar. La release 1.5.14 aggiorna inoltre il messaggio di avviso predefinito per i domini non presenti nelle liste per chiarire i rischi di condivisione dei dati di navigazione verso terze parti e supportare scelte più consapevoli, la release 1.5.15 introduce un template HTML dedicato per la modale che rende più semplice modificarne la struttura senza intervenire direttamente sul codice JavaScript, mentre la release 1.6.0 abilita un sistema i18n modulare con rilevazione automatica della lingua, file JSON centralizzati e fallback immediato in inglese per ogni stringa non tradotta. La release 1.7.0 estende questo ecosistema con un renderer di contenuti dichiarativo capace di sincronizzare testi, attributi e proprietà UI con i dizionari multilingua, riducendo il codice manuale necessario per aggiornare l'interfaccia e mantenendo i fallback inglesi automatici. Con la release 1.7.2 viene corretta la registrazione dell'handler di cambio lingua durante il bootstrap dello script, evitando errori JavaScript quando il modulo i18n è presente, mentre la release 1.7.3 rafforza il resolver multilingua introducendo il caricamento asincrono dei bundle, la normalizzazione dei codici regionali (`pt-BR`, `pt-PT`) e una funzione `t()` capace di gestire catene di fallback verso la lingua inglese. La release 1.7.4 completa il quadro traducendo anche i messaggi restituiti dal resolver (warning, deny ed errori di rete) tramite `messageKey` e `messageFallbackKey`, così tooltip e modale rispettano sempre la lingua dell'utente. La release 1.8.0 introduce inoltre un tracciamento opzionale dei click con parametro personalizzato, pixel configurabile e metadati anonimi rispettosi della privacy. La release 1.8.1 corregge la riscrittura degli URL garantendo che il parametro venga aggiunto senza perdere query string o hash, evitando duplicazioni e preservando l'encoding. La release 1.8.4 sincronizza inoltre il parametro di tracciamento direttamente con l'attributo `href`, così anche le aperture modificate (Ctrl/Cmd+click, pulsante centrale) e la copia del link dall'interfaccia ricevono sempre l'URL aggiornato.

La release 1.9.4 risolve definitivamente i casi in cui lo script principale veniva caricato prima del modulo i18n, introducendo una coda di bootstrap (`__i18nReadyQueue`) che riallinea automaticamente i testi tradotti non appena le traduzioni diventano disponibili. La release 1.9.3 corregge infine una duplicazione nella funzione AMP `collectExternalLinks()` che poteva interrompere il bootstrap dello script in ambienti sandboxati, ripristinando la compatibilità con Reader mode e pagine AMP. La release 1.10.0 aggiunge una modalità debug configurabile (basic/verbose) che centralizza i log operativi, mette a disposizione un’esportazione JSON dei dati diagnostici e rimane completamente silenziosa quando è disattivata, mentre la 1.10.1 arricchisce il debug con riepiloghi puntuali delle decisioni di policy, evidenziando i domini recuperati da cache o endpoint e fornendo esempi di link coinvolti; la 1.10.2 rende inoltre sempre visibile la lingua rilevata (preferita, alternative, sorgenti) per aiutare l’analisi dei link sospetti.

Lo script:
- impone attributi di sicurezza (`rel`, `target`) sui link esterni;
- consulta in modo asincrono un endpoint che risponde con le azioni `allow`, `warn` o `deny` e un eventuale messaggio di motivazione;
- blocca immediatamente i domini già noti in cache e opzionalmente sostituisce i link con elementi non interattivi;
- mostra una modale di avviso per i domini non riconosciuti (in modalità `strict`), evidenzia e conferma i link in warning (modalità `warn`) oppure li evidenzia soltanto (modalità `soft`);
- rende configurabile la visualizzazione dei messaggi su hover tramite tooltip personalizzato oppure attributo `title` standard;
- espone un file di impostazioni dedicato (`links-guard.settings.js`) per gestire i valori di default e facilitare la manutenzione;
- osserva il DOM con `MutationObserver` per gestire i link aggiunti dinamicamente, rispettando selettori esclusi configurati.
- intercetta i click sui link esterni con un listener delegato a livello documento, mantenendo la protezione attiva anche in modalità lettura o quando il browser ricostruisce il DOM.
- può aggiungere automaticamente un parametro di tracciamento a ogni link esterno consentito e inviare un evento analytics personalizzato con metadati anonimi nel rispetto delle preferenze privacy.

## Struttura del repository
```
├── README.md                # Questo documento
├── VERSION                  # Numero di versione corrente
├── CHANGELOG.md             # Registro delle modifiche
├── links-guard.settings.js  # Gestione centralizzata delle impostazioni
├── links-guard.js           # Script front-end di protezione dei link
└── links/
    └── policy/
        ├── resolver.php     # Resolver delle regole lato server
        └── policy.php       # Endpoint PHP di esempio per le decisioni sulle policy
```

## Requisiti
- **Client:** browser con supporto a `fetch`, `AbortController`, `MutationObserver` e `sessionStorage`.
- **Server di policy:** PHP 8.1+ (o compatibile) con JSON abilitato.
- Hosting condiviso o distribuzione tramite upload FTP/file manager (nessun requisito di shell).

## Installazione e utilizzo
1. Carica `links-guard.i18n.js`, `links-guard.settings.js` e `links-guard.js` sul tuo hosting all'interno della directory pubblica, ad esempio in `/assets/app/safe_external_links_guard/`.
2. Inserisci gli script nelle pagine da proteggere utilizzando il seguente snippet (l'ordine è importante: prima le traduzioni, poi i settings e infine lo script principale):
   ```html
   <!-- /assets/app/safe_external_links_guard/links-guard.i18n.js -->
   <script src="/assets/app/safe_external_links_guard/links-guard.i18n.js"></script>
   <!-- /assets/app/safe_external_links_guard/links-guard.settings.js -->
   <script src="/assets/app/safe_external_links_guard/links-guard.settings.js"></script>
   <!-- /assets/app/safe_external_links_guard/links-guard.js (minificabile) -->
   <script
     defer
     src="/assets/app/safe_external_links_guard/links-guard.js"
     data-endpoint="/assets/app/safe_external_links_guard/links/policy/policy.php"
     data-timeout="900"
     data-cache-ttl="3600"
     data-mode="soft"
     data-remove-node="true"
     data-warn-message="Questo link è monitorato: procedi con attenzione"
     data-warn-highlight-class="slg-warn-highlight"
     data-exclude-selectors=".slg-ignore, .newsletter-footer a"
     data-show-copy-button="true"
     data-hover-feedback="tooltip"
     data-tracking-enabled="true"
     data-tracking-parameter="myclid"
     data-tracking-pixel-endpoint="/analytics/pixel.php"
     data-tracking-include-metadata="true"
   ></script>
  <!-- data-remove-node è opzionale: se impostato a true sostituisce <a> con <span> -->
  <!-- imposta data-mode="warn" per evidenziare i link e chiedere conferma prima di aprirli -->
  <!-- imposta data-show-copy-button="true" per mostrare il pulsante "Copia link" -->
  <!-- imposta data-hover-feedback="title" per usare il tooltip nativo del browser -->
  ```
  > **Suggerimento:** dalla versione 1.9.4 `links-guard.js` processa una coda di callback (`SafeExternalLinksGuard.__i18nReadyQueue`) per riallineare automaticamente le traduzioni quando il modulo i18n viene caricato in ritardo. Mantieni comunque l'ordine suggerito per ridurre al minimo eventuali flash di testo in inglese sui dispositivi più lenti.

  Adatta `src` e `data-endpoint` ai percorsi effettivi del tuo sito.
3. Aggiungi alla pagina (tipicamente subito dopo l'inclusione degli script o nel footer) il template HTML della modale. Copia il contenuto di `links/modal-template.html` e personalizzalo mantenendo gli attributi `data-slg-*` per collegare i campi dinamici:
   ```html
   <template id="slg-modal-template">
     <div data-slg-root class="slg-overlay slg--hidden">
       <div class="slg-wrap">
         <div class="slg-dialog" data-slg-element="dialog">
          <div class="slg-header">
            <h2 class="slg-title" data-slg-element="title">Check that this link is safe</h2>
            <button type="button" class="slg-close" data-slg-element="close" aria-label="Close" title="Close">✕</button>
          </div>
          <div class="slg-body">
            <p data-slg-element="message">Custom warning text</p>
            <p>
              <span class="slg-host-label" data-slg-element="host-label">Host:</span>
              <span class="slg-host" data-slg-element="host"></span>
            </p>
            <div class="slg-actions">
              <a class="slg-btn primary" data-slg-element="open">Open link</a>
              <button class="slg-btn secondary" data-slg-element="copy" type="button">Copy link</button>
              <button class="slg-btn secondary" data-slg-element="cancel" type="button">Cancel</button>
            </div>
          </div>
         </div>
       </div>
     </div>
   </template>
   ```
   Se il template non è presente, lo script utilizza automaticamente il fallback integrato per garantire la retrocompatibilità.
4. Assicurati che l'endpoint PHP sia raggiungibile e configurato con le tue liste di allow/deny.

Lo script legge gli attributi `data-*` dal tag `<script>` per adattare il comportamento senza necessità di ricompilazione. Quando un attributo `data-*` non è presente vengono utilizzati i valori definiti in `links-guard.settings.js`, mentre gli override manuali possono sempre intervenire tramite JavaScript.
Se `links-guard.settings.js` non è caricato, `links-guard.js` utilizza comunque un fallback legacy; attivando la modalità debug viene registrato un avviso per ricordare di includere il file di impostazioni centralizzato.
L'attributo `defer` garantisce che gli script vengano eseguiti nell'ordine dichiarato senza bloccare il parsing HTML; evita `async` sul file principale a meno che il file di settings non sia stato precaricato.

### Modalità lettura e pagine AMP

- **Reader mode (Safari/Firefox/Edge):** a partire dalla versione 1.9.0 la protezione sfrutta un listener delegato in `capture` su `document`. In questo modo i link clonati dai motori di lettura mantengono sempre gli attributi di sicurezza e il blocco viene applicato anche quando l'HTML viene ricostruito dopo il rendering. Il listener lavora insieme al `MutationObserver` già presente, perciò eventuali link inseriti dinamicamente o trasformati dal browser vengono riesaminati e, se necessario, sottoposti alle policy del resolver. Con la 1.9.1 il flag `keepWarnMessageOnAllow` viene forzato automaticamente, così anche i link contrassegnati come `allow` mostrano comunque il messaggio di sicurezza.
- **AMP e ambienti con JavaScript limitato:** lo script espone l'helper `SafeExternalLinksGuard.amp` con due metodi pensati per l'esecuzione all'interno di `<amp-script>` oppure per un pre-processing server-side:
  - `SafeExternalLinksGuard.amp.collectExternalLinks(root)` restituisce un array con host, URL canonici e ID utili per inviare al server la richiesta di validazione.
  - `SafeExternalLinksGuard.amp.applyPolicies(root, policies, { warnClass })` applica il risultato delle policy (allow/warn/deny) direttamente sul DOM consentito da AMP, aggiungendo classi di evidenziazione o disabilitando i link bloccati senza eseguire fetch client-side.

In pagine AMP il comportamento è identico: se l'ambiente non consente l'apertura della modale, `keepWarnMessageOnAllow` viene attivato automaticamente e l'helper aggiunge il tooltip di avviso anche quando la policy restituisce `allow`.

Esempio minimale di integrazione AMP lato client con `<amp-script>`:

```html
<amp-script layout="container" script="slg-amp" sandbox="allow-forms">
  <article data-slg-scope>
    <!-- Contenuto dell'articolo -->
  </article>
</amp-script>

<script id="slg-amp" type="text/plain" target="amp-script">
  (async () => {
    const scope = document.querySelector('[data-slg-scope]');
    const links = SafeExternalLinksGuard.amp.collectExternalLinks(scope);
    const response = await fetch('/amp/policy-resolver.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links })
    });
    if (!response.ok) {
      return;
    }
    const policies = await response.json();
    SafeExternalLinksGuard.amp.applyPolicies(scope, policies, {
      warnClass: 'amp-warn'
    });
  })();
</script>
```

Lo stesso helper può essere eseguito su un worker Node.js o su uno script PHP lato server per calcolare in anticipo le azioni da allegare alla pagina AMP (ad esempio serializzando nel markup attributi `data-policy="deny"`). In assenza di JavaScript, il server può usare l'array restituito da `collectExternalLinks()` per trasformare definitivamente i link non autorizzati in elementi non interattivi prima della consegna al client.

### File di impostazioni dedicato (`links-guard.settings.js`)
Il file `links-guard.settings.js` espone il namespace globale `SafeExternalLinksGuard` con:
- i valori di default (`defaults`) per tutte le impostazioni supportate;
- la funzione `buildSettings(scriptEl, overrides)` che genera la configurazione finale partendo dagli attributi `data-*` presenti sul tag `<script>` e applicando i default solo quando i parametri non sono specificati;
- alcune utility di parsing riutilizzabili.

### Modalità debug

La versione 1.10.0 introduce una modalità debug integrata che aiuta a diagnosticare i problemi senza inquinare la console quando non serve; dalla 1.10.1 il debugger aggiunge inoltre riepiloghi dettagliati delle decisioni di policy e un focus sui domini bloccati o segnalati, mentre la 1.10.2 mette sempre in evidenza la lingua rilevata (preferita, alternative e sorgenti) nei log di livello `basic` e `verbose`.

- Abilita il debug impostando `settings.debugMode = true` (via override JS) oppure l’attributo `data-debug-mode="true"` sul tag `<script>`.
- Se vuoi più dettagli attiva anche `settings.debugLevel = 'verbose'` o `data-debug-level="verbose"`. Il livello `basic` mostra gli eventi principali (configurazione, fallback attivati, tracking, errori) e, dalla 1.10.1, riassume le policy applicate (host, azione, provenienza cache/endpoint, numero di link interessati) mostrando ora sempre la lingua rilevata; `verbose` aggiunge metadati completi, contesto lingua con sorgenti, payload anonimizzati ed esempi di link coinvolti per ogni dominio.
- Quando il debug è disattivato non viene emesso alcun log. Tutti i messaggi vengono gestiti da `SafeExternalLinksGuard.debug`, che raccoglie gli eventi in memoria solo mentre il debug è attivo.
- I dati raccolti possono essere esportati con `SafeExternalLinksGuard.debug.exportAsJson()` (facoltativamente passando `{ pretty: false }` per ottenere un JSON compatto) oppure letti come array con `SafeExternalLinksGuard.debug.getEntries()`.

Esempio rapido di attivazione dalla pagina:

```html
<script
  defer
  src="/assets/app/safe_external_links_guard/links-guard.js"
  data-endpoint="/links/policy"
  data-debug-mode="true"
  data-debug-level="verbose"
></script>
```

Nel log compariranno la configurazione normalizzata, la lingua rilevata con preferenza, alternative e sorgenti, i fallback attivati (cache, endpoint non raggiungibile, ecc.), gli eventi di tracking (ID applicati, pixel inviati), le decisioni di policy per ogni host (allow/warn/deny con motivazione e conteggio dei link) e gli errori del resolver. In qualsiasi momento puoi esportare i dati per analisi esterne:

```js
const debugDump = SafeExternalLinksGuard.debug.exportAsJson();
// Scarica o invia debugDump al tuo team per un'analisi offline.
```

### Sistema di traduzione (`links-guard.i18n.js`)
Il file `links-guard.i18n.js` inizializza il servizio di localizzazione con le traduzioni contenute in `resources/lang/*.json` (Inglese, Italiano, Spagnolo, Francese, Tedesco, Portoghese, Brasiliano e Russo) e rileva automaticamente la lingua da mostrare interrogando, in ordine, fonti ridondanti che coprono anche i browser con impostazioni privacy aggressive:

1. un eventuale override esplicito (`SafeExternalLinksGuard.i18n.detectLanguage({ lang: 'codice' })` o `setLanguage()`);
2. il parametro `lang` (personalizzabile) nella query string;
3. le preferenze salvate nei vari storage del browser (`localStorage`, `sessionStorage`, cookie) con le chiavi `SafeExternalLinksGuard.*`;
4. gli hint presenti sullo script o sul markup (`data-slg-lang`, `data-lang`, `data-locale`, dataset di `<html>`/`<body>`);
5. l'attributo `lang`/`xml:lang` del documento HTML o il meta `http-equiv="content-language"`;
6. i metatag semantici (`og:locale`, `og:locale:alternate`, `meta[name="language"]`, `dc.language`, ecc.);
7. i segmenti della URL (es. `/it/`, `/es-mx/`) per le installazioni multilingua lato server;
8. `navigator.languages`, le proprietà legacy (`language`, `browserLanguage`, `userLanguage`, `systemLanguage`) e `navigator.userAgentData.languages/locale`, con deduplica e gestione dei quality value (`;q=`);
9. il locale inferito dall'engine `Intl` (utile su browser in modalità anonima o con fingerprinting avanzato disattivato);
10. il fallback configurato (`defaultLanguage`, inglese di default).

Le varianti regionali vengono normalizzate mantenendo il formato canonico quando la specifica lingua è disponibile oppure quando esiste un alias verso la lingua base (es. `it-IT`, `pt-PT`, `fr-CA`). Quando il bundle dedicato non è presente viene utilizzato il dizionario della lingua madre, ma il codice restituito continua a riflettere la preferenza originale dell'utente.

Esempio di uso robusto della detection con codici brevi e regionali:

```javascript
const detected = SafeExternalLinksGuard.i18n.detectLanguage({
  navigatorLanguages: ['pt-BR', 'en-US'],
  defaultLanguage: 'en'
});
// detected === 'pt-BR'

const fallback = SafeExternalLinksGuard.i18n.detectLanguage({
  navigatorLanguages: ['pt', 'en-US']
});
// fallback === 'pt'

const italianFromHtml = SafeExternalLinksGuard.i18n.detectLanguage({
  navigatorLanguages: [],
  documentLang: 'it-IT'
});
// italianFromHtml === 'it-IT'

const storedPreference = SafeExternalLinksGuard.i18n.detectLanguage({
  navigatorLanguages: [],
  persistedLang: 'es-ES'
});
// storedPreference === 'es-ES'

const detectedFromRoute = SafeExternalLinksGuard.i18n.detectLanguage({
  navigatorLanguages: [],
  location: { pathname: '/de/account' }
});
// detectedFromRoute === 'de'

const detectedFromHost = SafeExternalLinksGuard.i18n.detectLanguage({
  navigatorLanguages: [],
  location: { hostname: 'supporto.tuo-sito.it' }
});
// detectedFromHost === 'it-IT'
```

> **Nota:** i codici `it` e `it-IT` vengono ora mappati direttamente sul dizionario italiano, mantenendo la forma con suffisso regionale quando presente.

Esempio di uso robusto della detection con codici brevi e regionali:

```javascript
const detected = SafeExternalLinksGuard.i18n.detectLanguage({
  navigatorLanguages: ['pt-BR', 'en-US'],
  defaultLanguage: 'en'
});
// detected === 'pt-BR'

const fallback = SafeExternalLinksGuard.i18n.detectLanguage({
  navigatorLanguages: ['pt', 'en-US']
});
// fallback === 'pt'

const italian = SafeExternalLinksGuard.i18n.detectLanguage({
  navigatorLanguages: ['it-IT', 'en']
});
// italian === 'it-IT'
```

Per raccogliere tutte le informazioni disponibili — inclusa la provenienza del dato — puoi usare l'API avanzata `collectLanguageContext()`, utile per inviare metadati coerenti verso il server o per il tracciamento opzionale:

```javascript
const context = SafeExternalLinksGuard.i18n.collectLanguageContext();
// context.language  -> codice principale risolto (es. 'it-IT')
// context.languages -> array ordinato delle lingue disponibili (es. ['it-IT', 'en-US', 'en'])
// context.sources   -> metadati sull'origine di ogni lingua (es. [{ language: 'it-IT', source: 'navigator' }])
```

Il metodo `SafeExternalLinksGuard.i18n.t(key)` restituisce il testo nella lingua attiva e, se una chiave non è tradotta, ricade automaticamente sulla versione inglese. È possibile passare un array di chiavi (`t(['ui.cta', 'modal.openButton'])`) per gestire fallback a catena senza controlli manuali. Per aggiungere nuove lingue è sufficiente creare un file JSON con la stessa struttura (sezioni `messages`, `modal`, `tooltip`) e registrarlo via `SafeExternalLinksGuard.i18n.registerLanguage('codice', dizionario)`. Il servizio espone inoltre `onLanguageChange` per reagire ai cambi di lingua in tempo reale e le utility `loadTranslations()`/`whenReady()` per precaricare i bundle prima del rendering della UI. Quando `links-guard.js` viene caricato prima del modulo i18n, la coda `SafeExternalLinksGuard.__i18nReadyQueue` si occupa di collegare automaticamente i listener registrati in anticipo e di rilanciare il rendering non appena le traduzioni sono pronte.

Quando i browser oscurano gli header linguistici (modalità anonima o privacy elevata), il resolver sfrutta anche gli indizi presenti nell'URL (segmenti, sottodomini dedicati e ccTLD) per dedurre la localizzazione più probabile, mantenendo sempre come ultima risorsa il fallback inglese.

#### Esempio di preload e integrazione rapida
```html
<script>
  // Carica un bundle JSON esterno prima di renderizzare l'interfaccia.
  SafeExternalLinksGuard.i18n
    .loadTranslations(() => fetch('/assets/lang/slg-bundle.json').then((res) => res.json()))
    .then(() => {
      // Attende che tutte le traduzioni siano disponibili.
      return SafeExternalLinksGuard.i18n.whenReady();
    })
    .then((translator) => {
      const cta = document.querySelector('.slg-cta');
      if (cta) {
        cta.textContent = translator.t(['ui.ctaLabel', 'modal.openButton']);
        cta.setAttribute('aria-label', translator.t('modal.openButton'));
      }
    });
</script>
```
In assenza del bundle esterno, il servizio ricade automaticamente sulle traduzioni interne (`resources/lang/*.json`) e sulla lingua inglese per qualsiasi chiave mancante.

#### Gestione avanzata dei contenuti multilingua
Per scenari complessi, `SafeExternalLinksGuard.i18n.createContentRenderer()` fornisce un renderer dichiarativo in grado di:

- collegare testi, attributi ARIA e proprietà personalizzate agli stessi dizionari multilingua utilizzati dallo script;
- ri-renderizzare automaticamente le sezioni al cambio lingua (anche quando la lingua è modificata da codice);
- popolare automaticamente gli elementi che espongono gli attributi `data-slg-i18n` o `data-slg-i18n-attr`.

Esempio minimale:

```javascript
const renderer = SafeExternalLinksGuard.i18n.createContentRenderer({
  root: document.querySelector('.hero'),
  descriptors: [
    { node: document.querySelector('.hero-title'), key: 'modal.title' },
    {
      node: document.querySelector('.hero-cta'),
      key: 'modal.openButton',
      attributes: { 'aria-label': 'modal.openButton' }
    }
  ]
});
```

È possibile registrare dinamicamente altri descriptor tramite `renderer.register({ node, key, ... })`, limitare il rendering a determinate condizioni con `shouldRender` e personalizzare i valori tramite `replacements` o `transform`. Quando non serve più, invoca `renderer.disconnect()` per rimuovere gli ascoltatori.

### Tracciamento dei clic con parametro personalizzato
Il modulo principale (`links-guard.js`) può generare automaticamente un identificatore univoco per ogni click consentito e appenderlo come parametro query personalizzabile (es. `?myclid=UUID`) all'URL di destinazione. Contestualmente viene inviata una richiesta al pixel configurato con i seguenti metadati anonimi:

- lingua e lingue preferite del browser;
- timezone rilevata tramite `Intl.DateTimeFormat()`;
- tipo di dispositivo stimato dall'user agent (desktop, tablet, mobile, TV o unknown);
- referrer della pagina che ha generato il click;
- timestamp ISO 8601 del momento del click;
- modalità privacy (`extended` o `minimal`) in base alla configurazione.

Le impostazioni disponibili nel file `links-guard.settings.js` (sovrascrivibili tramite attributi `data-*` o override JavaScript) sono:

| Opzione | Descrizione | Default |
| --- | --- | --- |
| `trackingEnabled` | Attiva il tracciamento dei click. | `false` |
| `trackingParameter` | Nome del parametro aggiunto alla query string (es. `myclid`). | `"myclid"` |
| `trackingPixelEndpoint` | Endpoint HTTP a cui inviare l'evento (POST JSON con fallback `sendBeacon`/immagine). | `""` |
| `trackingIncludeMetadata` | Se `true` invia lingua, timezone e tipo di dispositivo; se `false` invia solo identificatore, privacy minimale, referrer e timestamp. | `true` |

Quando il pixel è disabilitato (`trackingEnabled: false`) i link vengono aperti normalmente. Se mantieni `trackingEnabled: true` ma lasci l'endpoint vuoto, il parametro viene comunque aggiunto alla query string per consentire analisi server-side o campagne marketing, ma non viene inviato alcun evento client. Se `trackingIncludeMetadata` è impostato su `false` il payload inviato contiene solo i campi strettamente necessari (`trackingId`, `parameterName`, `destination`, `originalDestination`, `timestamp`, `referrer`, `privacyMode: "minimal"`).

Quando il tracciamento è attivo, il parametro viene sincronizzato direttamente sull'attributo `href` del link prima della navigazione per coprire anche i casi di apertura in nuove schede tramite modificatori da tastiera o menu contestuale, oltre alla copia dell'URL dall'interfaccia.

> **Suggerimento privacy:** per conformarsi al GDPR abilita il tracciamento solo dopo aver raccolto il consenso esplicito dell'utente e imposta `trackingIncludeMetadata: false` quando vuoi evitare la raccolta di dati aggiuntivi sul dispositivo.

Per adattare i default al tuo progetto puoi:
- modificare direttamente `links-guard.settings.js`, mantenendo in chiaro i valori attesi;
- creare un tuo file di configurazione che sostituisce `SafeExternalLinksGuard.buildSettings` prima di includere `links-guard.js`.

In questo modo le modifiche alle impostazioni restano concentrate in un file dedicato e facilmente versionabile.

### Attributi di configurazione supportati
| Attributo | Default | Descrizione |
|-----------|---------|-------------|
| `data-endpoint` | `/links/policy` | URL dell'endpoint server che restituisce l'azione per ogni host. |
| `data-timeout` | `900` | Timeout della richiesta (ms). |
| `data-cache-ttl` | `3600` | Durata cache lato client (secondi). |
| `data-mode` | `strict` | Modalità operativa: `strict` richiede conferma in modale; `warn` evidenzia i link e mostra la modale al click; `soft` li evidenzia soltanto. |
| `data-remove-node` | `false` | Se `true`, i link negati vengono sostituiti da `<span>` disabilitati. |
| `data-show-copy-button` | `false` | Se impostato a `true`, mostra il pulsante "Copia link" nella modale. |
| `data-hover-feedback` | `title` | Determina come mostrare i messaggi su hover: `title` usa il tooltip nativo del browser, `tooltip` attiva la UI personalizzata. |
| `data-new-tab` | `true` | Imposta se i link consentiti devono aprirsi in una nuova scheda (`true`) o riutilizzare quella corrente (`false`). |
| `data-warn-message` | Messaggio predefinito | Testo mostrato nella modale e nei messaggi su hover dei link in warning. |
| `data-warn-highlight-class` | `slg-warn-highlight` | Classe CSS applicata ai link `warn` in modalità `soft` o `warn`. |
| `data-exclude-selectors` | *(vuoto)* | Lista CSV di selettori CSS da escludere dalla scansione (`.footer a, #nav a.ignore`). |
| `data-keep-warn-on-allow` | `false` (auto `true` in Reader/AMP) | Mantiene il tooltip di avviso anche per i link consentiti: utile in modalità lettura, pagine AMP o quando si vuole mostrare sempre un messaggio di sicurezza. |
| `data-config-version` | Valore di `configVersion` in `links-guard.settings.js` | Versione (stringa) che forza l'invalidazione della cache e l'aggiornamento degli asset quando cambia. |

#### Come interpretare i TTL restituiti dal resolver
Il campo `ttl` presente nelle risposte dell'endpoint indica per quanti secondi la decisione può restare in cache lato client prima di richiedere nuovamente il verdetto al server. Alcuni esempi pratici:

- `"ttl": 86400` &rarr; 24 ore di validità: adatto a domini con policy molto stabili.
- `"ttl": 7200` &rarr; 2 ore: utile quando le decisioni possono cambiare durante la giornata.
- `"ttl": 1200` &rarr; 20 minuti: rende gli avvisi più reattivi in contesti temporanei o ambienti beta.

Usa valori più bassi quando ti serve riflettere rapidamente cambiamenti lato server e valori alti quando le regole sono statiche, così da ridurre il numero di richieste.

### Cosa restituisce l'endpoint
L'endpoint deve rispondere a richieste `POST` con un JSON del tipo:
```json
{
  "action": "allow|warn|deny",
  "ttl": 3600,
  "messageKey": "messages.policy.beta",
  "message": "Ambiente beta: verifica prima di procedere.",
  "messageFallbackKey": "messages.defaultWarn",
  "messageReplacements": {
    "host": "beta.partner.it"
  }
}
```
- `allow`: il link viene lasciato attivo e aperto in una nuova scheda.
- `warn`: viene mostrata una modale di conferma prima di proseguire.
- `deny`: il link viene disabilitato o sostituito.
- `messageKey` (opzionale): chiave di traduzione da usare lato client; se presente, lo script mostrerà il testo localizzato nella lingua dell'utente.
- `message` (opzionale): fallback testuale legacy, utilizzato anche quando l'i18n non è disponibile o quando la chiave non è presente.
- `messageFallbackKey` (opzionale): seconda chiave da provare quando `messageKey` non è definita o manca nella lingua corrente.
- `messageReplacements` (opzionale): parametri dinamici (`{{host}}`, `{{count}}`, ecc.) da interpolare nel testo finale.

L'endpoint di esempio (`links/policy/policy.php`) utilizza il resolver dichiarato in `links/policy/resolver.php`, che espone regole ordinate con supporto ai wildcard (`*.dominio.tld`), TTL personalizzati e messaggi da mostrare lato client. Personalizza le regole per integrare i tuoi controlli (database, API esterne, ecc.).

Il resolver restituisce anche un health check JSON (`GET ?health=1`) per permettere allo script di verificare la disponibilità dell'endpoint.

> **Nota:** lo script esegue un controllo di salute (`GET` con parametro `health=1`) verso l'endpoint. Adegua l'endpoint affinché risponda con HTTP 200 in questo caso, oppure modifica lo script se preferisci gestire la verifica in modo diverso.

## Cache e performance
- Le decisioni sono memorizzate in `sessionStorage` per l'intera sessione utente con TTL configurabile e contengono il messaggio restituito dal server.
- I domini negati in cache vengono disabilitati immediatamente alla successiva visita (con messaggio personalizzato se disponibile).
- In modalità `soft` i domini in warning vengono evidenziati con la classe configurabile, senza interrompere il flusso di navigazione.
- Le richieste vengono limitate tramite una coda con massimo 4 host simultanei.
- Ogni modifica alla configurazione (sia tramite `links-guard.settings.js` sia con attributi `data-*`) produce una nuova firma interna: la cache viene isolata per firma, così le decisioni non sopravvivono a configurazioni obsolete.

### Deploy e invalidazione delle configurazioni
- Aggiorna il valore `configVersion` in `links-guard.settings.js` o imposta `data-config-version` sul tag `<script>` a ogni rilascio per forzare invalidazione e refresh degli asset.
- Allegare una query string di versione agli script (`links-guard.settings.js?v=1.5.12`) aiuta i browser e i CDN a scaricare subito i file aggiornati.
- L'API `SafeLinkGuard.getConfigSignature()` restituisce la firma in uso, utile per verificare rapidamente che la pagina stia caricando l'ultima configurazione durante i controlli post-deploy.

## Personalizzazione UI
Lo stile della modale è iniettato direttamente dallo script e supporta modalità chiara/scura. L'overlay e il contenuto della finestra adottano ora una transizione di fade-in/fade-out che si disattiva automaticamente quando è attiva la preferenza di movimento ridotto del sistema operativo. È possibile sovrascrivere le classi `.slg-*` tramite CSS custom, mantenendo Tailwind CSS o altri framework come base.

In modalità `soft` o `warn` viene aggiunta la classe `slg-warn-highlight` ai link in warning. Sovrascrivi questa classe per adattare il visual (ad esempio con Tailwind CSS) oppure imposta `data-warn-highlight-class` con una classe personalizzata.

Il comportamento dei messaggi su hover è configurabile tramite `data-hover-feedback`: impostandolo su `tooltip` viene mostrato un riquadro contestuale con stile personalizzato e posizionamento automatico; con il valore `title` viene invece utilizzato il tooltip nativo del browser, utile in scenari dove si preferisce un approccio minimale o non si vuole iniettare ulteriore markup.

La struttura della modale può essere modificata senza intervenire su `links-guard.js` caricando un template personalizzato (come illustrato nella sezione di installazione). In alternativa è possibile impostare `SafeExternalLinksGuard.templates.modal` a un elemento `<template>` o a una stringa HTML prima di eseguire lo script: la logica di creazione userà automaticamente la versione più recente rispettando i riferimenti dinamici (`data-slg-element="open"`, `data-slg-element="message"`, ecc.).

## Sviluppo
- Il codice JavaScript è autonomo e non richiede build. È stato introdotto il supporto all'esclusione di selettori via attributo `data-exclude-selectors` e al messaggio personalizzato lato server.
- Commenta e documenta eventuali modifiche future per facilitare la manutenzione condivisa.
- Aggiungi test automatici nello spazio `tests/` quando introduci nuove funzionalità. Esegui i test esistenti con `php tests/unit/policy_resolver_test.php`, `node tests/unit/settings_builder_test.js`, `node tests/unit/scroll_lock_utils_test.js` e `node tests/unit/modal_template_test.js`.

## Versionamento
Questo progetto segue [Semantic Versioning](https://semver.org/). Aggiorna `VERSION`, `CHANGELOG.md` e questa pagina a ogni rilascio.

## Licenza
Specifica qui la licenza del progetto (ad esempio MIT, GPL). Attualmente non è incluso un file `LICENSE`.
