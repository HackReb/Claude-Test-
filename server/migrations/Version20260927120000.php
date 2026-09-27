<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\DBAL\Types\Types;
use Doctrine\Migrations\AbstractMigration;

/** Tiere und Autos auf Ausflug tragen einen Namen („Maxims Elefant Benjamin“). */
final class Version20260927120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Babo: Namen für Tiere und Autos auf Ausflug (babo_mischief.label)';
    }

    public function up(Schema $schema): void
    {
        $schema->getTable('babo_mischief')->addColumn('label', Types::STRING, ['length' => 60, 'notnull' => false]);
    }

    public function down(Schema $schema): void
    {
        $schema->getTable('babo_mischief')->dropColumn('label');
    }
}
