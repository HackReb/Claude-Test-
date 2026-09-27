<?php

namespace App\Service;

/** Welche Bad Boys es gibt und wie gut der Wachschutz ist – muss zu src/config/badboys.ts im Spiel passen. */
final class BadBoys
{
    public const IDS = ['kaugummi-klaus', 'gassi-gabi', 'muelltonnen-marvin', 'spruehdosen-kevin', 'knallfrosch-zwillinge'];

    /** Abfangchance je Wachschutz-Stufe. */
    public const BLOCK_CHANCE = [1 => 0.4, 2 => 0.75];

    /** Derselbe Absender in dieselbe Straße: höchstens alle so viele Minuten. */
    public const COOLDOWN_MINUTES = 20;

    /** Eine Straße verträgt höchstens so viele Bad Boys pro Tag (von allen zusammen). */
    public const MAX_PER_STREET_PER_DAY = 10;

    public static function blocked(array $streetData): bool
    {
        $chance = self::BLOCK_CHANCE[(int) ($streetData['security'] ?? 0)] ?? 0.0;

        return $chance > 0 && random_int(0, 999) < $chance * 1000;
    }
}
