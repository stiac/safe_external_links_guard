# Changelog

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
