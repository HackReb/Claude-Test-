<?php

namespace App\Service;

/** Babo v2: Die Ladentypen der Mall – muss zu src/v2/config/shops.ts im Spiel passen. */
final class ShopTypes
{
    public const IDS = [
        // Mode
        'mode', 'hutmacher', 'schuhladen', 'optiker', 'kostuemverleih', 'schmuck',
        // Tiere
        'tierhandlung', 'aquarium', 'fabelzoo',
        // Technik
        'elektronik', 'videospiele', 'roboterwerkstatt',
        // Freizeit
        'sportladen', 'musikladen', 'spielwaren', 'zauberladen', 'buchladen',
        // Fahrzeuge
        'fahrradladen', 'autohaus', 'raumschiffwerft',
        // Alltag
        'drogerie', 'friseur', 'blumenladen', 'baeckerei', 'eisdiele', 'doener', 'supermarkt', 'kiosk',
        // Ausgefallen
        'ruestungsschmiede', 'piratenbedarf', 'weltraumladen', 'hexenkueche', 'dinoladen', 'superheldenbedarf',
    ];

    /** So viele Läden darf ein Spieler in seiner Mall haben. */
    public const MAX_PER_MEMBER = 3;

    public const LOOKS = 3;

    public static function isValid(string $type): bool
    {
        return in_array($type, self::IDS, true);
    }
}
