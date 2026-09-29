<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** Ein Konto (Name + Passwort) mit bis zu drei Straßen – jede Straße ist ein eigener Spieler-Spielstand. */
#[ORM\Entity]
#[ORM\Table(name: 'babo_account')]
#[ORM\UniqueConstraint(name: 'babo_account_name', columns: ['name_key'])]
class Account
{
    /** So viele Straßen darf ein Konto gleichzeitig haben. */
    public const MAX_STREETS = 3;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(length: 40)]
    private string $nameKey;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $id,
        #[ORM\Column(length: 40)]
        private string $name,
        #[ORM\Column(length: 255)]
        private string $passwordHash,
    ) {
        $this->nameKey = self::nameKey($name);
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function checkPassword(string $password): bool
    {
        return password_verify($password, $this->passwordHash);
    }

    public function setPassword(string $password): void
    {
        $this->passwordHash = password_hash($password, PASSWORD_DEFAULT);
    }

    /** Groß-/Kleinschreibung und Leerzeichen zählen beim Namen nicht – „Papa Matthias“ = „papa  matthias“. */
    public static function nameKey(string $name): string
    {
        return mb_substr(mb_strtolower((string) preg_replace('/\s+/u', ' ', trim($name))), 0, 40);
    }
}
