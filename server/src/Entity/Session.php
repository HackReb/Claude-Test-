<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** Angemeldetes Gerät eines Kontos (gespeichert wird nur der Hash des Schlüssels). */
#[ORM\Entity]
#[ORM\Table(name: 'babo_session')]
#[ORM\Index(name: 'babo_session_account', columns: ['account_id'])]
class Session
{
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $tokenHash,
        #[ORM\Column(length: 64)]
        private string $accountId,
    ) {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getAccountId(): string
    {
        return $this->accountId;
    }
}
