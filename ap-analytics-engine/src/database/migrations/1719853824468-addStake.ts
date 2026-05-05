import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStake1719853824468 implements MigrationInterface {
  name = 'AddStake1719853824468';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE stake (
              id char(36) NOT NULL,
              amount float NOT NULL,
              network enum('BSC','POLYGON'), 
              heroId varchar(255) NOT NULL,
              rarity int NULL,
              withdraw int NOT NULL DEFAULT 0,
              createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              date datetime NOT NULL,
              wallet varchar(100) NULL,
              PRIMARY KEY (id)
            ) ENGINE=InnoDB;
          `);
    await queryRunner.query(`
           ALTER TABLE  stake
                ADD INDEX idx_stake_network (network) USING BTREE,
                ADD INDEX idx_stake_wallet (wallet) USING BTREE;
          `);

    await queryRunner.query(`
            CREATE TABLE stake_ranking_wallet (
              id char(36) NOT NULL,
              amount float NOT NULL,
              network enum('BSC','POLYGON'), 
              createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              wallet varchar(100) NULL,
              position integer NULL,
              PRIMARY KEY (id)
            ) ENGINE=InnoDB;
          `);
    await queryRunner.query(`
            ALTER TABLE  stake_ranking_wallet
                 ADD INDEX idx_stake_ranking_wallet_network (network) USING BTREE,
                 ADD INDEX idx_stake_ranking_wallet_wallet (wallet) USING BTREE;
           `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE stake`);
    await queryRunner.query(`DROP TABLE stake_ranking_wallet`);
  }
}
