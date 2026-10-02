<?php

namespace App\Entity\V2;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** Babo v2: Ein Konto in seiner (einzigen) Straße – mit Münzen, Figur und allem, was ihm gehört. */
#[ORM\Entity]
#[ORM\Table(name: 'v2_member')]
#[ORM\UniqueConstraint(name: 'v2_member_account', columns: ['account_id'])]
#[ORM\Index(name: 'v2_member_street', columns: ['street_id'])]
class Member
{
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $joinedAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $updatedAt;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $id,
        #[ORM\Column(length: 64)]
        private string $streetId,
        #[ORM\Column(length: 64)]
        private string $accountId,
        /** Anzeigename (der Kontoname beim Beitritt). */
        #[ORM\Column(length: 40)]
        private string $name,
        /** Spielstand des Spielers (Münzen, Figur …) – das Spiel rechnet, der Server bewahrt auf. */
        #[ORM\Column(type: Types::JSON)]
        private array $data,
    ) {
        $this->joinedAt = new \DateTimeImmutable();
        $this->updatedAt = $this->joinedAt;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getStreetId(): string
    {
        return $this->streetId;
    }

    public function getAccountId(): string
    {
        return $this->accountId;
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
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getJoinedAt(): \DateTimeImmutable
    {
        return $this->joinedAt;
    }
}
