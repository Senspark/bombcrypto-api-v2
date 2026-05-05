import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateStake1720353444508 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE TABLE stake`);
    await queryRunner.query(`ALTER TABLE stake
            ADD COLUMN blockNumber varchar(100) NULL,
            ADD COLUMN hash varchar(150) NULL;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE stake
            DROP COLUMN blockNumber,
            DROP COLUMN hash;
        `);
  }
}
