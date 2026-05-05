import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndice1721245262117 implements MigrationInterface {
  name = 'AddIndice1721245262117';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE open_sea ADD UNIQUE INDEX idx_open_sea_nftId_nftType (nftId,nftType) USING BTREE;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX idx_open_sea_nftId_nftType ON open_sea`,
    );
  }
}
