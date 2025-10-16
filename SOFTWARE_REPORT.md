# Software Report - Safe External Links Guard

## Informazioni Generali
- **Progetto:** Safe External Links Guard
- **Versione:** 1.9.2
- **Data:** 2025-11-19
- **Autore aggiornamento:** AI Development Assistant

## Stato Moduli
| Modulo | Stato | Note |
| --- | --- | --- |
| Gestione modale (links-guard.js) | Aggiornato | Rilevazione automatica Reader/AMP con mantenimento del tooltip di sicurezza sui link `allow`, così l'avviso resta visibile anche quando la modale non è disponibile. |
| Localizzazione (links-guard.i18n.js) | Aggiornato | Introdotta `collectLanguageContext()`, nuovi hint da dataset/meta/URL e supporto a `navigator.userAgentData` per browser in modalità privacy. |
| Documentazione | Aggiornata | README, CHANGELOG, VERSION, ROADMAP e report aggiornati alla release 1.9.2 con note sulla detection avanzata e sull'uso di `collectLanguageContext()`. |
| Configurazione (links-guard.settings.js) | Aggiornato | Introdotto il flag `keepWarnMessageOnAllow` con auto-attivazione in contesti limitati e supporto negli snippet AMP/server-side. |

## Attività Recenti
| Data | Autore | Descrizione | Tempo (h) |
| --- | --- | --- | --- |
| 2025-11-12 | AI Development Assistant | Implementazione del tracciamento dei click con parametro configurabile, pixel HTTP e raccolta opzionale di metadati anonimi, inclusi test unitari. | 2.0 |
| 2025-11-13 | AI Development Assistant | Correzione della riscrittura degli URL di tracciamento con preservazione di query string e hash, nuovi test automatici e allineamento documentale alla release 1.8.1. | 1.0 |
| 2025-11-14 | AI Development Assistant | Fix della detection linguistica per le varianti italiane, rifinitura del fallback regionale, aggiornamento test e documentazione di esempio. | 0.5 |
| 2025-11-15 | AI Development Assistant | Hardening del rilevamento lingua con lettura da storage, attributi HTML e locale Intl, nuovi test di regressione e documentazione aggiornata. | 0.7 |
| 2025-11-17 | AI Development Assistant | Listener delegato per modalità lettura, utility `SafeExternalLinksGuard.amp`, documentazione AMP e nuovo test `amp_utils_test`. | 1.2 |
| 2025-11-18 | AI Development Assistant | Persistenza dei messaggi di sicurezza sui link `allow` in Reader/AMP, nuova opzione `keepWarnMessageOnAllow`, aggiornamento test/documentazione e report. | 0.8 |
| 2025-11-19 | AI Development Assistant | Refactoring della detection lingua con hint da dataset, metatag, path e `navigator.userAgentData`, nuovo contesto linguistico per il tracking e aggiornamento documentazione. | 0.9 |


## Rischi e Note Tecniche
- Validare in staging il flusso di consenso prima di abilitare `trackingEnabled`, verificando che il parametro personalizzato non interferisca con redirect esistenti.
- Assicurarsi che l'endpoint del pixel gestisca correttamente richieste POST `keepalive` e il fallback tramite query string codificata.
- Verificare i limiti di `<amp-script>` (dimensione bundle, mutazioni consentite) sugli ambienti AMP e predisporre fallback server-side per i domini in deny.

## Dipendenze e Impatti
- Nessuna nuova dipendenza introdotta.
- Compatibilità retroattiva preservata: il tracciamento è disattivo per impostazione predefinita e non altera gli URL quando il pixel non è configurato.

## Rendicontazione Economica (Opzionale)
- Non applicabile per questa manutenzione correttiva.
