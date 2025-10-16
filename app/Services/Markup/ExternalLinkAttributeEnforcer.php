<?php

namespace App\Services\Markup;

use DOMDocument;

/**
 * Esegue una scansione del markup HTML e applica gli attributi di sicurezza ai link esterni.
 * Pensato per l'esecuzione build-time o server-side, così i bot ricevono direttamente
 * target="_blank" e rel="noopener noreferrer nofollow" senza attendere JavaScript.
 */
class ExternalLinkAttributeEnforcer
{
    private array $allowlist;
    private array $ignoredSchemes = ['mailto', 'tel', 'javascript', 'data', 'blob'];
    private array $relTokens;

    /**
     * @param array $allowlist Elenco dei domini consentiti (no normalizzazione schema).
     * @param array $relTokens Token da aggiungere al valore dell'attributo rel.
     */
    public function __construct(array $allowlist = [], array $relTokens = ['noopener', 'noreferrer', 'nofollow'])
    {
        $this->allowlist = array_map('strtolower', $allowlist);
        $this->relTokens = $this->normalizeRelTokens($relTokens);
    }

    public function enforce(string $html): string
    {
        if ($html === '') {
            return $html;
        }

        $document = new DOMDocument('1.0', 'UTF-8');
        @$document->loadHTML(
            '<?xml encoding="utf-8" ?>' . $html,
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );

        foreach ($document->getElementsByTagName('a') as $anchor) {
            if (!$anchor->hasAttribute('href')) {
                continue;
            }

            $href = $anchor->getAttribute('href');
            if ($this->shouldIgnore($href)) {
                continue;
            }

            $url = $this->normalizeUrl($href);
            if (!$url || $this->isAllowlisted($url['host'])) {
                continue;
            }

            $anchor->setAttribute('target', '_blank');

            if (!empty($this->relTokens)) {
                $anchor->setAttribute('rel', $this->mergeRelTokens($anchor->getAttribute('rel')));
            }
        }

        $html = $document->saveHTML();
        $html = preg_replace('/^<\?xml[^>]+>/', '', $html);

        if (!is_string($html)) {
            return '';
        }

        return rtrim($html, "\r\n");
    }

    private function shouldIgnore(string $href): bool
    {
        foreach ($this->ignoredSchemes as $scheme) {
            if (stripos($href, $scheme . ':') === 0) {
                return true;
            }
        }
        return false;
    }

    private function normalizeUrl(string $href): ?array
    {
        $url = @parse_url($href);
        if (!is_array($url) || empty($url['host'])) {
            $url = @parse_url('http://placeholder' . ltrim($href, '/'));
            if (!is_array($url) || empty($url['host'])) {
                return null;
            }
        }

        return [
            'host' => strtolower($url['host']),
        ];
    }

    private function isAllowlisted(string $host): bool
    {
        if ($host === '' || $host === strtolower($_SERVER['HTTP_HOST'] ?? '')) {
            return true;
        }

        foreach ($this->allowlist as $pattern) {
            if (str_starts_with($pattern, '*.')) {
                $suffix = substr($pattern, 1);
                if ($host === substr($pattern, 2) || str_ends_with($host, $suffix)) {
                    return true;
                }
            }

            if ($host === $pattern) {
                return true;
            }
        }

        return false;
    }

    private function normalizeRelTokens(array $tokens): array
    {
        $normalized = [];

        foreach ($tokens as $token) {
            $token = strtolower(trim((string) $token));
            if ($token !== '' && !in_array($token, $normalized, true)) {
                $normalized[] = $token;
            }
        }

        return $normalized;
    }

    private function mergeRelTokens(?string $existing): string
    {
        $existingTokens = [];

        if (is_string($existing) && trim($existing) !== '') {
            $existingTokens = preg_split('/\s+/', trim($existing)) ?: [];
        }

        $merged = $existingTokens;

        foreach ($this->relTokens as $token) {
            if (!in_array($token, $merged, true)) {
                $merged[] = $token;
            }
        }

        return implode(' ', $merged);
    }
}
