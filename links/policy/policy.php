<?php
// policy.php
declare(strict_types=1);

// Facoltativo: verifica Origin/CSRF base
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  header('Allow: POST');
  exit;
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?: [];

$host = strtolower($data['host'] ?? '');
if ($host === '') {
  echo json_encode(['action' => 'warn', 'ttl' => 300]);
  exit;
}

// ——— Liste PRIVATE lato server ———
// Supporto wildcard con suffissi.
$ALLOW = [
  'tuo-sito.it',
  '*.tuo-sito.it',
  'github.com',
  'openai.com',
];
$DENY = [
  'bad-domain.com',
  '*.truffa.xyz',
  'phishing.example',
  'getmanylinks.ru'
];

// Match con wildcard "*.dominio.tld"
$match = function (string $host, string $pattern): bool {
  $host = strtolower($host);
  $pattern = strtolower($pattern);
  if (strpos($pattern, '*.') === 0) {
    $base = substr($pattern, 2);
    return $host === $base || str_ends_with($host, '.' . $base);
  }
  return $host === $pattern;
};

$inList = function (string $host, array $list) use ($match): bool {
  foreach ($list as $p) { if ($match($host, $p)) return true; }
  return false;
};

// Decisione
if ($inList($host, $DENY)) {
  echo json_encode(['action' => 'deny', 'ttl' => 3600]);
  exit;
}
if ($inList($host, $ALLOW)) {
  echo json_encode(['action' => 'allow', 'ttl' => 3600]);
  exit;
}

// Default: warn (mostra popup)
echo json_encode(['action' => 'warn', 'ttl' => 900]);
