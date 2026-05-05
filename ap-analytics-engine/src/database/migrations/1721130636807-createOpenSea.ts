import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOpenSea1721130636807 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE open_sea (
              id char(36) NOT NULL,
              amount float NOT NULL,
              createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              nftId varchar(50) NULL,
              nftType enum('HOUSE','HERO'), 
              PRIMARY KEY (id)
            ) ENGINE=InnoDB;
          `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE open_sea;
          `);
  }
}
