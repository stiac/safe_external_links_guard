# Safe External Links Guard

**Versione:** 1.0.1

## Panoramica
Safe External Links Guard è uno script JavaScript standalone che analizza i link esterni presenti in una pagina web e applica policy di sicurezza basate su una decisione server-side. Il progetto include anche un endpoint PHP di esempio che restituisce le azioni consentite per ciascun host.

Lo script:
- impone attributi di sicurezza (`rel`, `target`) sui link esterni;
- consulta in modo asincrono un endpoint che risponde con le azioni `allow`, `warn` o `deny`;
- blocca immediatamente i domini già noti in cache e opzionalmente sostituisce i link con elementi non interattivi;
- mostra una modale di avviso per i domini non riconosciuti, fornendo opzioni per aprire o copiare il link;
- osserva il DOM con `MutationObserver` per gestire i link aggiunti dinamicamente.

## Struttura del repository
```
├── README.md                # Questo documento
├── VERSION                  # Numero di versione corrente
├── CHANGELOG.md             # Registro delle modifiche
├── links-guard.js           # Script front-end di protezione dei link
└── links/
    └── policy/
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
     data-endpoint="/assets/app/links_secure/links/policy/policy.php"
     data-timeout="900"
     data-cache-ttl="3600"
     data-mode="strict"
     data-remove-node="true"
   ></script>
   <!-- data-remove-node è opzionale: se impostato a true sostituisce <a> con <span> -->
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
| `data-mode` | `strict` | Modalità operativa (`strict` o `soft`). |
| `data-remove-node` | `false` | Se `true`, i link negati vengono sostituiti da `<span>` disabilitati. |

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

L'endpoint di esempio (`links/policy/policy.php`) implementa liste statiche di domini consentiti e bloccati con supporto ai wildcard (`*.dominio.tld`). Personalizzalo per integrare i tuoi controlli (database, API esterne, ecc.).

> **Nota:** lo script esegue un controllo di salute (`GET` con parametro `health=1`) verso l'endpoint. Adegua l'endpoint affinché risponda con HTTP 200 in questo caso, oppure modifica lo script se preferisci gestire la verifica in modo diverso.

## Cache e performance
- Le decisioni sono memorizzate in `sessionStorage` per l'intera sessione utente con TTL configurabile.
- I domini negati in cache vengono disabilitati immediatamente alla successiva visita.
- Le richieste vengono limitate tramite una coda con massimo 4 host simultanei.

## Personalizzazione UI
Lo stile della modale è iniettato direttamente dallo script e supporta modalità chiara/scura. È possibile sovrascrivere le classi `.slg-*` tramite CSS custom, mantenendo Tailwind CSS o altri framework come base.

## Sviluppo
- Il codice JavaScript è autonomo e non richiede build.
- Commenta e documenta eventuali modifiche future per facilitare la manutenzione condivisa.
- Aggiungi test automatici nello spazio `tests/` quando introduci nuove funzionalità.

## Versionamento
Questo progetto segue [Semantic Versioning](https://semver.org/). Aggiorna `VERSION`, `CHANGELOG.md` e questa pagina a ogni rilascio.

## Licenza
Specifica qui la licenza del progetto (ad esempio MIT, GPL). Attualmente non è incluso un file `LICENSE`.
