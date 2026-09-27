<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\DBAL\Types\Types;
use Doctrine\Migrations\AbstractMigration;

/** Bad Boys, die Spieler in fremde Straßen schicken. */
final class Version20260927000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Babo: Bad Boys (babo_mischief)';
    }

    public function up(Schema $schema): void
    {
        $table = $schema->createTable('babo_mischief');
        $table->addColumn('id', Types::STRING, ['length' => 64]);
        $table->addColumn('street_id', Types::STRING, ['length' => 64]);
        $table->addColumn('sender_id', Types::STRING, ['length' => 64]);
        $table->addColumn('sender_name', Types::STRING, ['length' => 40]);
        $table->addColumn('bad_boy', Types::STRING, ['length' => 40]);
        $table->addColumn('blocked', Types::BOOLEAN);
        $table->addColumn('delivered', Types::BOOLEAN);
        $table->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $table->setPrimaryKey(['id']);
        $table->addIndex(['street_id', 'delivered'], 'babo_mischief_street');
        $table->addIndex(['sender_id'], 'babo_mischief_sender');
    }

    public function down(Schema $schema): void
    {
        $schema->dropTable('babo_mischief');
    }
}
