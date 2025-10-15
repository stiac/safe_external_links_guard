# Safe External Links Guard

**Versione:** 1.2.0

## Panoramica
Safe External Links Guard è uno script JavaScript standalone che analizza i link esterni presenti in una pagina web e applica policy di sicurezza basate su una decisione server-side. Il progetto include anche un endpoint PHP di esempio che restituisce le azioni consentite per ciascun host.

Lo script:
- impone attributi di sicurezza (`rel`, `target`) sui link esterni;
- consulta in modo asincrono un endpoint che risponde con le azioni `allow`, `warn` o `deny` e un eventuale messaggio di motivazione;
- blocca immediatamente i domini già noti in cache e opzionalmente sostituisce i link con elementi non interattivi;
- mostra una modale di avviso per i domini non riconosciuti (in modalità `strict`) oppure evidenzia visivamente i link (in modalità `soft`);
- osserva il DOM con `MutationObserver` per gestire i link aggiunti dinamicamente, rispettando selettori esclusi configurati.

## Struttura del repository
```
├── README.md                # Questo documento
├── VERSION                  # Numero di versione corrente
├── CHANGELOG.md             # Registro delle modifiche
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
1. Carica `links-guard.js` sul tuo hosting all'interno della directory pubblica, ad esempio in `/assets/app/safe_external_links_guard/`.
2. Inserisci lo script nelle pagine da proteggere utilizzando il seguente snippet:
   ```html
   <!-- /assets/app/safe_external_links_guard/links-guard.js (minificabile) -->
   <script
     async
     src="/assets/app/safe_external_links_guard/links-guard.js"
     data-endpoint="/app/demo/assets/app/links_secure/links/policy/policy.php"
     data-timeout="900"
     data-cache-ttl="3600"
     data-mode="soft"
     data-remove-node="true"
     data-warn-message="Questo link è monitorato: procedi con attenzione"
     data-warn-highlight-class="slg-warn-highlight"
     data-exclude-selectors=".slg-ignore, .newsletter-footer a"
     data-show-copy-button="true"
   ></script>
   <!-- data-remove-node è opzionale: se impostato a true sostituisce <a> con <span> -->
   <!-- imposta data-show-copy-button="false" per nascondere il pulsante "Copia link" -->
  ```
  Adatta `src` e `data-endpoint` ai percorsi effettivi del tuo sito.
 3. Assicurati che l'endpoint PHP sia raggiungibile e configurato con le tue liste di allow/deny.

Lo script legge gli attributi `data-*` dal tag `<script>` per adattare il comportamento senza necessità di ricompilazione.

### Attributi di configurazione supportati
| Attributo | Default | Descrizione |
|-----------|---------|-------------|
| `data-endpoint` | `/links/policy` | URL dell'endpoint server che restituisce l'azione per ogni host. |
| `data-timeout` | `900` | Timeout della richiesta (ms). |
| `data-cache-ttl` | `3600` | Durata cache lato client (secondi). |
| `data-mode` | `strict` | Modalità operativa: `strict` mostra una modale per i link `warn`, `soft` li lascia cliccabili ma li evidenzia. |
| `data-remove-node` | `false` | Se `true`, i link negati vengono sostituiti da `<span>` disabilitati. |
| `data-show-copy-button` | `true` | Se impostato a `false`, nasconde il pulsante "Copia link" nella modale. |
| `data-warn-message` | Messaggio predefinito | Testo mostrato nella modale e come tooltip nei warning in modalità `soft`. |
| `data-warn-highlight-class` | `slg-warn-highlight` | Classe CSS applicata ai link `warn` in modalità `soft`. |
| `data-exclude-selectors` | *(vuoto)* | Lista CSV di selettori CSS da escludere dalla scansione (`.footer a, #nav a.ignore`). |

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

## Personalizzazione UI
Lo stile della modale è iniettato direttamente dallo script e supporta modalità chiara/scura. È possibile sovrascrivere le classi `.slg-*` tramite CSS custom, mantenendo Tailwind CSS o altri framework come base.

In modalità `soft` viene aggiunta la classe `slg-warn-highlight` ai link in warning. Sovrascrivi questa classe per adattare il visual (ad esempio con Tailwind CSS) oppure imposta `data-warn-highlight-class` con una classe personalizzata.

## Sviluppo
- Il codice JavaScript è autonomo e non richiede build. È stato introdotto il supporto all'esclusione di selettori via attributo `data-exclude-selectors` e al messaggio personalizzato lato server.
- Commenta e documenta eventuali modifiche future per facilitare la manutenzione condivisa.
- Aggiungi test automatici nello spazio `tests/` quando introduci nuove funzionalità. Esegui i test esistenti con `php tests/unit/policy_resolver_test.php`.

## Versionamento
Questo progetto segue [Semantic Versioning](https://semver.org/). Aggiorna `VERSION`, `CHANGELOG.md` e questa pagina a ogni rilascio.

## Licenza
Specifica qui la licenza del progetto (ad esempio MIT, GPL). Attualmente non è incluso un file `LICENSE`.
