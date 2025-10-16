<?php

declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

function run_test(string $name, callable $callback): void
{
    try {
        $callback();
        echo "[pass] {$name}\n";
    } catch (Throwable $throwable) {
        echo "[fail] {$name}: {$throwable->getMessage()}\n";
        exit(1);
    }
}

function capture_bootstrap_output(array $options, string $html): string
{
    ob_start();
    safe_external_links_guard_bootstrap($options);
    echo $html;
    safe_external_links_guard_bootstrap_release();
    return (string) ob_get_clean();
}

run_test('aggiunge noopener e noreferrer di default', function () {
    $output = capture_bootstrap_output([], '<a href="https://example.com">Link</a>');
    if (strpos($output, 'target="_blank"') === false) {
        throw new RuntimeException('target non impostato su _blank');
    }
    if (strpos($output, 'rel="noopener noreferrer nofollow"') === false) {
        throw new RuntimeException('rel predefinito non applicato');
    }
});

run_test('configurazione rel_strategy="noopener" e nofollow disabilitato', function () {
    $output = capture_bootstrap_output(
        ['rel_strategy' => 'noopener', 'add_nofollow' => false],
        '<a href="https://example.com" rel="sponsored">Link</a>'
    );

    if (strpos($output, 'rel="sponsored noopener"') === false) {
        throw new RuntimeException('rel personalizzato non mantenuto');
    }
    if (strpos($output, 'noreferrer') !== false) {
        throw new RuntimeException('noreferrer non dovrebbe essere presente');
    }
});

run_test('rispetta la allowlist ed evita modifiche', function () {
    $output = capture_bootstrap_output(
        ['allowlist' => ['interno.test']],
        '<a href="https://interno.test" target="_self">Link</a>'
    );

    if ($output !== '<a href="https://interno.test" target="_self">Link</a>') {
        throw new RuntimeException('il link consentito non dovrebbe cambiare');
    }
});

run_test('modalità disabilitata non avvia il buffer', function () {
    $html = '<a href="https://example.com">Link</a>';
    ob_start();
    safe_external_links_guard_bootstrap(['enabled' => false]);
    echo $html;
    $output = ob_get_clean();

    if ($output !== $html) {
        throw new RuntimeException('quando disabilitato il markup deve restare invariato');
    }
});

run_test('mantiene markup complesso senza spezzare l\'HTML', function () {
    $html = '<div><a class="btn" data-track="1" href="https://example.com" target="_self">Vai</a><span>Ok</span></div>';
    $output = capture_bootstrap_output([], $html);

    $expected = '<div><a class="btn" data-track="1" href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">Vai</a><span>Ok</span></div>';

    if ($output !== $expected) {
        throw new RuntimeException('il markup atteso non coincide con l\'output');
    }
});

run_test('ignora i link relativi lasciando invariato il markup', function () {
    $html = '<nav><a href="/percorso">Interno</a></nav>';
    $output = capture_bootstrap_output([], $html);

    if ($output !== $html) {
        throw new RuntimeException('i link relativi non devono essere modificati');
    }
});
