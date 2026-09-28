<?php

namespace App\Command;

use App\Entity\Player;
use App\Entity\Street;
use App\Service\Credentials;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Notfall: Handy weg und Code nicht notiert. Vergibt einen neuen Anmelde-Code, der alte wird ungültig.
 * Beispiel: php bin/console babo:neuer-code Maxim
 */
#[AsCommand(name: 'babo:neuer-code', description: 'Neuen Anmelde-Code für einen Spieler ausstellen (per Name oder Spieler-ID)')]
final class NewCodeCommand extends Command
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('spieler', InputArgument::REQUIRED, 'Name (Groß-/Kleinschreibung egal) oder Spieler-ID');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $query = trim((string) $input->getArgument('spieler'));

        $players = $this->em->getRepository(Player::class)->findBy(['id' => $query]);
        if ([] === $players) {
            $players = array_values(array_filter(
                $this->em->getRepository(Player::class)->findAll(),
                static fn (Player $p) => 0 === strcasecmp(trim($p->getName()), $query),
            ));
        }

        if ([] === $players) {
            $io->error("Keinen Spieler „{$query}“ gefunden.");

            return Command::FAILURE;
        }
        if (count($players) > 1) {
            $io->warning('Mehrere Spieler heißen so – bitte mit der Spieler-ID nochmal aufrufen:');
            $io->table(['Spieler-ID', 'Name', 'Straße', 'Zuletzt gespeichert'], array_map(fn (Player $p) => [
                $p->getId(),
                $p->getName(),
                $this->streetName($p),
                $p->getUpdatedAt()->format('d.m.Y H:i'),
            ], $players));

            return Command::FAILURE;
        }

        $player = $players[0];
        $code = Credentials::newRecoveryCode();
        $player->setRecoveryHash(Credentials::hash($code));
        $this->em->flush();

        $io->success([
            "Neuer Anmelde-Code für {$player->getName()} ({$this->streetName($player)}):",
            $code,
            'Der alte Code gilt nicht mehr. Im Spiel: „Mit Code anmelden“.',
        ]);

        return Command::SUCCESS;
    }

    private function streetName(Player $player): string
    {
        $street = $this->em->find(Street::class, $player->getStreetId());
        $data = $street?->getData() ?? [];

        return trim(($data['name'] ?? '?').', '.($data['city'] ?? ''), ', ');
    }
}
