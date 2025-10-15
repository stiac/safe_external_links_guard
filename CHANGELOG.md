# Changelog

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
