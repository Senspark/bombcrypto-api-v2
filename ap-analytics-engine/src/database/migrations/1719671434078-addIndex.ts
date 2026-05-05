import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndex1719671434078 implements MigrationInterface {
  name = 'AddIndex1719671434078';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE wallet ADD INDEX idx_wallet_walletId (walletId) USING BTREE;
    `);
    await queryRunner.query(`
        ALTER TABLE map_reward ADD COLUMN walletId char(36) NULL;
    `);

    await queryRunner.query(
      `ALTER TABLE \`map_reward\` ADD CONSTRAINT fk_map_reward_walletId FOREIGN KEY (walletId) REFERENCES wallet (id) ON DELETE CASCADE;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DROP INDEX idx_wallet_walletId ON wallet;
    `);
    await queryRunner.query(`
      ALTER TABLE map_reward DROP FOREIGN KEY fk_map_reward_walletId;
  `);
    await queryRunner.query(`
        ALTER TABLE map_reward DROP COLUMN walletId;
    `);
  }
}
