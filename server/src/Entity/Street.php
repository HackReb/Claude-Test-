<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Eine Straße: die eines Spielers (controllerId = null) oder eine Bot-Straße,
 * die ein Spieler für seine Nachbarschaft simuliert (controllerId = dieser Spieler).
 */
#[ORM\Entity]
#[ORM\Table(name: 'babo_street')]
#[ORM\UniqueConstraint(name: 'babo_street_osm', columns: ['osm_key'])]
#[ORM\Index(name: 'babo_street_owner', columns: ['owner_id'])]
#[ORM\Index(name: 'babo_street_controller', columns: ['controller_id'])]
#[ORM\Index(name: 'babo_street_city', columns: ['city_key'])]
class Street
{
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $updatedAt;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $id,
        #[ORM\Column(length: 64)]
        private string $ownerId,
        /** Bei Bot-Straßen: der Spieler, dessen Nachbarschaft sie gehört. */
        #[ORM\Column(length: 64, nullable: true)]
        private ?string $controllerId,
        /** OSM-Kennung echter Straßen – nur für Spieler-Straßen gesetzt: jede echte Straße gehört nur einem. */
        #[ORM\Column(length: 190, nullable: true)]
        private ?string $osmKey,
        /** Ort in Kleinbuchstaben, für „Spieler in deinem Ort“. */
        #[ORM\Column(length: 80)]
        private string $cityKey,
        #[ORM\Column(type: Types::JSON)]
        private array $data,
    ) {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getOwnerId(): string
    {
        return $this->ownerId;
    }

    public function getControllerId(): ?string
    {
        return $this->controllerId;
    }

    public function setOsmKey(?string $osmKey): void
    {
        $this->osmKey = $osmKey;
    }

    public function isBotStreet(): bool
    {
        return null !== $this->controllerId;
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function setData(array $data): void
    {
        $this->data = $data;
        $this->cityKey = self::cityKey((string) ($data['city'] ?? ''));
        $this->updatedAt = new \DateTimeImmutable();
    }

    /** Darf `$playerId` diese Straße als Besitzer bearbeiten (eigene oder eigene Bot-Straße)? */
    public function isManagedBy(string $playerId): bool
    {
        return $this->ownerId === $playerId || $this->controllerId === $playerId;
    }

    public static function cityKey(string $city): string
    {
        return mb_substr(mb_strtolower(trim($city)), 0, 80);
    }

    /** Straßenname zum Vergleichen: „Bahnhof-Str.“, „bahnhofstr“ und „Bahnhofstraße“ sind dieselbe Straße. */
    public static function nameKey(string $name): string
    {
        $key = mb_strtolower(trim($name));
        $key = (string) preg_replace('/str\.?$|strasse$/u', 'straße', (string) preg_replace('/[\s\-.]+(?=str)/u', '', $key));

        return (string) preg_replace('/[\s\-]+/u', '', $key);
    }
}
