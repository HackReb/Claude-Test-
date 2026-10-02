<?php

namespace App\Entity\V2;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** Babo v2: Was in einer Straße passiert ist – für die Zeitung (neue Spieler, Läden, Waren, Käufe). */
#[ORM\Entity]
#[ORM\Table(name: 'v2_event')]
#[ORM\Index(name: 'v2_event_street', columns: ['street_id', 'at_us'])]
class Event
{
    /** Zeitpunkt in Mikrosekunden – damit die Reihenfolge auch innerhalb einer Sekunde stimmt. */
    #[ORM\Column(name: 'at_us', type: Types::BIGINT)]
    private int $atUs;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 64)]
        private string $id,
        #[ORM\Column(length: 64)]
        private string $streetId,
        /** join, leave, shop, close, item, buy */
        #[ORM\Column(length: 24)]
        private string $kind,
        /** Wer es war (Name steht mit drin, falls der Spieler später geht). */
        #[ORM\Column(length: 64, nullable: true)]
        private ?string $memberId,
        #[ORM\Column(type: Types::JSON)]
        private array $data,
    ) {
        $this->atUs = (int) floor(microtime(true) * 1_000_000);
    }

    public function getStreetId(): string
    {
        return $this->streetId;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'memberId' => $this->memberId,
            'at' => intdiv($this->atUs, 1000),
            'data' => (object) $this->data,
        ];
    }
}
