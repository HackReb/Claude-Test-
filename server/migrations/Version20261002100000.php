<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\DBAL\Types\Types;
use Doctrine\Migrations\AbstractMigration;

/** Babo v2: Ereignisse je Straße für die Zeitung. */
final class Version20261002100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Babo v2: v2_event (Zeitung)';
    }

    public function up(Schema $schema): void
    {
        $event = $schema->createTable('v2_event');
        $event->addColumn('id', Types::STRING, ['length' => 64]);
        $event->addColumn('street_id', Types::STRING, ['length' => 64]);
        $event->addColumn('kind', Types::STRING, ['length' => 24]);
        $event->addColumn('member_id', Types::STRING, ['length' => 64, 'notnull' => false]);
        $event->addColumn('data', Types::JSON);
        $event->addColumn('at_us', Types::BIGINT);
        $event->setPrimaryKey(['id']);
        $event->addIndex(['street_id', 'at_us'], 'v2_event_street');
    }

    public function down(Schema $schema): void
    {
        $schema->dropTable('v2_event');
    }
}
