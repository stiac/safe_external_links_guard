# Safe External Links Guard

**Versione:** 1.6.0

## Panoramica
Safe External Links Guard è uno script JavaScript standalone che analizza i link esterni presenti in una pagina web e applica policy di sicurezza basate su una decisione server-side. Il progetto include anche un endpoint PHP di esempio che restituisce le azioni consentite per ciascun host.

Con la versione 1.5.0 la logica interna è stata riorganizzata in moduli indipendenti (tooltip, cache, coda delle richieste) per semplificare la manutenzione e migliorare la leggibilità del codice. La release 1.5.6 assicura che i click sui link consentiti vengano gestiti una sola volta, prevenendo aperture duplicate anche quando sono presenti handler `onclick` personalizzati, e mantiene il supporto diretto all'attributo `data-new-tab` nel file di configurazione. La release 1.5.7 migliora la gestione dei timeout di rete, restituendo messaggi più chiari e degradando a warning in modo controllato quando la policy non risponde in tempo utile. La release 1.5.8 evita i doppi redirect quando si apre un link dalla modale in una nuova scheda, mantenendo l'utente nella pagina originale, mentre la release 1.5.9 protegge la modale dagli automatismi della scansione dei link e ne affina l'accessibilità generale. La release 1.5.10 introduce una transizione di fade-in/fade-out per la modale, rispettosa delle preferenze di movimento ridotto dell'utente e allineata a un'esperienza più professionale, la release 1.5.11 risolve i problemi di cache in fase di deploy generando automaticamente una nuova firma di configurazione e aggiungendo l'attributo `data-config-version` per forzare aggiornamenti mirati, mentre la release 1.5.12 mantiene stabile il layout durante l'apertura della modale compensando la sparizione della scrollbar. La release 1.5.14 aggiorna inoltre il messaggio di avviso predefinito per i domini non presenti nelle liste per chiarire i rischi di condivisione dei dati di navigazione verso terze parti e supportare scelte più consapevoli, la release 1.5.15 introduce un template HTML dedicato per la modale che rende più semplice modificarne la struttura senza intervenire direttamente sul codice JavaScript, mentre la release 1.6.0 abilita un sistema i18n modulare con rilevazione automatica della lingua, file JSON centralizzati e fallback immediato in inglese per ogni stringa non tradotta.

Lo script:
- impone attributi di sicurezza (`rel`, `target`) sui link esterni;
- consulta in modo asincrono un endpoint che risponde con le azioni `allow`, `warn` o `deny` e un eventuale messaggio di motivazione;
- blocca immediatamente i domini già noti in cache e opzionalmente sostituisce i link con elementi non interattivi;
- mostra una modale di avviso per i domini non riconosciuti (in modalità `strict`), evidenzia e conferma i link in warning (modalità `warn`) oppure li evidenzia soltanto (modalità `soft`);
- rende configurabile la visualizzazione dei messaggi su hover tramite tooltip personalizzato oppure attributo `title` standard;
- espone un file di impostazioni dedicato (`links-guard.settings.js`) per gestire i valori di default e facilitare la manutenzione;
- osserva il DOM con `MutationObserver` per gestire i link aggiunti dinamicamente, rispettando selettori esclusi configurati.

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
   ></script>
   <!-- data-remove-node è opzionale: se impostato a true sostituisce <a> con <span> -->
   <!-- imposta data-mode="warn" per evidenziare i link e chiedere conferma prima di aprirli -->
   <!-- imposta data-show-copy-button="true" per mostrare il pulsante "Copia link" -->
   <!-- imposta data-hover-feedback="title" per usare il tooltip nativo del browser -->
  ```
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
Se `links-guard.settings.js` non è caricato, `links-guard.js` utilizza comunque un fallback legacy, ma verrà mostrato un avviso in console per ricordare di includere il file di impostazioni centralizzato.
L'attributo `defer` garantisce che gli script vengano eseguiti nell'ordine dichiarato senza bloccare il parsing HTML; evita `async` sul file principale a meno che il file di settings non sia stato precaricato.

### File di impostazioni dedicato (`links-guard.settings.js`)
Il file `links-guard.settings.js` espone il namespace globale `SafeExternalLinksGuard` con:
- i valori di default (`defaults`) per tutte le impostazioni supportate;
- la funzione `buildSettings(scriptEl, overrides)` che genera la configurazione finale partendo dagli attributi `data-*` presenti sul tag `<script>` e applicando i default solo quando i parametri non sono specificati;
- alcune utility di parsing riutilizzabili.

### Sistema di traduzione (`links-guard.i18n.js`)
Il file `links-guard.i18n.js` inizializza il servizio di localizzazione con le traduzioni contenute in `resources/lang/*.json` (Inglese, Italiano, Spagnolo, Francese, Tedesco, Portoghese, Brasiliano e Russo) e rileva automaticamente la lingua da mostrare leggendo, in ordine:

1. il parametro `lang` nella query string;
2. un eventuale override impostato tramite `SafeExternalLinksGuard.i18n.setLanguage('codice')`;
3. la lista `navigator.languages` esposta dal browser;
4. il fallback predefinito in inglese (`en`).

Il metodo `SafeExternalLinksGuard.i18n.t(key)` restituisce il testo nella lingua attiva e, se una chiave non è tradotta, ricade automaticamente sulla versione inglese. Per aggiungere nuove lingue è sufficiente creare un file JSON con la stessa struttura (sezioni `messages`, `modal`, `tooltip`) e registrarlo via `SafeExternalLinksGuard.i18n.registerLanguage('codice', dizionario)`. Il servizio espone inoltre `onLanguageChange` per reagire ai cambi di lingua in tempo reale.

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
  "ttl": 3600
}
```
- `allow`: il link viene lasciato attivo e aperto in una nuova scheda.
- `warn`: viene mostrata una modale di conferma prima di proseguire.
- `deny`: il link viene disabilitato o sostituito.

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
