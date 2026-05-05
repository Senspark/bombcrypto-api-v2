import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateHero1721088420196 implements MigrationInterface {
  name = 'UpdateHero1721088420196';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE hero CHANGE id id varchar(60) NOT NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE house CHANGE id id varchar(60) NOT NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE stake_ranking_hero CHANGE heroId heroId varchar(60) NOT NULL;`,
    );
    await queryRunner.query(`DROP TABLE  hero_sale;`);
    await queryRunner.query(`DROP TABLE  house_sale;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE hero CHANGE id id bigint NOT NULL;`);
    await queryRunner.query(`ALTER TABLE house CHANGE id id bigint NOT NULL;`);
    await queryRunner.query(
      `ALTER TABLE stake_ranking_hero CHANGE heroId heroId bigint NOT NULL;`,
    );
    await queryRunner.query(`
      CREATE TABLE house_sale (
          id INT,
          network enum('BSC','POLYGON'), 
          store enum('OPEN_SEA','MARKET'), 
          createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          token VARCHAR(150) NULL,
          wallet VARCHAR(150) NULL,
          amount float NOT NULL,
         PRIMARY KEY (id, network)
      );
      `);
    await queryRunner.query(`
      CREATE TABLE hero_sale (
          id INT,
          network enum('BSC','POLYGON'), 
          store enum('OPEN_SEA','MARKET'), 
          createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          token VARCHAR(150) NULL,
          wallet VARCHAR(150) NULL,
          amount float NOT NULL,
         PRIMARY KEY (id, network)
      );
      `);
  }
}
