<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\DBAL\Types\Types;
use Doctrine\Migrations\AbstractMigration;

/** Tabellen für Babo (alle mit „babo_“ davor, damit sie neben anderen Anwendungen in einer Datenbank liegen können). */
final class Version20260926000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Babo: Spieler, Straßen, Grundstücks-Anteile und Nachbarschaften';
    }

    public function up(Schema $schema): void
    {
        $player = $schema->createTable('babo_player');
        $player->addColumn('id', Types::STRING, ['length' => 64]);
        $player->addColumn('name', Types::STRING, ['length' => 40]);
        $player->addColumn('token_hash', Types::STRING, ['length' => 64]);
        $player->addColumn('recovery_hash', Types::STRING, ['length' => 64]);
        $player->addColumn('data', Types::JSON);
        $player->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $player->addColumn('updated_at', Types::DATETIME_IMMUTABLE);
        $player->setPrimaryKey(['id']);
        $player->addUniqueIndex(['token_hash'], 'babo_player_token');
        $player->addUniqueIndex(['recovery_hash'], 'babo_player_recovery');

        $street = $schema->createTable('babo_street');
        $street->addColumn('id', Types::STRING, ['length' => 64]);
        $street->addColumn('owner_id', Types::STRING, ['length' => 64]);
        $street->addColumn('controller_id', Types::STRING, ['length' => 64, 'notnull' => false]);
        $street->addColumn('osm_key', Types::STRING, ['length' => 190, 'notnull' => false]);
        $street->addColumn('city_key', Types::STRING, ['length' => 80]);
        $street->addColumn('data', Types::JSON);
        $street->addColumn('updated_at', Types::DATETIME_IMMUTABLE);
        $street->setPrimaryKey(['id']);
        $street->addUniqueIndex(['osm_key'], 'babo_street_osm');
        $street->addIndex(['owner_id'], 'babo_street_owner');
        $street->addIndex(['controller_id'], 'babo_street_controller');
        $street->addIndex(['city_key'], 'babo_street_city');

        $share = $schema->createTable('babo_street_share');
        $share->addColumn('street_id', Types::STRING, ['length' => 64]);
        $share->addColumn('player_id', Types::STRING, ['length' => 64]);
        $share->setPrimaryKey(['street_id', 'player_id']);
        $share->addIndex(['player_id'], 'babo_share_player');

        $hood = $schema->createTable('babo_neighborhood');
        $hood->addColumn('player_id', Types::STRING, ['length' => 64]);
        $hood->addColumn('data', Types::JSON);
        $hood->addColumn('updated_at', Types::DATETIME_IMMUTABLE);
        $hood->setPrimaryKey(['player_id']);
    }

    public function down(Schema $schema): void
    {
        foreach (['babo_neighborhood', 'babo_street_share', 'babo_street', 'babo_player'] as $table) {
            $schema->dropTable($table);
        }
    }
}
