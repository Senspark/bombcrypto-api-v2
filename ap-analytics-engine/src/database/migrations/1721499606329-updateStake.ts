import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateStake1721499606329 implements MigrationInterface {
  name = 'UpdateStake1721499606329';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE stake
              add column token varchar(150) NULL
        `);
    await queryRunner.query(`
        ALTER TABLE hero
              add column stakeSen decimal(10,2) not NULL default 0
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

    await queryRunner.query(`
        CREATE TABLE stake_sen_ranking_wallet (
            id char(36) NOT NULL,
            amount float NOT NULL,
            network enum('BSC','POLYGON') DEFAULT NULL,
            createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            wallet varchar(100) DEFAULT NULL,
            position int DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_stake_sen_ranking_wallet_network (network) USING BTREE,
            KEY idx_stake_sen_ranking_wallet_wallet (wallet) USING BTREE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE stake
              drop column token
        `);
    await queryRunner.query(`
            ALTER TABLE hero
                  drop column stakeSen
            `);
    await queryRunner.query(`
            DROP TABLE stake_sen_ranking_hero
            `);
    await queryRunner.query(`
            DROP TABLE stake_sen_ranking_wallet
            `);
  }
}
