<?php

namespace App\Command;

use App\Entity\Account;
use App\Entity\Player;
use App\Entity\Street;
use App\Service\PlayerRemover;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Aufräumen aus der Zeit vor „jede Straße nur einmal“: listet Straßen, die mehrere Spieler geclaimt haben,
 * und löscht auf Wunsch einen Spielstand.
 * Beispiel: php bin/console babo:doppelte-strassen
 *           php bin/console babo:doppelte-strassen --loeschen=<Spieler-ID>
 */
#[AsCommand(name: 'babo:doppelte-strassen', description: 'Doppelt geclaimte Straßen anzeigen und einen Spielstand löschen')]
final class DuplicateStreetsCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly PlayerRemover $remover,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('loeschen', null, InputOption::VALUE_REQUIRED, 'Spieler-ID, deren Spielstand (Straße samt Nachbarschaft) gelöscht wird');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $delete = $input->getOption('loeschen');
        if (\is_string($delete) && '' !== $delete) {
            $player = $this->em->find(Player::class, $delete);
            if (!$player instanceof Player) {
                $io->error("Keinen Spieler mit der ID „{$delete}“ gefunden.");

                return Command::FAILURE;
            }
            $this->remover->remove($player);
            $this->em->flush();
            $io->success("Spielstand von {$player->getName()} gelöscht – die Straße ist wieder frei.");

            return Command::SUCCESS;
        }

        $groups = [];
        foreach ($this->em->getRepository(Street::class)->findBy(['controllerId' => null]) as $street) {
            $data = $street->getData();
            $groups[Street::cityKey((string) ($data['city'] ?? '')).'|'.Street::nameKey((string) ($data['name'] ?? ''))][] = $street;
        }
        $rows = [];
        foreach ($groups as $streets) {
            if (\count($streets) < 2) {
                continue;
            }
            foreach ($streets as $street) {
                $player = $this->em->find(Player::class, $street->getOwnerId());
                $account = $player?->getAccountId() ? $this->em->find(Account::class, $player->getAccountId()) : null;
                $data = $street->getData();
                $built = \count(array_filter((array) ($data['plots'] ?? []), static fn ($p) => isset($p['building'])));
                $rows[] = [
                    $data['name'].', '.$data['city'],
                    $player?->getName() ?? '?',
                    $account?->getName() ?? '–',
                    $built,
                    $player?->getId() ?? $street->getOwnerId(),
                ];
            }
            $rows[] = ['', '', '', '', ''];
        }

        if ([] === $rows) {
            $io->success('Keine doppelten Straßen.');

            return Command::SUCCESS;
        }
        $io->table(['Straße', 'Spieler', 'Konto', 'Gebäude', 'Spieler-ID'], $rows);
        $io->note('Löschen: php bin/console babo:doppelte-strassen --loeschen=<Spieler-ID>');

        return Command::SUCCESS;
    }
}
