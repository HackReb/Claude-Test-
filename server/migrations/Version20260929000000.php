<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\DBAL\Types\Types;
use Doctrine\Migrations\AbstractMigration;

/** Konten mit Name + Passwort (bis zu drei Straßen je Konto) und angemeldete Geräte. */
final class Version20260929000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Babo: Konten (babo_account), Sitzungen (babo_session), babo_player.account_id';
    }

    public function up(Schema $schema): void
    {
        $account = $schema->createTable('babo_account');
        $account->addColumn('id', Types::STRING, ['length' => 64]);
        $account->addColumn('name', Types::STRING, ['length' => 40]);
        $account->addColumn('name_key', Types::STRING, ['length' => 40]);
        $account->addColumn('password_hash', Types::STRING, ['length' => 255]);
        $account->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $account->setPrimaryKey(['id']);
        $account->addUniqueIndex(['name_key'], 'babo_account_name');

        $session = $schema->createTable('babo_session');
        $session->addColumn('token_hash', Types::STRING, ['length' => 64]);
        $session->addColumn('account_id', Types::STRING, ['length' => 64]);
        $session->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $session->setPrimaryKey(['token_hash']);
        $session->addIndex(['account_id'], 'babo_session_account');

        $player = $schema->getTable('babo_player');
        $player->addColumn('account_id', Types::STRING, ['length' => 64, 'notnull' => false]);
        $player->addIndex(['account_id'], 'babo_player_account');
    }

    public function down(Schema $schema): void
    {
        $player = $schema->getTable('babo_player');
        $player->dropIndex('babo_player_account');
        $player->dropColumn('account_id');
        $schema->dropTable('babo_session');
        $schema->dropTable('babo_account');
    }
}
