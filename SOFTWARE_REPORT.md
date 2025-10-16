# Software Report - Safe External Links Guard

## Informazioni Generali
- **Progetto:** Safe External Links Guard
- **Versione:** 1.12.1
- **Data:** 2025-11-29
- **Autore aggiornamento:** AI Development Assistant

## Stato Moduli
| Modulo | Stato | Note |
| --- | --- | --- |
| Gestione modale (links-guard.js) | Aggiornato | Rilevazione automatica Reader/AMP con mantenimento del tooltip di sicurezza sui link `allow`, così l'avviso resta visibile anche quando la modale non è disponibile. |
| Localizzazione (links-guard.i18n.js) | Aggiornato | Coda `__i18nReadyQueue` e fallback localizzati nel core per garantire la traduzione della modale anche quando il modulo i18n non viene caricato dal browser. |
| Tracciamento clic (links-guard.js) | Aggiornato | Runtime `myclid` modulare con matrice di cattura, sampling, rispetto DNT, retry e firma HMAC opzionale, più API pubblica `SafeExternalLinksGuard.tracking`. |
| Configurazione (links-guard.settings.js) | Aggiornato | Nuovi parser per sampling, allowlist/blocklist, preset matrice, timeout/retry e campi HMAC, completi di attributi `data-*` dedicati. |
| Documentazione | Aggiornata | README, CHANGELOG e guide aggiornate alla release 1.12.0 con istruzioni per il bootstrap inline e sanificazione server-side. |
| Bootstrap inline (resources/bootstrap-inline.min.js) | Aggiornato | Guardia click inline <2 KB caricata in `<head>` che ora rimuove il listener di fallback dopo l'inizializzazione dello script principale, prevenendo blocchi permanenti dei link. |
| Sanitizzazione markup (app/Services/Markup/ExternalLinkAttributeEnforcer.php) | Nuovo | Servizio PHP che imposta attributi SEO (`target`, `rel`) su link esterni durante il rendering server-side. |

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
| 2025-11-20 | AI Development Assistant | Estensione della detection con inferenza dal dominio (`host`), nuovi test unitari e aggiornamenti documentali alla release 1.9.3. | 0.6 |
| 2025-11-21 | AI Development Assistant | Implementazione della coda di bootstrap i18n per garantire la traduzione corretta anche con caricamenti asincroni degli script e relativo aggiornamento documentale/test. | 0.5 |
| 2025-11-25 | AI Development Assistant | Fallback multilingua lato client per browser che bloccano il modulo i18n, nuovo test di regressione e documentazione aggiornata alla release 1.10.3. | 0.6 |
| 2025-11-26 | AI Development Assistant | Ripristino dei metadati di policy nei log verbose dei link rimossi, arricchimento della diagnostica con host/URL/messaggi e nuovo test `debug_policy_summary_test`. | 0.5 |
| 2025-11-27 | AI Development Assistant | Refactoring del tracciamento `myclid` con runtime modulare, matrice di cattura configurabile, syncing legacy e aggiornamento documentazione/test per la release 1.11.0. | 1.6 |
| 2025-11-28 | AI Development Assistant | Introduzione del bootstrap inline, nuova allowlist host, servizio PHP di enforcement attributi SEO, aggiornamento configurazioni e test unitari. | 2.1 |
| 2025-11-29 | AI Development Assistant | Correzione del listener del bootstrap inline che restava attivo dopo l'hand-off al modulo principale, con aggiornamento documentale e versionamento a 1.12.1. | 0.3 |


## Rischi e Note Tecniche
- Validare in staging il flusso di consenso prima di abilitare `trackingEnabled`, verificando che il parametro personalizzato non interferisca con redirect esistenti.
- Assicurarsi che l'endpoint del pixel gestisca correttamente richieste POST `keepalive` e il fallback tramite query string codificata.
- Verificare i limiti di `<amp-script>` (dimensione bundle, mutazioni consentite) sugli ambienti AMP e predisporre fallback server-side per i domini in deny.
- Testare i preset e gli override della matrice di cattura su domini reali per evitare che campi esclusi vengano inviati involontariamente e per confermare il rispetto di allowlist/blocklist.
- Gestire i segreti HMAC al di fuori del markup pubblico (override JS o variabili lato server) e ruotarli periodicamente per limitare l'esposizione.
- Verificare l'utilizzo di `parse_url` nel servizio di sanitizzazione per gli URL relativi, mantenendo coerenza con l'host applicativo configurato.

## Dipendenze e Impatti
- Nessuna nuova dipendenza introdotta.
- Compatibilità retroattiva preservata: di default il tracciamento resta disattivato; quando viene abilitato senza endpoint, solo l'URL viene arricchito mantenendo opzionale l'invio del pixel.
- L'API `SafeExternalLinksGuard.tracking` espone metodi pubblici: verificare eventuali override legacy affinché non sovrascrivano il nuovo runtime.

## Rendicontazione Economica (Opzionale)
- Non applicabile per questa manutenzione correttiva.
