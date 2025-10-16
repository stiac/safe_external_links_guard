# Roadmap - Safe External Links Guard

## Obiettivi a Breve Termine
- [ ] Aggiungere test end-to-end che verifichino il bootstrap della modale e il caricamento dinamico delle traduzioni (incluso il nuovo preload asincrono).
- [ ] Introdurre un controllo CI che esegua linting e bundle check sugli script distribuiti.
- [ ] Documentare scenari di fallback per `loadTranslations()` quando il fetch non è disponibile (es. ambienti legacy).

## Obiettivi a Medio Termine
- [ ] Semplificare la gestione dei template della modale consentendo override tramite configurazione JSON.
- [ ] Documentare esempi di integrazione con framework CMS comuni (WordPress, Drupal) nel README.

## Obiettivi a Lungo Termine
- [ ] Fornire una dashboard di amministrazione lato web per gestire whitelist e messaggi senza modificare i file.
- [ ] Valutare la creazione di un pacchetto npm con build ottimizzata e distribuzione versionata.

## Note Strategiche
- Ogni rilascio deve continuare a supportare aggiornamenti senza shell tramite upload FTP, rispettando i vincoli dell'ambiente Codex.
- Priorità alta alla copertura di test sul sistema di localizzazione per evitare regressioni dopo refactoring.
