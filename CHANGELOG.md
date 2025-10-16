# Changelog
# Changelog
## [1.12.0] - 2025-11-28
### Added
- Bootstrap inline (`resources/bootstrap-inline.min.js`) inferiore a 2 KB con intercettazione immediata dei click e hand-off automatico verso `links-guard.js`.
- Servizio PHP `App\Services\Markup\ExternalLinkAttributeEnforcer` per applicare `target="_blank"` e `rel="noopener noreferrer nofollow"` a build-time o in fase di rendering server-side.
- Test unitario `bootstrap_guard_test.js` dedicato al bootstrap (SEO enforcement, allowlist e forward degli eventi).

### Changed
- `links-guard.js` integra il bootstrap tramite `SafeExternalLinksGuardBootstrap.forwardTo/release`, aggiunge l'allowlist di dominio e applica gli attributi SEO anche agli anchor aggiunti dinamicamente.
- `links-guard.settings.js` introduce la sezione `bootstrap` (enabled, allowlist, externalPolicy, seo) esponendo gli attributi `data-bootstrap-*` e sincronizzando il fingerprint delle impostazioni.
- Documentazione aggiornata (`README.md`) con istruzioni per il bootstrap inline e la sanitizzazione server-side.

## [1.11.0] - 2025-11-27
### Added
- Runtime avanzato `createMyclidTrackingRuntime` in `links-guard.js` con matrice di cattura configurabile, sampling, allowlist/blocklist, rispetto Do Not Track, retry e supporto HMAC opzionale, completo di API pubbliche (`init`, `enable`, `disable`, `setMatrix`, `getSettings`, `onChange`).
- Nuovi preset, attributi `data-*` e normalizzatori in `links-guard.settings.js` per gestire sampling, allowlist/blocklist, preset della matrice, timeout, retry e firma del payload.
- Test unitari aggiornati (`tracking_url_rewrite_test.js`, `tracking_parameter_application_test.js`, `tracking_payload_test.js`, `settings_builder_test.js`) per coprire il runtime avanzato e le nuove impostazioni.

### Changed
- Documentazione aggiornata (`README.md`) con descrizione del runtime `myclid`, esempi di matrice di cattura e tabella estesa degli attributi di configurazione.
- `syncLegacyTrackingConfig` sincronizza nuovamente sampling, matrici, retry e chiavi UTM verso `cfg`, mantenendo allineate le impostazioni legacy quando il runtime viene aggiornato a caldo.

## [1.10.4] - 2025-11-26
### Fixed
- Il parametro di tracking `myclid` viene ora applicato subito ai link consentiti e sincronizzato con lo stato interno,
  garantendo l'aggiornamento dell'attributo `href` per aperture da menu contestuale, nuove schede e copie dell'URL. (links-guard.js)

## [1.10.3] - 2025-11-25
### Added
- Fallback localizzati integrati in `links-guard.js` per garantire la traduzione della modale anche quando `links-guard.i18n.js` non può essere caricato dal browser.
- Test automatico `fallback_translations_test.js` che verifica le stringhe italiane, russe e il degrado all'inglese quando la lingua non è supportata.

### Fixed
- Messaggi mostrati in inglese sui browser che bloccavano il modulo i18n nonostante la lingua fosse rilevata correttamente, sfruttando il contesto runtime per selezionare il dizionario di fallback appropriato.

## [1.10.2] - 2025-11-24
### Changed
- I riepiloghi di policy includono ora sempre la lingua rilevata (preferita, alternative, sorgenti) così da contestualizzare i domini bloccati direttamente dal log.
- Il tracciamento anonimo riutilizza l'istantanea della lingua calcolata all'avvio, garantendo coerenza tra log console, export JSON e metadati inviati.

### Fixed
- La modalità debug mostra esplicitamente la lingua del visitatore anche al livello `basic`, evitando scenari in cui gli operatori non riuscivano a verificare la detection durante l'analisi dei link spam.

## [1.10.1] - 2025-11-23
### Added
- Riepiloghi automatici delle decisioni di policy (allow/warn/deny) nella console debug con conteggio dei link coinvolti, origine della decisione (cache, endpoint, fallback) ed esempi di anchor in modalità `verbose`.

### Changed
- Il livello `basic` del debugger mostra ora anche le informazioni essenziali sui domini analizzati, inclusi motivi e messaggi applicati, rendendo immediata l'individuazione dei link sospetti.

### Fixed
- La modalità debug segnala esplicitamente i domini bloccati o messi in warning, includendo lingua, motivazione e metadati di policy così da facilitare la diagnosi dei link spam segnalati dagli utenti.

