# Software Report - Safe External Links Guard

## Informazioni Generali
- **Progetto:** Safe External Links Guard
- **Versione:** 1.7.4
- **Data:** 2025-11-11
- **Autore aggiornamento:** AI Development Assistant

## Stato Moduli
| Modulo | Stato | Note |
| --- | --- | --- |
| Gestione modale (links-guard.js) | Aggiornato | Messaggi di warning/deny tradotti dinamicamente con descriptor e refresh al cambio lingua.
| Localizzazione (links-guard.i18n.js) | Aggiornato | Nuove chiavi per messaggi di policy, errori di rete e fallback multilingua armonizzati con il resolver.
| Documentazione | Aggiornata | README, CHANGELOG, VERSION e report allineati alla release 1.7.4.

## Attività Recenti
| Data | Autore | Descrizione | Tempo (h) |
| --- | --- | --- | --- |
| 2025-11-11 | AI Development Assistant | Allineamento messaggi del resolver alla lingua utente (messageKey/fallback) con aggiornamento di modale, tooltip e traduzioni JSON. | 1.5 |

## Rischi e Note Tecniche
- Verificare in staging che i messaggi provenienti dal resolver (inclusi errori di rete) vengano tradotti correttamente in tutte le lingue supportate.
- Continuare a monitorare l'inizializzazione del renderer i18n per assicurare che i descriptor registrati vengano aggiornati dopo il cambio lingua.

## Dipendenze e Impatti
- Nessuna nuova dipendenza introdotta.
- Compatibilità retroattiva preservata; la risposta dell'endpoint espone `messageKey/messageFallbackKey` in modo opzionale mantenendo il fallback testuale legacy.

## Rendicontazione Economica (Opzionale)
- Non applicabile per questa manutenzione correttiva.
