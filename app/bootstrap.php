<?php

declare(strict_types=1);

use App\Services\Markup\ExternalLinkAttributeEnforcer;

require_once __DIR__ . '/Services/Markup/ExternalLinkAttributeEnforcer.php';

$GLOBALS['safe_external_links_guard_bootstrap_state'] = $GLOBALS['safe_external_links_guard_bootstrap_state'] ?? [
    'active' => false,
    'level' => null,
];

/**
 * Avvia un buffer di output che applica gli attributi di sicurezza ai link esterni
 * prima dell'invio dell'HTML al client. In questo modo gli utenti e i bot ricevono
 * immediatamente `target="_blank"` e un attributo `rel` sicuro anche quando
 * JavaScript non è stato ancora caricato.
 *
 * Opzioni supportate:
 *  - enabled (bool): abilita/disabilita il bootstrap (default true).
 *  - allowlist (array): domini consentiti (non verranno modificati).
 *  - rel_strategy (string|array): 'noopener', 'noreferrer', 'both' o elenco personalizzato.
 *  - add_nofollow (bool): aggiunge automaticamente `nofollow` (default true).
 *  - debug (bool): logga eventuali eccezioni tramite error_log.
 *  - force (bool): se true forza la reinizializzazione sostituendo la configurazione precedente.
 */
if (!function_exists('safe_external_links_guard_bootstrap')) {
    function safe_external_links_guard_bootstrap(array $options = []): void
    {
        global $safe_external_links_guard_bootstrap_state;

        if ($safe_external_links_guard_bootstrap_state['active'] && empty($options['force'])) {
            return;
        }

        if ($safe_external_links_guard_bootstrap_state['active'] && !empty($options['force'])) {
            safe_external_links_guard_bootstrap_release();
        }

        $defaults = [
            'enabled' => true,
            'allowlist' => [],
            'rel_strategy' => 'both',
            'add_nofollow' => true,
            'debug' => false,
        ];

        $config = array_merge($defaults, $options);
        if (!$config['enabled']) {
            return;
        }

        $allowlist = is_array($config['allowlist'])
            ? array_values(
                array_filter(
                    array_map(static fn($host) => strtolower(trim((string) $host)), $config['allowlist'])
                )
            )
            : [];
        $relTokens = safe_external_links_guard_build_rel_tokens(
            $config['rel_strategy'],
            (bool) $config['add_nofollow']
        );

        $enforcer = new ExternalLinkAttributeEnforcer($allowlist, $relTokens);

        ob_start(function (string $buffer) use ($enforcer, $config): string {
            if ($buffer === '' || stripos($buffer, '<a') === false) {
                return $buffer;
            }

            try {
                return $enforcer->enforce($buffer);
            } catch (\Throwable $exception) {
                if (!empty($config['debug'])) {
                    error_log('[SafeExternalLinksGuard][bootstrap] ' . $exception->getMessage());
                }

                return $buffer;
            }
        });

        $safe_external_links_guard_bootstrap_state['active'] = true;
        $safe_external_links_guard_bootstrap_state['level'] = ob_get_level();
    }
}

if (!function_exists('safe_external_links_guard_bootstrap_release')) {
    /**
     * Termina il buffer del bootstrap applicando (o scartando) le trasformazioni.
     * Utile nei test o per riconfigurazioni runtime.
     */
    function safe_external_links_guard_bootstrap_release(bool $flush = true): void
    {
        global $safe_external_links_guard_bootstrap_state;

        if (!$safe_external_links_guard_bootstrap_state['active']) {
            return;
        }

        $targetLevel = (int) $safe_external_links_guard_bootstrap_state['level'];
        while (ob_get_level() >= $targetLevel && $targetLevel > 0) {
            if ($flush) {
                ob_end_flush();
            } else {
                ob_end_clean();
            }
        }

        $safe_external_links_guard_bootstrap_state['active'] = false;
        $safe_external_links_guard_bootstrap_state['level'] = null;
    }
}

if (!function_exists('safe_external_links_guard_build_rel_tokens')) {
    /**
     * Normalizza la strategia di popolamento dell'attributo rel.
     */
    function safe_external_links_guard_build_rel_tokens($strategy, bool $addNofollow): array
    {
        if (is_array($strategy) && !empty($strategy)) {
            $tokens = array_map(
                static fn($token) => strtolower(trim((string) $token)),
                $strategy
            );
        } else {
            $normalized = is_string($strategy) ? strtolower(trim($strategy)) : 'both';
            switch ($normalized) {
                case 'noopener':
                    $tokens = ['noopener'];
                    break;
                case 'noreferrer':
                    $tokens = ['noreferrer'];
                    break;
                default:
                    $tokens = ['noopener', 'noreferrer'];
                    break;
            }
        }

        $tokens = array_values(array_filter($tokens, static fn($token) => $token !== ''));

        if ($addNofollow && !in_array('nofollow', $tokens, true)) {
            $tokens[] = 'nofollow';
        }

        return array_values(array_unique($tokens));
    }
}
