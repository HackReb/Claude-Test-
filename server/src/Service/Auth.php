<?php

namespace App\Service;

use App\Entity\Player;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;

/** Findet den Spieler zum Geräte-Schlüssel im Header „Authorization: Bearer …“. */
final class Auth
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function player(Request $request): Player
    {
        $header = (string) $request->headers->get('Authorization', '');
        $token = str_starts_with($header, 'Bearer ') ? trim(substr($header, 7)) : '';
        $player = '' === $token ? null : $this->em->getRepository(Player::class)->findOneBy(['tokenHash' => Credentials::hash($token)]);
        if (!$player instanceof Player) {
            throw new UnauthorizedHttpException('Bearer', 'Nicht angemeldet.');
        }

        return $player;
    }
}
