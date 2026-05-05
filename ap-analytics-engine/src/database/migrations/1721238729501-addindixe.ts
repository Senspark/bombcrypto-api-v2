import { MigrationInterface, QueryRunner } from 'typeorm';

export class Addindixe1721238729501 implements MigrationInterface {
  name = 'Addindixe1721238729501';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE map_reward ADD INDEX ix_map_reward_createdAt (createdAt) USING BTREE;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX ix_map_reward_createdAt ON map_reward`);
  }
}
