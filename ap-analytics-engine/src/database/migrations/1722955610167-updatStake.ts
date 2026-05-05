import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatStake1722955610167 implements MigrationInterface {
  name = 'UpdatStake1722955610167';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE stake_ranking_hero
            CHANGE position positionBcoin int NULL,
            ADD COLUMN positionSen int NULL,
              ADD COLUMN positionSenGlobal int NULL,
              ADD COLUMN positionBcoinGlobal int NULL,
            CHANGE amount stake float NOT NULL DEFAULT '0',
            ADD COLUMN stakeSen float NOT NULL DEFAULT '0';
    `);
    await queryRunner.query(`
       DROP TABLE stake_sen_ranking_hero;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE stake_ranking_hero
            CHANGE positionBcoin position int NULL,
            CHANGE stake amount int NULL,
            DROP COLUMN stakeSen,
            DROP COLUMN positionSenGlobal,
            DROP COLUMN positionBcoinGlobal,
            DROP COLUMN positionSen;
    `);
    await queryRunner.query(`
       CREATE TABLE stake_sen_ranking_hero (
            id char(36) NOT NULL,
            amount float NOT NULL,
            network enum('BSC','POLYGON') DEFAULT NULL,
            createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            wallet varchar(100) DEFAULT NULL,
            heroId varchar(60) NOT NULL,
            rarity int DEFAULT NULL,
            position int DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_stake_sen_ranking_hero_network (network) USING BTREE,
            KEY idx_stake_sen_ranking_hero_rarity (rarity) USING BTREE,
            KEY idx_stake_sen_ranking_hero_wallet (wallet) USING BTREE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
    `);
  }
}