## [1.10.0] - 2025-11-22
### Added
- Modalità debug controllabile via `debugMode`/`debugLevel` con livelli `basic` e `verbose`, comprensiva di log di configurazione, tracking e fallback.
- API `SafeExternalLinksGuard.debug.exportAsJson()` e `getEntries()` per esportare i dati diagnostici in JSON o consultarli lato client.

### Changed
- Tutti i log runtime (policy, cache, i18n, tracking) vengono instradati tramite il nuovo debugger e rimangono silenti quando la modalità debug è disattivata.
- I warning del fallback legacy dei settings vengono emessi soltanto tramite debug, evitando messaggi in console nei contesti di produzione.

## [1.9.4] - 2025-11-21
### Added
- Test unitario `i18n_ready_queue_test.js` che verifica l'esecuzione della coda di bootstrap e la consegna della lingua iniziale ai listener registrati prima del caricamento del modulo.

### Fixed
- Agganciata automaticamente la localizzazione quando `links-guard.js` viene caricato prima del modulo i18n, sfruttando la nuova coda `SafeExternalLinksGuard.__i18nReadyQueue` per notificare immediatamente i listener registrati e prevenire flash di testi in inglese.
- Gestione robusta degli script caricati in ordine asincrono con log sicuro degli errori della coda, evitando che eccezioni silenziose disattivino le traduzioni.

## [1.9.3] - 2025-11-20
### Added
- Heuristica `host` in `links-guard.i18n.js` con mappe dedicate ai ccTLD e ai sottodomini multilingua per dedurre la lingua quando il browser oscura le proprie preferenze.

### Changed
- Pipeline `gatherLanguageHints` aggiornata per includere il suggerimento proveniente dall'host prima dei fallback sul browser, mantenendo la normalizzazione canonica dei codici (es. `it-IT`, `es-ES`).

### Fixed
- Rilevazione della lingua corretta nei browser in modalità anonima o con privacy elevata, evitando il ritorno all'inglese quando sono disponibili domini locali (`example.it`, `es.example.com`).

## [1.9.2] - 2025-11-19
### Added
- Funzione `collectLanguageContext()` in `links-guard.i18n.js` per ottenere lingua principale, elenco di fallback e provenienza dei suggerimenti, riutilizzata anche dal tracciamento anonimo.

### Changed
- Rilevazione lingua potenziata con hint da dataset (`data-lang`, `data-slg-lang`), metatag semantici (`og:locale`, `dc.language`), segmenti della URL e `navigator.userAgentData`, garantendo il corretto funzionamento anche in modalità anonima o con fingerprinting ridotto.
- Documentazione aggiornata (`README.md`) con il nuovo flusso di detection multilivello e l'esempio d'uso di `collectLanguageContext()`.

### Fixed
- Metadati di tracking sincronizzati con la lingua effettivamente rilevata anche quando `navigator.languages` è vuoto, evitando fallback indesiderati all'inglese.

## [1.9.1] - 2025-11-18
### Added
- Opzione `keepWarnMessageOnAllow` nel builder delle impostazioni (e relativo attributo `data-keep-warn-on-allow`) per mantenere i messaggi di sicurezza anche quando la policy restituisce `allow`, completa di test aggiornati in `tests/unit/amp_utils_test.js`.

### Changed
- Rilevazione automatica della modalità lettura e delle pagine AMP che forza il mantenimento del tooltip di avviso sui link consentiti e allinea gli helper AMP allo stesso comportamento.

### Fixed
- I link esterni consentiti in Reader mode o AMP mostrano ora l'avviso di sicurezza predefinito, evitando che gli utenti perdano il messaggio quando la modale non è disponibile.

## [1.9.0] - 2025-11-17
### Added
- Namespace `SafeExternalLinksGuard.amp` con le utility `collectExternalLinks()` e `applyPolicies()` per integrare le policy su pagine AMP o in contesti con JavaScript limitato, complete di test automatici (`tests/unit/amp_utils_test.js`).

### Changed
- Gestione dei link esterni delegata a livello di `document` per supportare la modalità lettura dei browser, garantendo che gli anchor clonati mantengano gli attributi di sicurezza e la verifica delle policy.
- Documentazione aggiornata con scenari di fallback per Reader mode e AMP, inclusi snippet `<amp-script>` e linee guida per la validazione server-side.

### Fixed
- I link malevoli in modalità lettura o AMP non sfuggono più alla protezione: il listener delegato riesamina ogni click e applica le policy cached anche quando il DOM viene rigenerato o limitato.

## [1.8.4] - 2025-11-16
### Fixed
- Il parametro di tracciamento viene ora applicato direttamente all'attributo `href` dei link esterni quando il tracciamento è attivo, così anche aperture con modificatori da tastiera, pulsante centrale o copia dell'indirizzo usano l'URL arricchito.

