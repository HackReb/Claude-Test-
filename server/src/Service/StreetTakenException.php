<?php

namespace App\Service;

use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/** Die echte Straße gehört schon einem anderen Spieler. */
final class StreetTakenException extends ConflictHttpException
{
    public function __construct(public readonly ?string $ownerName)
    {
        parent::__construct('street-taken');
    }
}
