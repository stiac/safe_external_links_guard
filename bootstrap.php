<?php

declare(strict_types=1);

/**
 * Bootstrap di compatibilità per hosting che includono direttamente
 * "safe_external_links_guard/bootstrap.php". Reindirizza il caricamento
 * verso la nuova posizione (`app/bootstrap.php`) mantenendo inalterate
 * le API pubbliche `safe_external_links_guard_bootstrap()` e helper
 * correlati.
 */
require_once __DIR__ . '/app/bootstrap.php';
