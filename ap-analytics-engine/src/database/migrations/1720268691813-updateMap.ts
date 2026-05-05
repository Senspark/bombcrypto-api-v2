import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateMap1720268691813 implements MigrationInterface {
  name = 'UpdateMap1720268691813';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE map_block
                MODIFY mapId char(36) NULL;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE map_block
                MODIFY mapId char(36) NOT NULL;
        `);
  }
}
