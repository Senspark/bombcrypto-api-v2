import { MigrationInterface, QueryRunner } from 'typeorm';

export class Updatemapblock1720435460478 implements MigrationInterface {
  name = 'Updatemapblock1720435460478';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX idx_map_block_walletId_i_j ON map_block (walletId, i, j);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_map_block_walletId_i_j;`);
  }
}
