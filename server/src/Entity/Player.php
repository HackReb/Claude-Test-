<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Ein Spieler. Das Spiel-Dokument (Münzen, Autos, …) liegt als JSON in `data`,
 * so bleibt der Server unabhängig von Änderungen am Spielmodell.
 */
#[ORM\Entity]
#[ORM\Table(name: 'babo_player')]
#[ORM\UniqueConstraint(name: 'babo_player_token', columns: ['token_hash'])]
#[ORM\UniqueConstraint(name: 'babo_player_recovery', columns: ['recovery_hash'])]
class Player
{
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $updatedAt;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $id,
        #[ORM\Column(length: 40)]
        private string $name,
        /** SHA-256 des Geräte-Schlüssels (der Schlüssel selbst wird nie gespeichert). */
        #[ORM\Column(length: 64)]
        private string $tokenHash,
        /** SHA-256 des Wiederherstellungs-Codes. */
        #[ORM\Column(length: 64)]
        private string $recoveryHash,
        #[ORM\Column(type: Types::JSON)]
        private array $data,
    ) {
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

    public function getData(): array
    {
        return $this->data;
    }

    public function setData(array $data): void
    {
        $this->data = $data;
        $this->name = mb_substr((string) ($data['name'] ?? $this->name), 0, 40);
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getStreetId(): string
    {
        return (string) ($this->data['streetId'] ?? '');
    }

    public function setTokenHash(string $tokenHash): void
    {
        $this->tokenHash = $tokenHash;
    }

    public function setRecoveryHash(string $recoveryHash): void
    {
        $this->recoveryHash = $recoveryHash;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }
}
