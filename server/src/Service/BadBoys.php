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

    /** Tiere und Autos eines Spielers: höchstens so viele Ausflüge pro Tag in dieselbe Straße. */
    public const MAX_VISITS_PER_SENDER_PER_DAY = 12;

    /** Tiere („tier-elefant“) und Autos („auto-mottenwerke-xprotz“) auf Ausflug – kein Bad Boy. */
    public static function isVisitor(string $id): bool
    {
        return 1 === preg_match('/^(tier|auto)-[a-z0-9-]{2,40}$/', $id);
    }

    public static function blocked(array $streetData): bool
    {
        $chance = self::BLOCK_CHANCE[(int) ($streetData['security'] ?? 0)] ?? 0.0;

        return $chance > 0 && random_int(0, 999) < $chance * 1000;
    }
}
