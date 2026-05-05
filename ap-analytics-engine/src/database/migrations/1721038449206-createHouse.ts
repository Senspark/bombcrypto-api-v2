import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHouse1721038449206 implements MigrationInterface {
  name = 'CreateHouse1721038449206';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE TABLE house (
            id INT,
            \`index\` INT NULL,
            rarity INT NULL,
            recovery INT NULL,
            capacity INT NULL,
            blockNumber INT NULL,
            network enum('BSC','POLYGON'), 
            createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            genId VARCHAR(150) NULL,
            wallet VARCHAR(150) NULL,
            name VARCHAR(150) NULL,
            marketPrice float NULL,
            marketToken VARCHAR(150) NULL,
            openSeaPrice float NULL,
           PRIMARY KEY (id, network)
        );
        `);
    await queryRunner.query(`
      ALTER TABLE hero
            add column marketPrice float NULL,
            add column marketToken VARCHAR(150) NULL,
            add column openSeaPrice float NULL
      `);

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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE house');
    await queryRunner.query('DROP TABLE house_sale');
    await queryRunner.query('DROP TABLE hero_sale');
    await queryRunner.query(`
      ALTER TABLE hero
            drop column marketPrice,
            drop column marketToken,
            drop column openSeaPrice
      `);
  }
}
