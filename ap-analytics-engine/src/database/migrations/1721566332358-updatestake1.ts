import { MigrationInterface, QueryRunner } from 'typeorm';

export class Updatestake11721566332358 implements MigrationInterface {
  name = 'Updatestake11721566332358';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE stake_sen_ranking_wallet
                  add column stakeSen float not NULL default 0,
                  CHANGE amount stake float NOT NULL default 0;
            `);
    await queryRunner.query(`
        ALTER TABLE stake_ranking_wallet
            add column stakeSen float not NULL default 0,
            CHANGE amount stake float NOT NULL default 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE stake_sen_ranking_wallet
            drop column stakeSen,
            CHANGE stake amount float NOT NULL default 0;
        `);
    await queryRunner.query(`
        ALTER TABLE stake_ranking_wallet
            drop column stakeSen,
            CHANGE stake amount float NOT NULL default 0;
    `);
  }
}
