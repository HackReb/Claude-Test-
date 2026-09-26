<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** Die Bot-Nachbarschaft eines Spielers (Bots, Kartenrichtungen, Neuigkeiten). */
#[ORM\Entity]
#[ORM\Table(name: 'babo_neighborhood')]
class Neighborhood
{
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $updatedAt;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $playerId,
        #[ORM\Column(type: Types::JSON)]
        private array $data,
    ) {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function setData(array $data): void
    {
        $this->data = $data;
        $this->updatedAt = new \DateTimeImmutable();
    }
}
