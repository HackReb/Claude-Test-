<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\DBAL\Types\Types;
use Doctrine\Migrations\AbstractMigration;

/** Babo v2: Straßen mit Mall, Mitglieder (ein Konto = eine Straße) und Läden. Die v1-Tabellen bleiben unberührt. */
final class Version20261002000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Babo v2: v2_street, v2_member, v2_shop';
    }

    public function up(Schema $schema): void
    {
        $street = $schema->createTable('v2_street');
        $street->addColumn('id', Types::STRING, ['length' => 64]);
        $street->addColumn('name', Types::STRING, ['length' => 80]);
        $street->addColumn('name_key', Types::STRING, ['length' => 120]);
        $street->addColumn('city', Types::STRING, ['length' => 80]);
        $street->addColumn('city_key', Types::STRING, ['length' => 80]);
        $street->addColumn('osm_key', Types::STRING, ['length' => 190, 'notnull' => false]);
        $street->addColumn('founder_account_id', Types::STRING, ['length' => 64]);
        $street->addColumn('data', Types::JSON);
        $street->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $street->addColumn('updated_at', Types::DATETIME_IMMUTABLE);
        $street->setPrimaryKey(['id']);
        $street->addUniqueIndex(['osm_key'], 'v2_street_osm');
        $street->addUniqueIndex(['city_key', 'name_key'], 'v2_street_place');

        $member = $schema->createTable('v2_member');
        $member->addColumn('id', Types::STRING, ['length' => 64]);
        $member->addColumn('street_id', Types::STRING, ['length' => 64]);
        $member->addColumn('account_id', Types::STRING, ['length' => 64]);
        $member->addColumn('name', Types::STRING, ['length' => 40]);
        $member->addColumn('data', Types::JSON);
        $member->addColumn('joined_at', Types::DATETIME_IMMUTABLE);
        $member->addColumn('updated_at', Types::DATETIME_IMMUTABLE);
        $member->setPrimaryKey(['id']);
        $member->addUniqueIndex(['account_id'], 'v2_member_account');
        $member->addIndex(['street_id'], 'v2_member_street');

        $shop = $schema->createTable('v2_shop');
        $shop->addColumn('id', Types::STRING, ['length' => 64]);
        $shop->addColumn('street_id', Types::STRING, ['length' => 64]);
        $shop->addColumn('member_id', Types::STRING, ['length' => 64]);
        $shop->addColumn('type', Types::STRING, ['length' => 40]);
        $shop->addColumn('name', Types::STRING, ['length' => 40]);
        $shop->addColumn('look', Types::SMALLINT);
        $shop->addColumn('data', Types::JSON);
        $shop->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $shop->setPrimaryKey(['id']);
        $shop->addIndex(['street_id'], 'v2_shop_street');
        $shop->addIndex(['member_id'], 'v2_shop_member');
    }

    public function down(Schema $schema): void
    {
        $schema->dropTable('v2_shop');
        $schema->dropTable('v2_member');
        $schema->dropTable('v2_street');
    }
}
