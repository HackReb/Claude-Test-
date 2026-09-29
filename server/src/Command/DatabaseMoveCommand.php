<?php

namespace App\Command;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DriverManager;
use Doctrine\DBAL\Platforms\SQLitePlatform;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Umzug der Spieldaten aus der SQLite-Datei in die eingestellte Datenbank (z. B. MariaDB).
 * Vorher: DATABASE_URL auf die neue Datenbank stellen und `doctrine:migrations:migrate` laufen lassen.
 * Beispiel: php bin/console babo:db-umzug --von=var/babo.db
 */
#[AsCommand(name: 'babo:db-umzug', description: 'Spieldaten aus der alten SQLite-Datei in die eingestellte Datenbank kopieren')]
final class DatabaseMoveCommand extends Command
{
    /** Reihenfolge egal (keine Fremdschlüssel), aber so liest sich die Ausgabe gut. */
    private const TABLES = [
        'babo_account',
        'babo_session',
        'babo_player',
        'babo_street',
        'babo_street_share',
        'babo_neighborhood',
        'babo_mischief',
    ];

    private const BATCH = 200;

    public function __construct(private readonly Connection $target)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('von', null, InputOption::VALUE_REQUIRED, 'Pfad zur alten SQLite-Datei', 'var/babo.db')
            ->addOption('ueberschreiben', null, InputOption::VALUE_NONE, 'Vorhandene Babo-Daten in der Ziel-Datenbank vorher löschen');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $path = (string) $input->getOption('von');
        if (!is_file($path)) {
            $io->error("SQLite-Datei „{$path}“ nicht gefunden.");

            return Command::FAILURE;
        }
        if ($this->target->getDatabasePlatform() instanceof SQLitePlatform
            && realpath($path) === realpath((string) ($this->target->getParams()['path'] ?? ''))) {
            $io->error('Quelle und Ziel sind dieselbe Datei – erst DATABASE_URL auf die neue Datenbank stellen.');

            return Command::FAILURE;
        }

        $source = DriverManager::getConnection(['driver' => 'pdo_sqlite', 'path' => $path]);
        $sourceTables = $source->createSchemaManager()->listTableNames();
        $targetTables = $this->target->createSchemaManager()->listTableNames();
        $missing = array_diff(self::TABLES, $targetTables);
        if ([] !== $missing) {
            $io->error('In der neuen Datenbank fehlen Tabellen ('.implode(', ', $missing).'). Erst `php bin/console doctrine:migrations:migrate` ausführen.');

            return Command::FAILURE;
        }

        $filled = array_filter(self::TABLES, fn (string $t) => (int) $this->target->fetchOne("SELECT COUNT(*) FROM $t") > 0);
        if ([] !== $filled && !$input->getOption('ueberschreiben')) {
            $io->error('In der neuen Datenbank liegen schon Babo-Daten ('.implode(', ', $filled).'). Mit --ueberschreiben werden sie vorher gelöscht.');

            return Command::FAILURE;
        }

        $rows = [];
        $this->target->beginTransaction();
        try {
            foreach (self::TABLES as $table) {
                $this->target->executeStatement("DELETE FROM $table");
                if (!\in_array($table, $sourceTables, true)) {
                    $rows[] = [$table, 0, 0];
                    continue;
                }
                // Nur Spalten, die es auf beiden Seiten gibt (ältere Stände haben evtl. weniger).
                $columns = array_values(array_intersect(
                    array_keys($source->createSchemaManager()->listTableColumns($table)),
                    array_keys($this->target->createSchemaManager()->listTableColumns($table)),
                ));
                $copied = 0;
                $offset = 0;
                do {
                    $batch = $source->fetchAllAssociative(\sprintf('SELECT %s FROM %s LIMIT %d OFFSET %d', implode(', ', $columns), $table, self::BATCH, $offset));
                    foreach ($batch as $row) {
                        $this->target->insert($table, $row);
                        ++$copied;
                    }
                    $offset += self::BATCH;
                } while (\count($batch) === self::BATCH);
                $rows[] = [$table, (int) $source->fetchOne("SELECT COUNT(*) FROM $table"), $copied];
            }
            $this->target->commit();
        } catch (\Throwable $e) {
            $this->target->rollBack();
            $io->error('Umzug abgebrochen, nichts geändert: '.$e->getMessage());

            return Command::FAILURE;
        }

        $io->table(['Tabelle', 'alt', 'neu'], $rows);
        foreach ($rows as [$table, $before, $after]) {
            if ($before !== $after) {
                $io->error("Bei $table stimmt die Anzahl nicht.");

                return Command::FAILURE;
            }
        }
        $io->success('Alle Babo-Daten sind umgezogen. Die SQLite-Datei bleibt als Sicherung liegen.');

        return Command::SUCCESS;
    }
}
