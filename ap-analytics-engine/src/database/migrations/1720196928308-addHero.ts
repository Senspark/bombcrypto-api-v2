import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHero1720196928308 implements MigrationInterface {
  name = 'AddHero1720196928308';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE TABLE hero (
            id INT,
            \`index\` INT NULL,
            rarity VARCHAR(50) NULL,
            raritySimbol VARCHAR(2) NULL,
            rarityIndex INT NULL,
            level INT NULL,
            variant INT NULL,
            skin VARCHAR(50) NULL,
            skinValue INT NULL,
            stamina INT NULL,
            speed INT NULL,
            bombSkin INT NULL,
            skillCount INT NULL,
            capacity INT NULL,
            strength INT NULL,
            \`range\` INT NULL,
            blockNumber INT NULL,
            randomizeAbilityCounter INT NULL,
            numUpgradeShieldLevel INT NULL,
            numResetShield INT NULL,
            abilities JSON NULL,
            abilityHeroS JSON NULL,
            maxShield INT NULL,
            stake DECIMAL(10, 2) NULL,
            network enum('BSC','POLYGON'), 
            createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            burned BOOLEAN NULL,
            genId VARCHAR(150) NULL,
            wallet VARCHAR(150) NULL,
           PRIMARY KEY (id, network)
        );
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE hero');
  }
}
