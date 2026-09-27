<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Ein Bad Boy, den ein Spieler in die Straße eines anderen geschickt hat. Die Wirkung (welches Haus
 * besprüht wird …) rechnet das Spiel des Opfers aus – es bleibt so der einzige, der seine Straße schreibt.
 */
#[ORM\Entity]
#[ORM\Table(name: 'babo_mischief')]
#[ORM\Index(name: 'babo_mischief_street', columns: ['street_id', 'delivered'])]
#[ORM\Index(name: 'babo_mischief_sender', columns: ['sender_id'])]
class Mischief
{
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private bool $delivered = false;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $id,
        #[ORM\Column(length: 64)]
        private string $streetId,
        #[ORM\Column(length: 64)]
        private string $senderId,
        #[ORM\Column(length: 40)]
        private string $senderName,
        #[ORM\Column(length: 40)]
        private string $badBoy,
        #[ORM\Column]
        private bool $blocked,
        /** Anzeigename bei Tieren und Autos, z. B. „Maxims Elefant Benjamin“. */
        #[ORM\Column(length: 60, nullable: true)]
        private ?string $label = null,
    ) {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getStreetId(): string
    {
        return $this->streetId;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function markDelivered(): void
    {
        $this->delivered = true;
    }

    /** So, wie das Spiel es braucht (Zeit in Millisekunden). */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'badBoyId' => $this->badBoy,
            'at' => (int) $this->createdAt->format('Uv'),
            'blocked' => $this->blocked,
            'senderName' => $this->senderName,
        ] + (null !== $this->label ? ['label' => $this->label] : []);
    }
}
