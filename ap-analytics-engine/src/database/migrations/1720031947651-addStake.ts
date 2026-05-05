import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStake1720031947651 implements MigrationInterface {
  name = 'AddStake1720031947651';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE  stake
                 ADD COLUMN currentWallet varchar(100) NULL,
                 ADD INDEX idx_stake_currentWallet (wallet) USING BTREE;
           `);

    await queryRunner.query(`
            CREATE TABLE stake_ranking_hero (
              id char(36) NOT NULL,
              amount float NOT NULL,
              network enum('BSC','POLYGON'), 
              createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              wallet varchar(100) NULL,
              heroId varchar(50) NULL,
              rarity int NULL,
              position integer NULL,
              PRIMARY KEY (id)
            ) ENGINE=InnoDB;
          `);
    await queryRunner.query(`
            ALTER TABLE  stake_ranking_hero
                 ADD INDEX idx_stake_ranking_hero_network (network) USING BTREE,
                 ADD INDEX idx_stake_ranking_hero_rarity (rarity) USING BTREE,
                 ADD INDEX idx_stake_ranking_hero_wallet (wallet) USING BTREE;
           `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE stake DROP COLUMN currentWallet`);
    await queryRunner.query(
      `ALTER TABLE stake DROP INDEX idx_stake_currentWallet`,
    );
    await queryRunner.query(`DROP TABLE stake_ranking_hero`);
  }
}
