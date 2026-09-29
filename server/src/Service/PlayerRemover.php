<?php

namespace App\Service;

use App\Entity\Mischief;
use App\Entity\Neighborhood;
use App\Entity\Player;
use App\Entity\Street;
use App\Entity\StreetShare;
use Doctrine\ORM\EntityManagerInterface;

/** Löscht einen Spielstand: eigene und Bot-Straßen weg, Grundstücke in fremden Straßen werden wieder frei. */
final class PlayerRemover
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    /** Ohne flush – das macht der Aufrufer. */
    public function remove(Player $player): void
    {
        $playerId = $player->getId();
        $streets = $this->em->getRepository(Street::class);

        foreach ([...$streets->findBy(['ownerId' => $playerId]), ...$streets->findBy(['controllerId' => $playerId])] as $street) {
            $this->em->remove($street);
        }
        foreach ($this->em->getRepository(StreetShare::class)->findBy(['playerId' => $playerId]) as $share) {
            $street = $this->em->find(Street::class, $share->getStreetId());
            if ($street instanceof Street) {
                $street->setData(self::releasePlots($street->getData(), $playerId));
            }
            $this->em->remove($share);
        }
        $this->em->createQueryBuilder()->delete(Mischief::class, 'm')
            ->where('m.senderId = :me')->orWhere('m.streetId = :street')
            ->setParameter('me', $playerId)->setParameter('street', $player->getStreetId())
            ->getQuery()->execute();
        $hood = $this->em->find(Neighborhood::class, $playerId);
        if (null !== $hood) {
            $this->em->remove($hood);
        }
        $this->em->remove($player);
    }

    private static function releasePlots(array $doc, string $playerId): array
    {
        foreach ((array) ($doc['plots'] ?? []) as $i => $plot) {
            if (($plot['ownerId'] ?? null) === $playerId) {
                $doc['plots'][$i] = array_intersect_key($plot, array_flip(['id', 'size', 'side', 'index', 'price']));
            }
        }

        return $doc;
    }
}
