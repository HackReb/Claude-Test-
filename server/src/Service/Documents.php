<?php

namespace App\Service;

use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/** Grundlegende Prüfung der Spiel-Dokumente, die der Client schickt. */
final class Documents
{
    public const MAX_BODY_BYTES = 512 * 1024;
    private const ID_PATTERN = '/^[A-Za-z0-9_-]{6,64}$/';
    private const PLOT_SIZES = ['S', 'M', 'L'];

    public static function json(string $body): array
    {
        if (strlen($body) > self::MAX_BODY_BYTES) {
            throw new BadRequestHttpException('Anfrage zu groß.');
        }
        try {
            $data = json_decode($body, true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new BadRequestHttpException('Kein gültiges JSON.');
        }
        if (!is_array($data)) {
            throw new BadRequestHttpException('JSON-Objekt erwartet.');
        }

        return $data;
    }

    public static function id(mixed $value, string $what): string
    {
        if (!is_string($value) || !preg_match(self::ID_PATTERN, $value)) {
            throw new BadRequestHttpException("Ungültige ID: $what.");
        }

        return $value;
    }

    public static function player(mixed $player): array
    {
        if (!is_array($player)) {
            throw new BadRequestHttpException('Spieler fehlt.');
        }
        self::id($player['id'] ?? null, 'player.id');
        self::id($player['streetId'] ?? null, 'player.streetId');
        $name = trim((string) ($player['name'] ?? ''));
        if ('' === $name || mb_strlen($name) > 40) {
            throw new BadRequestHttpException('Name fehlt oder ist zu lang.');
        }
        if (!is_numeric($player['coins'] ?? null)) {
            throw new BadRequestHttpException('Münzen fehlen.');
        }

        return $player;
    }

    public static function street(mixed $street): array
    {
        if (!is_array($street)) {
            throw new BadRequestHttpException('Straße fehlt.');
        }
        self::id($street['id'] ?? null, 'street.id');
        self::id($street['ownerId'] ?? null, 'street.ownerId');
        foreach (['name', 'city'] as $field) {
            $value = trim((string) ($street[$field] ?? ''));
            if ('' === $value || mb_strlen($value) > 80) {
                throw new BadRequestHttpException("Straße: $field fehlt oder ist zu lang.");
            }
        }
        $plots = $street['plots'] ?? null;
        if (!is_array($plots) || count($plots) < 1 || count($plots) > 24) {
            throw new BadRequestHttpException('Straße: Grundstücke fehlen.');
        }
        foreach ($plots as $plot) {
            if (!is_array($plot) || !in_array($plot['size'] ?? null, self::PLOT_SIZES, true)) {
                throw new BadRequestHttpException('Straße: ungültiges Grundstück.');
            }
            self::id($plot['id'] ?? null, 'plot.id');
        }

        return $street;
    }

    public static function osmKey(array $street): ?string
    {
        $key = $street['osm']['key'] ?? null;

        return is_string($key) && '' !== $key ? mb_substr($key, 0, 190) : null;
    }
}
