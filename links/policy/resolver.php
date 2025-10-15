<?php
/**
 * Resolver delle policy per Safe External Links Guard.
 * Incapsula le regole e consente il riuso in test/unit.
 */
declare(strict_types=1);

// TTL di default per la risposta warn.
const SLG_DEFAULT_WARN_TTL = 900;
// TTL di default per risposte allow/deny qualora non specificato.
const SLG_DEFAULT_DECISION_TTL = 3600;

/**
 * Elenco delle regole di policy applicate in ordine.
 * pattern supporta wildcard con prefisso *.
 * action: allow|warn|deny
 */
function slg_policy_rules(): array
{
    return [
        [
            'pattern' => 'bad-domain.com',
            'action' => 'deny',
            'ttl' => 86400, // 24 ore di validità della decisione nella cache client.
            'message' => 'Dominio segnalato per phishing.'
        ],
        [
            'pattern' => '*.truffa.xyz',
            'action' => 'deny',
            'ttl' => 86400, // Anche i sottodomini restano bloccati per 24 ore.
            'message' => 'Blocca tutti i sottodomini truffa.xyz.'
        ],
        [
            'pattern' => 'github.com',
            'action' => 'allow',
            'ttl' => 7200, // TTL di due ore per consentire refresh frequenti.
            'message' => 'Repository GitHub verificato.'
        ],
        [
            'pattern' => '*.tuo-sito.it',
            'action' => 'allow',
            'ttl' => 7200, // Anche i sottodomini ufficiali vengono rivalutati ogni 2 ore.
            'message' => 'Sottodomini ufficiali tuo-sito.it.'
        ],
        [
            'pattern' => 'beta.partner.it',
            'action' => 'warn',
            'ttl' => 1200, // 20 minuti, così gli avvisi riflettono rapidamente i cambiamenti.
            'message' => 'Ambiente beta: verifica prima di procedere.'
        ],
    ];
}

/**
 * Normalizza la action garantendo solo allow|warn|deny.
 */
function slg_normalize_action(string $action): string
{
    $normalized = strtolower(trim($action));
    return in_array($normalized, ['allow', 'warn', 'deny'], true) ? $normalized : 'warn';
}

/**
 * Confronta un host con un pattern (supporta wildcard *.example.com).
 */
function slg_match_pattern(string $host, string $pattern): bool
{
    $host = strtolower($host);
    $pattern = strtolower($pattern);
    if (str_starts_with($pattern, '*.')) {
        $base = substr($pattern, 2);
        return $host === $base || str_ends_with($host, '.' . $base);
    }
    return $host === $pattern;
}

/**
 * Restituisce la policy applicabile per l'host richiesto.
 */
function slg_resolve_policy(string $host): array
{
    $host = strtolower(trim($host));
    foreach (slg_policy_rules() as $rule) {
        if (!isset($rule['pattern'], $rule['action'])) {
            continue;
        }
        if (slg_match_pattern($host, (string) $rule['pattern'])) {
            $ttl = isset($rule['ttl']) && is_int($rule['ttl']) ? max(60, $rule['ttl']) : SLG_DEFAULT_DECISION_TTL;
            return [
                'action' => slg_normalize_action((string) $rule['action']),
                'ttl' => $ttl,
                'message' => isset($rule['message']) ? (string) $rule['message'] : null,
            ];
        }
    }

    return [
        'action' => 'warn',
        'ttl' => SLG_DEFAULT_WARN_TTL,
        'message' => 'Dominio non presente nelle liste, richiesta conferma utente.',
    ];
}
