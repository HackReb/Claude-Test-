<?php

namespace App\Service;

/** Geräte-Schlüssel und Wiederherstellungs-Codes (anonymes Anmelden ohne Passwort). */
final class Credentials
{
    /** Ohne leicht verwechselbare Zeichen (0/O, 1/I/L). */
    private const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    public static function newToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    /** z. B. „BABO-7KQX-M2PD-9TRW“ */
    public static function newRecoveryCode(): string
    {
        $groups = [];
        for ($g = 0; $g < 3; ++$g) {
            $group = '';
            for ($i = 0; $i < 4; ++$i) {
                $group .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
            }
            $groups[] = $group;
        }

        return 'BABO-'.implode('-', $groups);
    }

    public static function normalizeRecoveryCode(string $code): string
    {
        $clean = preg_replace('/[^A-Z0-9]/', '', strtoupper($code)) ?? '';
        if (str_starts_with($clean, 'BABO')) {
            $clean = substr($clean, 4);
        }

        return 'BABO-'.implode('-', str_split($clean, 4));
    }

    public static function hash(string $secret): string
    {
        return hash('sha256', $secret);
    }
}
