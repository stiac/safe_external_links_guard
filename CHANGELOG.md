# Changelog

## [1.7.2] - 2025-11-09
### Fixed
- Evitato il `ReferenceError` durante il bootstrap rimuovendo la registrazione anticipata di `handleLanguageChange` in `links-guard.js`, così l'handler viene agganciato solo dopo che la funzione e le sue dipendenze sono inizializzate.

## [1.7.1] - 2025-11-08
### Fixed
- Evitata la doppia dichiarazione della funzione `applyModalTranslations` in `links-guard.js`, eliminando l'errore di sintassi
  che bloccava l'inizializzazione della modale quando lo script veniva eseguito.

## [1.7.0] - 2025-11-07
### Added
- API `createContentRenderer` nel modulo `links-guard.i18n.js` per gestire contenuti multilingua in modo professionale tramite
  descriptor, binding automatici `data-slg-i18n` e aggiornamenti reattivi su cambio lingua.
- Test unitari aggiuntivi in `tests/unit/translation_service_test.js` che coprono binding testuale, attributi mappati, fallback
  dedicati, condizioni di rendering e deregistrazione dei descriptor.

### Changed
- La modale gestita da `links-guard.js` utilizza ora il renderer di contenuti i18n per sincronizzare pulsanti, etichette e
  attributi ARIA, semplificando l'estensione dell'interfaccia a nuovi componenti localizzati.

### Fixed
- Risolto il `ReferenceError` generato da `handleLanguageChange` durante il bootstrap spostando la sottoscrizione all'evento di
  cambio lingua dopo la definizione della funzione.

## [1.6.0] - 2025-11-06
### Added
- Modulo `links-guard.i18n.js` con rilevazione automatica della lingua, fallback inglese e API per gestire traduzioni personalizzate.
- Cataloghi JSON in `resources/lang/` e registro Node `app/Services/Localization/translationRegistry.js` per centralizzare i testi multilingua.
- Test `node tests/unit/translation_service_test.js` per validare il comportamento del servizio di localizzazione.

### Changed
- `links-guard.js` e `links-guard.settings.js` ora consumano il servizio i18n, aggiornando dinamicamente la modale e il messaggio di avviso in base alla lingua selezionata.
- Template HTML della modale e documentazione (`README.md`) aggiornati con testi neutrali in inglese, attributo `data-slg-element="host-label"` e snippet che include il nuovo modulo di traduzione.

## [1.5.15] - 2025-11-05
### Added
- Template HTML dedicato (`links/modal-template.html`) per la modale, caricabile come `<template>` o tramite namespace JavaScript per personalizzare il layout senza modificare `links-guard.js`.
- Test automatico `node tests/unit/modal_template_test.js` per verificare la selezione del template e il fallback interno.

### Changed
- `links-guard.js` ora costruisce la modale clonando un template esterno, mantenendo la compatibilità con la configurazione esistente e rispettando il pulsante "Copia" opzionale.
- Documentazione aggiornata con le istruzioni per includere e personalizzare il template della modale.

## [1.5.14] - 2025-11-04
### Changed
- Aggiornato il messaggio di avviso predefinito per i domini non presenti nelle liste con una descrizione più esplicita sui dati di navigazione condivisi con terze parti e centralizzato il testo in costanti riutilizzabili in PHP e JavaScript.
- Allineato i test del resolver al nuovo messaggio predefinito riutilizzando la costante condivisa.

## [1.5.13] - 2025-11-03
### Fixed
- Corretto il builder delle impostazioni affinché, in assenza di attributi `data-*`, vengano applicati automaticamente i valori di default globali (incluso `showCopyButton: false`) e il fallback legacy di `links-guard.js` rispetti la stessa configurazione.

### Added
- Test dedicati alla priorità tra default, attributi dello snippet e override manuali per l'opzione `showCopyButton`.

## [1.5.12] - 2025-11-02
### Fixed
- Eliminato lo shift orizzontale della pagina quando si apre la modale di conferma compensando automaticamente la scomparsa della scrollbar.
- Allineato il test del resolver alla stringa di fallback effettivamente restituita per i domini sconosciuti.

### Added
- Utility `computeScrollLockPadding` esposta su `SafeExternalLinksGuard.utils` con relativo test unitario per validare il calcolo della compensazione.

## [1.5.11] - 2025-11-01
### Fixed
- Risolta l'invalidazione della cache client quando cambiano le impostazioni, evitando che le decisioni restino bloccate ai valori precedenti dopo il deploy.

### Added
- Attributo `data-config-version`, versione di configurazione predefinita e API `SafeLinkGuard.getConfigSignature()` per forzare e verificare il refresh degli asset e delle policy aggiornate.

## [1.5.10] - 2025-10-31
### Changed
- Introdotto un effetto di fade-in/fade-out sulla modale di conferma, coordinato con la preferenza di movimento ridotto del sistema operativo per mantenere un'esperienza accessibile.

## [1.5.9] - 2025-10-30
### Fixed
- Impedita l'applicazione dei codici di protezione agli elementi della modale di conferma, evitando che attributi come `title=""` o listener superflui alterino l'interfaccia.

### Changed
- Aggiunto `aria-describedby` alla finestra di dialogo per una presentazione più professionale e accessibile dei messaggi di avviso.

## [1.5.8] - 2025-10-29
### Fixed
- Apertura dei link dalla modale con `newTab` attivo senza più ricadere nel fallback di navigazione interna quando il browser restituisce `window.open(...)=null` a causa di `noopener`, evitando così doppi redirect.
- Regola di deny per `*.truffa.xyz` allineata al messaggio e ai test, così da bloccare correttamente i sottodomini previsti.

