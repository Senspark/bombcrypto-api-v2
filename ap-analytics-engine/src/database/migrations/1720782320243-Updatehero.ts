import { MigrationInterface, QueryRunner } from 'typeorm';

export class Updatehero1720782320243 implements MigrationInterface {
  name = 'Updatehero1720782320243';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE hero CHANGE id id bigint NOT NULL;`);
    await queryRunner.query(
      `ALTER TABLE stake_ranking_hero CHANGE heroId heroId bigint NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE stake_ranking_hero CHANGE heroId heroId varchar(50) NOT NULL;`,
    );
    await queryRunner.query(`ALTER TABLE hero CHANGE id id int NOT NULL;`);
  }
}
