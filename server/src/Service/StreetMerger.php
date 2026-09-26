<?php

namespace App\Service;

/**
 * Führt eine vom Client geschickte Straße mit dem gespeicherten Stand zusammen.
 * Regeln (damit mehrere Spieler fair in derselben Straße arbeiten können):
 *
 * - Der Besitzer (oder bei Bot-Straßen: der steuernde Spieler) darf alles an der Straße ändern –
 *   außer Grundstücken, die anderen Spielern gehören.
 * - Andere Spieler dürfen nur (a) ein freies Grundstück für sich kaufen und
 *   (b) ihre eigenen Grundstücke bebauen, ausbauen, umbenennen.
 * - Unveränderlich für alle: ID, Größe, Straßenseite, Platz und Grundpreis eines Grundstücks.
 * - Wer zuerst kauft, gewinnt: Ist ein Grundstück inzwischen vergeben, bleibt es beim ersten Käufer.
 */
final class StreetMerger
{
    private const IMMUTABLE_PLOT_FIELDS = ['id', 'size', 'side', 'index', 'price'];
    private const OWNER_STREET_FIELDS = ['name', 'city', 'osm', 'litter', 'litterCheckedAt'];

    public function merge(array $current, array $incoming, string $writerId, bool $writerManagesStreet): array
    {
        $merged = $current;
        $streetOwner = (string) ($current['ownerId'] ?? '');

        if ($writerManagesStreet) {
            foreach (self::OWNER_STREET_FIELDS as $field) {
                if (array_key_exists($field, $incoming)) {
                    $merged[$field] = $incoming[$field];
                } else {
                    unset($merged[$field]);
                }
            }
        }

        $incomingById = [];
        foreach ((array) ($incoming['plots'] ?? []) as $plot) {
            if (is_array($plot) && isset($plot['id'])) {
                $incomingById[(string) $plot['id']] = $plot;
            }
        }

        $merged['plots'] = [];
        foreach ((array) ($current['plots'] ?? []) as $currentPlot) {
            $candidate = $incomingById[(string) $currentPlot['id']] ?? null;
            $merged['plots'][] = null === $candidate
                ? $currentPlot
                : $this->mergePlot($currentPlot, $candidate, $streetOwner, $writerId, $writerManagesStreet);
        }

        return $merged;
    }

    /** Wem gehört das Grundstück? null = frei. */
    public static function plotOwner(array $plot, string $streetOwner): ?string
    {
        if (!isset($plot['purchasedAt'])) {
            return null;
        }

        return isset($plot['ownerId']) && '' !== $plot['ownerId'] ? (string) $plot['ownerId'] : $streetOwner;
    }

    private function mergePlot(array $current, array $incoming, string $streetOwner, string $writerId, bool $writerManagesStreet): array
    {
        $currentOwner = self::plotOwner($current, $streetOwner);
        $foreignOwned = null !== $currentOwner && $currentOwner !== $streetOwner;

        if ($writerManagesStreet) {
            // Grundstücke anderer Spieler bleiben unangetastet.
            if ($foreignOwned) {
                return $current;
            }
            // Der Besitzer kann keine Grundstücke an andere „verschenken“.
            unset($incoming['ownerId']);

            return $this->withImmutable($incoming, $current);
        }

        // Besucher: eigenes Grundstück bearbeiten …
        if ($currentOwner === $writerId) {
            if (!isset($incoming['purchasedAt'])) {
                return $current; // eigenes Grundstück „wegwerfen“ ist nicht vorgesehen
            }
            $incoming['ownerId'] = $writerId;

            return $this->withImmutable($incoming, $current);
        }

        // … oder ein freies Grundstück kaufen (wer zuerst kommt).
        if (null === $currentOwner && isset($incoming['purchasedAt']) && ($incoming['ownerId'] ?? null) === $writerId) {
            return $this->withImmutable($incoming, $current);
        }

        return $current;
    }

    private function withImmutable(array $plot, array $current): array
    {
        foreach (self::IMMUTABLE_PLOT_FIELDS as $field) {
            $plot[$field] = $current[$field] ?? null;
        }

        return $plot;
    }
}
