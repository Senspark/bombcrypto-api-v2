import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRankingwalletglobal1722181878468 implements MigrationInterface {
  name = 'AddRankingwalletglobal1722181878468';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE stake_ranking_wallet_global (
                stake float NOT NULL DEFAULT '0',
                createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                wallet varchar(100) NOT NULL,
                positionSen int DEFAULT NULL,
                positionBcoin int DEFAULT NULL,
                stakeSen float NOT NULL DEFAULT '0',
                PRIMARY KEY (wallet)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE stake_ranking_wallet_global
        `);
  }
}
