<?php

namespace App\Entity\V2;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Babo v2: Eine echte Straße mit genau einer Mall. Bis zu MAX_MEMBERS Spieler gehören dazu;
 * der erste, der sie wählt, ist der Gründer. Häuser und Bewohner rechnet das Spiel aus (nicht gespeichert).
 */
#[ORM\Entity]
#[ORM\Table(name: 'v2_street')]
#[ORM\UniqueConstraint(name: 'v2_street_osm', columns: ['osm_key'])]
#[ORM\UniqueConstraint(name: 'v2_street_place', columns: ['city_key', 'name_key'])]
class Street
{
    public const MAX_MEMBERS = 50;

    #[ORM\Column(length: 120)]
    private string $nameKey;

    #[ORM\Column(length: 80)]
    private string $cityKey;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $updatedAt;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $id,
        #[ORM\Column(length: 80)]
        private string $name,
        #[ORM\Column(length: 80)]
        private string $city,
        /** OSM-Kennung, wenn die Straße auf der Karte bestätigt wurde. */
        #[ORM\Column(length: 190, nullable: true)]
        private ?string $osmKey,
        #[ORM\Column(length: 64)]
        private string $founderAccountId,
        /** Freie Angaben: OSM-Verweis (lat/lon …), später Mall-Kasse usw. */
        #[ORM\Column(type: Types::JSON)]
        private array $data,
    ) {
        $this->nameKey = \App\Entity\Street::nameKey($name);
        $this->cityKey = \App\Entity\Street::cityKey($city);
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = $this->createdAt;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getCity(): string
    {
        return $this->city;
    }

    public function getOsmKey(): ?string
    {
        return $this->osmKey;
    }

    public function getFounderAccountId(): string
    {
        return $this->founderAccountId;
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

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }
}
