<?php

namespace App\Controller;

use App\Entity\Account;
use App\Entity\Player;
use App\Entity\Session;
use App\Entity\Street;
use App\Service\Auth;
use App\Service\Credentials;
use App\Service\Documents;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Konten: Name + Passwort, bis zu drei Straßen (jede ein eigener Spielstand).
 * Ältere Spielstände ohne Konto werden beim Einrichten übernommen; weitere hängt man mit ihrem BABO-Code an.
 */
#[Route('/api/account')]
final class AccountController
{
    private const NAME_MIN = 3;
    private const NAME_MAX = 20;
    private const PASSWORD_MIN = 6;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Auth $auth,
    ) {
    }

    /** Neues Konto. Kommt ein älterer Spielstand mit seinem Geräte-Schlüssel mit, gehört er ab jetzt dazu. */
    #[Route('/register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        $body = Documents::json($request->getContent());
        $name = self::cleanName((string) ($body['name'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        if (mb_strlen($name) < self::NAME_MIN || mb_strlen($name) > self::NAME_MAX) {
            throw new BadRequestHttpException(\sprintf('Der Name braucht %d bis %d Zeichen.', self::NAME_MIN, self::NAME_MAX));
        }
        if (mb_strlen($password) < self::PASSWORD_MIN) {
            throw new BadRequestHttpException(\sprintf('Das Passwort braucht mindestens %d Zeichen.', self::PASSWORD_MIN));
        }
        if (null !== $this->em->getRepository(Account::class)->findOneBy(['nameKey' => Account::nameKey($name)])) {
            throw new ConflictHttpException('Diesen Namen gibt es schon. Such dir einen anderen aus.');
        }

        $account = new Account(Credentials::newToken(), $name, '');
        $account->setPassword($password);
        $this->em->persist($account);
        $this->auth->legacyPlayer($request)?->setAccountId($account->getId());

        return $this->signIn($account, 201);
    }

    #[Route('/login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $body = Documents::json($request->getContent());
        $account = $this->em->getRepository(Account::class)->findOneBy(['nameKey' => Account::nameKey((string) ($body['name'] ?? ''))]);
        if (!$account instanceof Account || !$account->checkPassword((string) ($body['password'] ?? ''))) {
            usleep(300_000); // Raten bremsen
            throw new UnauthorizedHttpException('Password', 'Name oder Passwort stimmt nicht.');
        }

        return $this->signIn($account, 200);
    }

    #[Route('', methods: ['GET'])]
    public function me(Request $request): JsonResponse
    {
        return new JsonResponse($this->describe($this->auth->account($request)));
    }

    #[Route('/logout', methods: ['POST'])]
    public function logout(Request $request): JsonResponse
    {
        $this->em->remove($this->auth->session($request));
        $this->em->flush();

        return new JsonResponse(['ok' => true]);
    }

    /** Einen älteren Spielstand per BABO-Code an das Konto hängen (höchstens drei Straßen). */
    #[Route('/attach', methods: ['POST'])]
    public function attach(Request $request): JsonResponse
    {
        $account = $this->auth->account($request);
        $code = Credentials::normalizeRecoveryCode((string) (Documents::json($request->getContent())['code'] ?? ''));
        $player = $this->em->getRepository(Player::class)->findOneBy(['recoveryHash' => Credentials::hash($code)]);
        if (!$player instanceof Player) {
            throw new NotFoundHttpException('Diesen Code kennen wir nicht.');
        }
        if ($player->getAccountId() !== $account->getId()) {
            if (null !== $player->getAccountId()) {
                throw new ConflictHttpException('Diese Straße gehört schon zu einem anderen Konto.');
            }
            if (\count($this->playersOf($account)) >= Account::MAX_STREETS) {
                throw new ConflictHttpException(\sprintf('Höchstens %d Straßen pro Konto.', Account::MAX_STREETS));
            }
            $player->setAccountId($account->getId());
            $this->em->flush();
        }

        return new JsonResponse($this->describe($account));
    }

    private function signIn(Account $account, int $status): JsonResponse
    {
        $token = Credentials::newToken();
        $this->em->persist(new Session(Credentials::hash($token), $account->getId()));
        $this->em->flush();

        return new JsonResponse(['token' => $token] + $this->describe($account), $status);
    }

    /** Konto mit seinen Straßen (für die Auswahl nach dem Anmelden). */
    private function describe(Account $account): array
    {
        $streets = array_map(function (Player $player) {
            $street = $this->em->find(Street::class, $player->getStreetId());

            return [
                'playerId' => $player->getId(),
                'playerName' => $player->getName(),
                'streetId' => $player->getStreetId(),
                'streetName' => (string) ($street?->getData()['name'] ?? '?'),
                'city' => (string) ($street?->getData()['city'] ?? ''),
            ];
        }, $this->playersOf($account));

        return ['account' => ['name' => $account->getName(), 'maxStreets' => Account::MAX_STREETS], 'streets' => $streets];
    }

    /** @return list<Player> */
    private function playersOf(Account $account): array
    {
        return $this->em->getRepository(Player::class)->findBy(['accountId' => $account->getId()], ['createdAt' => 'ASC']);
    }

    private static function cleanName(string $name): string
    {
        return (string) preg_replace('/\s+/u', ' ', trim(strip_tags($name)));
    }
}
