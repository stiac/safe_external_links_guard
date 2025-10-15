<?php
// policy.php
declare(strict_types=1);

require __DIR__ . '/resolver.php';

header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');

// Health check via GET ?health=1
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['health'])) {
        echo json_encode([
            'status' => 'ok',
            'timestamp' => gmdate('c'),
        ]);
        exit;
    }
    http_response_code(405);
    header('Allow: POST');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?: [];

$host = strtolower((string) ($data['host'] ?? ''));
if ($host === '') {
    echo json_encode([
        'action' => 'warn',
        'ttl' => SLG_DEFAULT_WARN_TTL,
        'message' => 'Host non specificato.',
    ]);
    exit;
}

$decision = slg_resolve_policy($host);

echo json_encode($decision);
