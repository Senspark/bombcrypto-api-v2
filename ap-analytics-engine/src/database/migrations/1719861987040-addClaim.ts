import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClaim1719861987040 implements MigrationInterface {
  name = 'AddClaim1719861987040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE claim (
            id INT AUTO_INCREMENT PRIMARY KEY,
            amount FLOAT NOT NULL,
            tokenSymbol VARCHAR(50) NOT NULL,
            wallet VARCHAR(100) NOT NULL,
            network enum('BSC','POLYGON'), 
            token enum('BCOIN','SEN'), 
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            blockNumber VARCHAR(50) NOT NULL,
            hash VARCHAR(255) NOT NULL
        );
  `);
    await queryRunner.query(`
    ALTER TABLE  claim
         ADD INDEX idx_claim_network (network) USING BTREE,
         ADD INDEX idx_claim_wallet (wallet) USING BTREE;
   `);

    await queryRunner.query(`
    CREATE TABLE claim_ranking_wallet (
      id char(36) NOT NULL,
      amount float NOT NULL,
      network enum('BSC','POLYGON'), 
      token enum('BCOIN','SEN'), 
      createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      wallet varchar(100) NULL,
      position integer NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB;
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(` 
      DROP TABLE claim;`);
    await queryRunner.query(`
      DROP TABLE claim_ranking_wallet
    `);
  }
}