## [1.5.7] - 2025-10-28
### Fixed
- Gestione dei timeout delle richieste verso l'endpoint con errori dedicati per evitare `AbortError` poco chiari in console e garantire messaggi di fallback coerenti lato utente.

### Changed
- Log del controllo di salute e delle policy aggiornati per distinguere i timeout dagli altri errori di rete, migliorando la diagnosi dei problemi di connettività.

## [1.5.6] - 2025-10-27
### Fixed
- Intercettata la gestione del click sui link consentiti per impedire aperture multiple quando sono presenti handler inline o listener esterni aggiuntivi.

### Changed
- Documentazione aggiornata con le note sulla prevenzione dei click duplicati e la conferma del supporto a `data-new-tab`.

## [1.5.5] - 2025-10-26
### Added
- Supporto all'attributo `data-new-tab` nel builder delle impostazioni per controllare l'apertura dei link consentiti.

### Fixed
- Corretto il flusso di apertura dei link `allow` evitando aperture multiple e rispettando l'opzione `newTab` anche durante la conferma dalla modale.

### Changed
- Gli attributi dei link e della modale vengono aggiornati per forzare il riutilizzo della scheda corrente quando `newTab` è disattivato.

## [1.5.4] - 2025-10-25
### Fixed
- Corretto il builder delle impostazioni per riconoscere `data-mode="warn"` e mantenere valida la modalità impostata tramite attributi o override manuali.

### Changed
- Aggiornati commenti e documentazione (`README.md`) per descrivere le tre modalità supportate (`strict`, `warn`, `soft`) e le relative evidenze sui link.

## [1.5.3] - 2025-10-24
### Changed
- Commenti dei valori di default in `links-guard.settings.js` ora descrivono varianti, attributi `data-*` e metodi di override supportati.
- Documentazione (`README.md`, `VERSION`) aggiornata alla release 1.5.3 con note sui nuovi commenti esplicativi.

## [1.5.2] - 2025-10-23
### Added
- Commenti descrittivi per ogni opzione di `links-guard.settings.js`, così da chiarire al volo le varianti disponibili e il loro impatto.

### Changed
- Documentazione aggiornata (README e VERSION) per riflettere la release 1.5.2 e le nuove note sulle impostazioni commentate.

## [1.5.1] - 2025-10-22
### Added
- Sezione della documentazione che spiega come scegliere i valori `ttl` restituiti dal resolver.

### Changed
- Commenti esplicativi sui TTL predefiniti in `links/policy/resolver.php` per chiarire le diverse durate di cache.

## [1.5.0] - 2025-10-21
### Added
- Test automatico `node tests/unit/settings_builder_test.js` per garantire che la build delle impostazioni rispetti gli attributi `data-*` e i fallback di default.

### Changed
- Ristrutturata la logica di `links-guard.js` in moduli per tooltip, cache e coda di richieste, migliorando la manutenibilità e l'applicazione coerente delle policy.
- `links-guard.settings.js` ora applica i default solo quando gli attributi `data-*` non sono presenti sullo script e include commenti descrittivi per ciascuna funzione di parsing.
- Documentazione aggiornata con la versione 1.5.0, le note sulla nuova architettura e il comando di test Node.js.

## [1.4.0] - 2025-10-20
### Added
- File `links-guard.settings.js` con i valori di default e i parser condivisi per le impostazioni dello script.

### Changed
- `links-guard.js` ora legge la configurazione tramite il builder centralizzato e mostra un avviso quando ricade nel fallback legacy.
- Documentazione aggiornata con la nuova struttura dei file, lo snippet con doppio `<script>` e indicazioni sull'uso del file di settings.

## [1.3.0] - 2025-10-19
### Added
- Tooltip personalizzato per i messaggi mostrati quando un link è bloccato o in warning, configurabile tramite `data-hover-feedback="tooltip"`.

### Changed
- `links-guard.js` permette di scegliere tra tooltip dedicato o attributo `title` per i messaggi su hover e gestisce in modo coerente la sostituzione dei nodi disabilitati.
- Documentazione aggiornata alla versione 1.3.0 con istruzioni sulla nuova opzione di feedback.

## [1.2.0] - 2025-10-18
### Added
- Opzione `data-show-copy-button` per disattivare il pulsante "Copia link" nella modale di avviso.

### Changed
- Documentazione aggiornata con la nuova configurazione e versione 1.2.0.

## [1.1.0] - 2025-10-17
### Added
- Modalità `soft` con evidenziazione configurabile dei link in warning e supporto a messaggi personalizzati dal server.
- Attributi `data-warn-message`, `data-warn-highlight-class` e `data-exclude-selectors` per controllare il comportamento client.
- Resolver riutilizzabile (`links/policy/resolver.php`) con regole ordinate, TTL personalizzati e messaggi per host.
- Test unitario `php tests/unit/policy_resolver_test.php` per validare il resolver.

### Changed
- `links-guard.js` salva i messaggi nel cache, rispetta selettori esclusi e utilizza la modalità `soft` senza modale.
- `links/policy/policy.php` fornisce un health check `GET ?health=1` e delega le decisioni al resolver condiviso.
- `README.md`, `CHANGELOG.md` e `VERSION` aggiornati alla versione 1.1.0 con le nuove istruzioni di configurazione.

## [1.0.1] - 2025-10-16
### Added
- Istruzioni dettagliate nel `README.md` per incorporare lo script nel markup HTML con tutti gli attributi `data-*`.

## [1.0.0] - 2025-10-15
### Added
- Documentazione iniziale nel `README.md` per l'uso di Safe External Links Guard.
- File `CHANGELOG.md` e `VERSION` per la gestione del versionamento.
