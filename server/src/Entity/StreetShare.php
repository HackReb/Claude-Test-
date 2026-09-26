<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/** Merkt sich, in welchen fremden Straßen ein Spieler Grundstücke besitzt. */
#[ORM\Entity]
#[ORM\Table(name: 'babo_street_share')]
#[ORM\Index(name: 'babo_share_player', columns: ['player_id'])]
class StreetShare
{
    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $streetId,
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $playerId,
    ) {
    }

    public function getStreetId(): string
    {
        return $this->streetId;
    }

    public function getPlayerId(): string
    {
        return $this->playerId;
    }
}
