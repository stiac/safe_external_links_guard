<?php
declare(strict_types=1);

require __DIR__ . '/../../links/policy/resolver.php';

$cases = [
    [
        'host' => 'bad-domain.com',
        'expectedAction' => 'deny',
        'expectedMessage' => 'Dominio segnalato per phishing.',
        'minTtl' => 1000,
    ],
    [
        'host' => 'sub.truffa.xyz',
        'expectedAction' => 'deny',
        'expectedMessage' => 'Blocca tutti i sottodomini truffa.xyz.',
        'minTtl' => 1000,
    ],
    [
        'host' => 'github.com',
        'expectedAction' => 'allow',
        'expectedMessage' => 'Repository GitHub verificato.',
        'minTtl' => 3600,
    ],
    [
        'host' => 'blog.tuo-sito.it',
        'expectedAction' => 'allow',
        'expectedMessage' => 'Sottodomini ufficiali tuo-sito.it.',
        'minTtl' => 3600,
    ],
    [
        'host' => 'beta.partner.it',
        'expectedAction' => 'warn',
        'expectedMessage' => 'Ambiente beta: verifica prima di procedere.',
        'minTtl' => 900,
    ],
    [
        'host' => 'unknown.example',
        'expectedAction' => 'warn',
        'expectedMessage' => 'Dominio non presente nelle liste, richiesta conferma utente.',
        'minTtl' => SLG_DEFAULT_WARN_TTL,
    ],
];

$errors = [];

foreach ($cases as $case) {
    $result = slg_resolve_policy($case['host']);
    if ($result['action'] !== $case['expectedAction']) {
        $errors[] = sprintf('Host %s: expected action %s, got %s', $case['host'], $case['expectedAction'], $result['action']);
    }
    if (($result['message'] ?? null) !== $case['expectedMessage']) {
        $errors[] = sprintf('Host %s: expected message "%s", got "%s"', $case['host'], $case['expectedMessage'], $result['message'] ?? '');
    }
    if (!is_int($result['ttl']) || $result['ttl'] < $case['minTtl']) {
        $errors[] = sprintf('Host %s: TTL %s is less than expected %s', $case['host'], (string) ($result['ttl'] ?? 'null'), $case['minTtl']);
    }
}

// Test wildcard matcher directly
if (!slg_match_pattern('docs.example.com', '*.example.com')) {
    $errors[] = 'Wildcard match failed for *.example.com';
}
if (slg_match_pattern('malicious.com', '*.example.com')) {
    $errors[] = 'Wildcard match should not match unrelated domain';
}

if (!empty($errors)) {
    fwrite(STDERR, "Policy resolver tests failed:\n" . implode("\n", $errors) . "\n");
    exit(1);
}

echo "Policy resolver tests passed\n";
