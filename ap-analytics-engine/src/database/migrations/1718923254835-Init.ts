import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1718923254835 implements MigrationInterface {
  name = 'Init1718923254835';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE wallet (
                id char(36) NOT NULL,
                walletId char(60) NOT NULL,
                createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                online enum('ONLINE','OFFLINE'), 
                network enum('BSC','POLYGON'), 
                PRIMARY KEY (id)
            );
        `);
    await queryRunner.query(`
            CREATE TABLE \`map\` (
            id char(36) NOT NULL,
            createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            walletId char(36) NOT NULL, 
            PRIMARY KEY (id)
        );
    `);
    await queryRunner.query(
      `ALTER TABLE \`map\` ADD CONSTRAINT fk_map_walletId FOREIGN KEY (walletId) REFERENCES wallet (id) ON DELETE CASCADE;`,
    );
    await queryRunner.query(`
        CREATE TABLE map_block (
            id char(36) NOT NULL,
            mapId char(36) NOT NULL,
            i int DEFAULT '0',
            j int DEFAULT '0',
            createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`type\` int,
            maxHp int DEFAULT '0',
            hp int DEFAULT '0',
            walletId char(36) NOT NULL, 
            PRIMARY KEY (id)
        );
    `);
    await queryRunner.query(
      `ALTER TABLE \`map_block\` ADD CONSTRAINT fk_map_block_walletId FOREIGN KEY (walletId) REFERENCES wallet (id) ON DELETE CASCADE;`,
    );
    await queryRunner.query(
      `ALTER TABLE \`map_block\` ADD CONSTRAINT fk_map_block_mapId FOREIGN KEY (mapId) REFERENCES \`map\` (id) ON DELETE CASCADE;`,
    );
    await queryRunner.query(
      `CREATE TABLE map_reward (
            id char(36) NOT NULL,
            \`type\` char(50) NOT NULL,
            \`value\` decimal(20,18) NOT NULL DEFAULT '0',
            createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            mapId char(36) NOT NULL, 
            PRIMARY KEY (id)
        );`,
    );
    await queryRunner.query(
      `ALTER TABLE \`map_reward\` ADD CONSTRAINT fk_map_reward_mapId FOREIGN KEY (mapId) REFERENCES \`map\` (id) ON DELETE CASCADE;`,
    );
    await queryRunner.query(
      `CREATE TABLE farm_session (
            id char(36) NOT NULL,
            walletId char(36) NOT NULL,
            startTime datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            endTime dateTime,
            createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            totalTime int DEFAULT '0', 
            PRIMARY KEY (id)
        );`,
    );
    await queryRunner.query(
      `ALTER TABLE \`farm_session\` ADD CONSTRAINT fk_farm_session_walletId FOREIGN KEY (walletId) REFERENCES \`wallet\` (id) ON DELETE CASCADE;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `farm_session`');
    await queryRunner.query('DROP TABLE `map_reward`');
    await queryRunner.query('DROP TABLE `map_block`');
    await queryRunner.query('DROP TABLE `map`');
    await queryRunner.query('DROP TABLE wallet');
  }
}
