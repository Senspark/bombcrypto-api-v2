import { MigrationInterface, QueryRunner } from 'typeorm';

export class Addindex1720291322268 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE  hero
                 ADD INDEX idx_hero_genId (genId) USING BTREE
           `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE  hero
                 DROP INDEX idx_hero_genId
           `);
  }
}
