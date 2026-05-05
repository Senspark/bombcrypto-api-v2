import { MigrationInterface, QueryRunner } from 'typeorm';

export class Updatewallet1720522407110 implements MigrationInterface {
  name = 'Updatewallet1720522407110';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE wallet
        DROP INDEX idx_wallet_walletId,
        ADD UNIQUE INDEX idx_wallet_walletId (walletId,network) USING BTREE;`);
    await queryRunner.query(
      `ALTER TABLE wallet ADD COLUMN extensionInstalled tinyint NULL DEFAULT '0';`,
    );
    await queryRunner.query(
      `INSERT IGNORE INTO wallet (id, walletId, network)
      SELECT * FROM (
        SELECT UUID() AS id, wallet AS walletId, network FROM stake_ranking_wallet
        UNION ALL
        SELECT UUID() AS id, wallet AS walletId, network FROM claim_ranking_wallet
      ) AS combined;`,
    );

    await queryRunner.query(
      `CREATE TABLE farm_average (
        id char(36),
        walletId char(36) NOT NULL,
        totalHours float,
        totalSeconds float,
        startDate datetime,
        endDate datetime,
        mapsTotal float,
        mapsAverage float,
        tokensList json,
        tokensAverage json,
        createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );`,
    );

    await queryRunner.query(`ALTER TABLE farm_average ADD UNIQUE (walletId);`);
    await queryRunner.query(`ALTER TABLE farm_average ADD CONSTRAINT fk_farm_average_walletId FOREIGN KEY (walletId) REFERENCES wallet (id) ON DELETE CASCADE;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE wallet
        DROP INDEX idx_wallet_walletId,
        ADD INDEX idx_wallet_walletId (walletId) USING BTREE;`);

    await queryRunner.query(
      `ALTER TABLE wallet DROP COLUMN extensionInstalled;`,
    );

    await queryRunner.query(`DROP TABLE farm_average;`);
  }
}