## [1.8.3] - 2025-11-15
### Added
- Sorgenti di rilevazione aggiuntive in `links-guard.i18n.js` (storage persistenti, attributi HTML, meta `content-language`,
  locale `Intl`) per identificare correttamente la lingua anche quando il browser limita le API di fingerprinting.

### Changed
- Riorganizzata la normalizzazione dei codici lingua con gestione dei quality value e delle estensioni BCP 47 per preservare
  la forma canonica esposta all'esterno.
- Documentazione (`README.md`) aggiornata con il nuovo flusso di detection multilivello e relativi esempi pratici.

### Fixed
- Evitato il fallback forzato all'inglese su browser anonimi o con `navigator.languages` vuoto grazie ai nuovi meccanismi di
  discovery e ai test che coprono le varianti (`documentLang`, `persistedLang`, locale `Intl`).

## [1.8.2] - 2025-11-14
### Changed
- Migliorata la logica di rilevazione lingua in `links-guard.i18n.js` introducendo una risoluzione centralizzata dei candidati che preserva i codici regionali canonici.

### Fixed
- Mappati correttamente i codici `it` e `it-IT` sul dizionario italiano assicurando che il browser mostri sempre i testi localizzati anziché il fallback inglese.
- Aggiornata la documentazione con esempi di utilizzo della detection multilingua e note sui nuovi alias per le varianti italiane.

## [1.8.1] - 2025-11-13
### Changed
- Aggiornato il nome del parametro di tracciamento di default a `myclid` in `links-guard.settings.js` e nella documentazione per allinearsi alle aspettative di integrazione.

### Fixed
- Riscrittura degli URL corretta in `links-guard.js` sfruttando `URL` e `URLSearchParams` per preservare query string, frammenti e encoding, evitando duplicazioni del parametro e lasciando invariati i link `mailto:`, `tel:` e `javascript:`.

## [1.8.0] - 2025-11-12
### Added
- Sistema opzionale di tracciamento dei click in `links-guard.js` con generazione di UUID, aggiunta del parametro configurabile alla query string e invio di un pixel JSON con metadati anonimi (lingua, timezone, dispositivo, referrer e timestamp) rispettando il consenso privacy.
- Supporto alle nuove impostazioni di tracciamento (`trackingEnabled`, `trackingParameter`, `trackingPixelEndpoint`, `trackingIncludeMetadata`) nel builder di configurazione (`links-guard.settings.js`), con relativi attributi `data-*` e test automatici (`tests/unit/settings_builder_test.js`, `tests/unit/tracking_payload_test.js`).

### Changed
- `links-guard.js` espone utility riusabili per il calcolo del payload di tracking e rileva il tipo di dispositivo per favorire l'integrazione con analitiche esterne, preservando il comportamento legacy quando il pixel è disabilitato.
- Documentazione aggiornata (`README.md`, `SOFTWARE_REPORT.md`, `ROADMAP.md`, `VERSION`) per descrivere il nuovo parametro di tracciamento personalizzabile e le regole operative per ambienti GDPR-ready.

## [1.7.4] - 2025-11-11
### Added
- Chiavi di traduzione aggiuntive per i messaggi di policy (`messages.denyDefault`, `messages.policy.*`, errori di rete) in
  `links-guard.i18n.js` e nei bundle JSON di `resources/lang/`, complete di test unitari per verificare la disponibilità delle
  nuove stringhe multilingua.

### Changed
- `links-guard.js` normalizza e traduce i messaggi restituiti dall'endpoint (inclusi timeout ed errori) tramite descriptor
  strutturati, aggiorna la cache delle policy e ritraduce automaticamente la modale e i tooltip al cambio lingua.
- `links/policy/resolver.php` e `policy.php` espongono `messageKey` e `messageFallbackKey` per consentire al client di
  recuperare il testo corretto nella lingua dell'utente mantenendo il fallback testuale legacy.

### Fixed
- I messaggi di warning/deny provenienti dal resolver vengono ora mostrati nella lingua dell'utente, con fallback coerenti in
  caso di indisponibilità del servizio o errori di rete.

## [1.7.3] - 2025-11-10
### Added
- Supporto al precaricamento asincrono dei dizionari tramite `SafeExternalLinksGuard.i18n.loadTranslations()` e `whenReady()`
  per evitare flash di lingua errata prima del render della UI.
- Fallback a catena nella funzione `t()` (accetta array di chiavi) e normalizzazione canonica dei codici lingua (`pt-BR`,
  `pt-PT`) per coprire in modo affidabile le varianti regionali.
- Test unitari estesi (`tests/unit/translation_service_test.js`) che verificano lingua supportata, non supportata, gestione
  delle chiavi mancanti e caricamento asincrono dei bundle.

### Fixed
- Catalogo delle traduzioni rigenerato quando viene fornito un nuovo bundle esterno, garantendo l'applicazione dei testi corretti
  e l'aggiornamento dei listener già registrati.

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
