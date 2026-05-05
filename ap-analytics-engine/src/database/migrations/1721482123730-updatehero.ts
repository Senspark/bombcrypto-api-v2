import { MigrationInterface, QueryRunner } from 'typeorm';

export class Updatehero1721482123730 implements MigrationInterface {
  name = 'Updatehero1721482123730';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE hero
                  add column currentShield int NULL
                  
            `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE hero
                  drop column currentShield
            `);
  }
}
