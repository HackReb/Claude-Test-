<?php

namespace App\Service;

use App\Entity\Account;
use App\Entity\Player;
use App\Entity\Session;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;

/**
 * Anmeldung per „Authorization: Bearer …“:
 * - Konto-Sitzung + „X-Babo-Player: <Spieler-ID>“ = eine der Straßen des Kontos
 * - älterer Geräte-Schlüssel eines einzelnen Spielstands (bis das Konto eingerichtet ist)
 */
final class Auth
{
    public const PLAYER_HEADER = 'X-Babo-Player';

    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function player(Request $request): Player
    {
        $token = self::token($request);
        $playerId = trim((string) $request->headers->get(self::PLAYER_HEADER, ''));
        if ('' !== $playerId) {
            $session = $this->session($request);
            $player = $this->em->find(Player::class, $playerId);
            if (!$player instanceof Player) {
                throw new UnauthorizedHttpException('Bearer', 'Diese Straße gibt es nicht mehr.');
            }
            if ($player->getAccountId() !== $session->getAccountId()) {
                throw new AccessDeniedHttpException('Diese Straße gehört nicht zu deinem Konto.');
            }

            return $player;
        }
        $player = '' === $token ? null : $this->em->getRepository(Player::class)->findOneBy(['tokenHash' => Credentials::hash($token)]);
        if (!$player instanceof Player) {
            throw new UnauthorizedHttpException('Bearer', 'Nicht angemeldet.');
        }

        return $player;
    }

    public function session(Request $request): Session
    {
        $token = self::token($request);
        $session = '' === $token ? null : $this->em->find(Session::class, Credentials::hash($token));
        if (!$session instanceof Session) {
            throw new UnauthorizedHttpException('Bearer', 'Nicht angemeldet.');
        }

        return $session;
    }

    public function account(Request $request): Account
    {
        $account = $this->em->find(Account::class, $this->session($request)->getAccountId());
        if (!$account instanceof Account) {
            throw new UnauthorizedHttpException('Bearer', 'Konto gibt es nicht mehr.');
        }

        return $account;
    }

    /** Älterer Spielstand ohne Konto, der mit seinem Geräte-Schlüssel kommt (sonst null). */
    public function legacyPlayer(Request $request): ?Player
    {
        $token = self::token($request);
        $player = '' === $token ? null : $this->em->getRepository(Player::class)->findOneBy(['tokenHash' => Credentials::hash($token)]);

        return $player instanceof Player && null === $player->getAccountId() ? $player : null;
    }

    private static function token(Request $request): string
    {
        $header = (string) $request->headers->get('Authorization', '');

        return str_starts_with($header, 'Bearer ') ? trim(substr($header, 7)) : '';
    }
}
