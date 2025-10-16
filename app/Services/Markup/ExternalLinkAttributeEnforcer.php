<?php

namespace App\Services\Markup;

/**
 * Esegue una scansione del markup HTML e applica gli attributi di sicurezza ai link esterni.
 * Pensato per l'esecuzione build-time o server-side, così i bot ricevono direttamente
 * target="_blank" e rel="noopener noreferrer nofollow" senza attendere JavaScript.
 */
class ExternalLinkAttributeEnforcer
{
    /** @var array<string> */
    private array $allowlist;

    /** @var array<string> */
    private array $ignoredSchemes = ['mailto', 'tel', 'javascript', 'data', 'blob'];

    /** @var array<string> */
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

    /**
     * Applica gli attributi di sicurezza a ogni tag <a> esterno trovato nel markup.
     */
    public function enforce(string $html): string
    {
        if ($html === '' || stripos($html, '<a') === false) {
            return $html;
        }

        $callback = function (array $matches): string {
            return $this->rewriteAnchorTag($matches[0]);
        };

        return (string) preg_replace_callback("~<a\\b[^>]*>~i", $callback, $html);
    }

    /**
     * Reimposta gli attributi target e rel sul tag fornito, se necessario.
     */
    private function rewriteAnchorTag(string $tag): string
    {
        $href = $this->extractHref($tag);
        if ($href === null || $this->shouldIgnore($href)) {
            return $tag;
        }

        $url = $this->normalizeUrl($href);
        if ($url === null || $this->isAllowlisted($url['host'])) {
            return $tag;
        }

        $tag = $this->ensureTargetAttribute($tag);

        if (!empty($this->relTokens)) {
            $tag = $this->ensureRelAttribute($tag);
        }

        return $tag;
    }

    /**
     * Estrae l'attributo href dal tag originale mantenendo intatto l'HTML in uscita.
     */
    private function extractHref(string $tag): ?string
    {
        if (preg_match("~\\bhref\\s*=\\s*([\"'])(.*?)\\1~i", $tag, $matches)) {
            return html_entity_decode($matches[2], ENT_QUOTES | ENT_HTML5);
        }

        if (preg_match("~\\bhref\\s*=\\s*([^\\s\"'<>]+)~i", $tag, $matches)) {
            return html_entity_decode($matches[1], ENT_QUOTES | ENT_HTML5);
        }

        return null;
    }

    /**
     * Garantisce che il tag abbia target="_blank", preservando il quoting originale se presente.
     */
    private function ensureTargetAttribute(string $tag): string
    {
        if (preg_match("~\\btarget\\s*=\\s*([\"'])(.*?)\\1~i", $tag, $matches, PREG_OFFSET_CAPTURE)) {
            $quote = $matches[1][0];
            $replacement = 'target=' . $quote . '_blank' . $quote;
            return substr_replace($tag, $replacement, $matches[0][1], strlen($matches[0][0]));
        }

        if (preg_match("~\\btarget\\s*=\\s*([^\\s\"'<>]+)~i", $tag, $matches, PREG_OFFSET_CAPTURE)) {
            $replacement = 'target="_blank"';
            return substr_replace($tag, $replacement, $matches[0][1], strlen($matches[0][0]));
        }

        return $this->appendAttribute($tag, 'target="_blank"');
    }

    /**
     * Inserisce o aggiorna l'attributo rel con i token di sicurezza richiesti.
     */
    private function ensureRelAttribute(string $tag): string
    {
        if (preg_match("~\\brel\\s*=\\s*([\"'])(.*?)\\1~i", $tag, $matches, PREG_OFFSET_CAPTURE)) {
            $quote = $matches[1][0];
            $existing = $matches[2][0];
            $merged = $this->mergeRelTokens($existing);
            $replacement = 'rel=' . $quote . $merged . $quote;
            return substr_replace($tag, $replacement, $matches[0][1], strlen($matches[0][0]));
        }

        if (preg_match("~\\brel\\s*=\\s*([^\\s\"'<>]+)~i", $tag, $matches, PREG_OFFSET_CAPTURE)) {
            $existing = $matches[1][0];
            $merged = $this->mergeRelTokens($existing);
            $replacement = 'rel="' . htmlspecialchars($merged, ENT_QUOTES | ENT_HTML5) . '"';
            return substr_replace($tag, $replacement, $matches[0][1], strlen($matches[0][0]));
        }

        $value = htmlspecialchars($this->mergeRelTokens(''), ENT_QUOTES | ENT_HTML5);
        return $this->appendAttribute($tag, 'rel="' . $value . '"');
    }

    /**
     * Aggiunge un attributo in coda al tag rispettando eventuali self closing.
     */
    private function appendAttribute(string $tag, string $attribute): string
    {
        $selfClosing = str_ends_with($tag, '/>');
        $ending = $selfClosing ? '/>' : '>';
        $prefix = substr($tag, 0, -strlen($ending));

        if (!preg_match("~\\s$~", $prefix)) {
            $prefix .= ' ';
        }

        return $prefix . $attribute . $ending;
    }

    /**
     * Indica se l'URL utilizza uno schema che va ignorato (mailto:, tel:, ecc.).
     */
    private function shouldIgnore(string $href): bool
    {
        foreach ($this->ignoredSchemes as $scheme) {
            if (stripos($href, $scheme . ':') === 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Normalizza l'URL e restituisce l'host per i confronti di allowlist.
     */
    private function normalizeUrl(string $href): ?array
    {
        $url = @parse_url($href);
        if (!is_array($url)) {
            return null;
        }

        if (empty($url['host'])) {
            // Gli URL relativi vengono considerati interni.
            return null;
        }

        return [
            'host' => strtolower($url['host']),
        ];
    }

    /**
     * Riconosce se l'host specificato rientra nell'allowlist.
     */
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

    /**
     * Normalizza i token rel rimuovendo duplicati e spazi superflui.
     *
     * @param array<string> $tokens
     * @return array<string>
     */
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

    /**
     * Esegue il merge tra i token rel già presenti e quelli di sicurezza richiesti.
     */
    private function mergeRelTokens(?string $existing): string
    {
        $existingTokens = [];

        if (is_string($existing) && trim($existing) !== '') {
            $existingTokens = preg_split("~\\s+~", trim($existing)) ?: [];
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
