<?php

namespace App\Entity\V2;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** Babo v2: Ein Laden in der Mall – Typ, selbst gewählter Name, Fassaden-Variante; später das Sortiment. */
#[ORM\Entity]
#[ORM\Table(name: 'v2_shop')]
#[ORM\Index(name: 'v2_shop_street', columns: ['street_id'])]
#[ORM\Index(name: 'v2_shop_member', columns: ['member_id'])]
class Shop
{
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $id,
        #[ORM\Column(length: 64)]
        private string $streetId,
        #[ORM\Column(length: 64)]
        private string $memberId,
        #[ORM\Column(length: 40)]
        private string $type,
        #[ORM\Column(length: 40)]
        private string $name,
        /** Welche der Fassaden des Ladentyps (0, 1, 2). */
        #[ORM\Column(type: Types::SMALLINT)]
        private int $look,
        /** Sortiment, Kasse usw. */
        #[ORM\Column(type: Types::JSON)]
        private array $data,
    ) {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getStreetId(): string
    {
        return $this->streetId;
    }

    public function getMemberId(): string
    {
        return $this->memberId;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getLook(): int
    {
        return $this->look;
    }

    public function setLook(int $look): void
    {
        $this->look = $look;
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function setData(array $data): void
    {
        $this->data = $data;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    /** So, wie das Spiel es braucht. */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'memberId' => $this->memberId,
            'type' => $this->type,
            'name' => $this->name,
            'look' => $this->look,
            'openedAt' => (int) $this->createdAt->format('Uv'),
            'data' => (object) $this->data,
        ];
    }
}
