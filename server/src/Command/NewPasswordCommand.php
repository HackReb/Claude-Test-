<?php

namespace App\Command;

use App\Entity\Account;
use App\Entity\Session;
use App\Service\Credentials;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Passwort vergessen: stellt ein neues aus und meldet alle Geräte des Kontos ab.
 * Beispiel: php bin/console babo:passwort "Papa Matthias"
 */
#[AsCommand(name: 'babo:passwort', description: 'Neues Passwort für ein Konto ausstellen (alle Geräte werden abgemeldet)')]
final class NewPasswordCommand extends Command
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('konto', InputArgument::REQUIRED, 'Name des Kontos (Groß-/Kleinschreibung egal)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $name = (string) $input->getArgument('konto');
        $account = $this->em->getRepository(Account::class)->findOneBy(['nameKey' => Account::nameKey($name)]);
        if (!$account instanceof Account) {
            $io->error("Kein Konto „{$name}“ gefunden.");

            return Command::FAILURE;
        }

        $password = strtolower(substr(str_replace(['-', '_'], '', Credentials::newToken()), 0, 8));
        $account->setPassword($password);
        foreach ($this->em->getRepository(Session::class)->findBy(['accountId' => $account->getId()]) as $session) {
            $this->em->remove($session);
        }
        $this->em->flush();

        $io->success(["Neues Passwort für {$account->getName()}:", $password, 'Alle Geräte sind abgemeldet – einfach mit dem neuen Passwort anmelden.']);

        return Command::SUCCESS;
    }
}
