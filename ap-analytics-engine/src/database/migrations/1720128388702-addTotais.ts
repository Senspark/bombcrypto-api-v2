import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTotais1720128388702 implements MigrationInterface {
  name = 'AddTotais1720128388702';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE TABLE totals (
            id CHAR(36) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            value TEXT,
            additional JSON,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            network ENUM('POLYGON', 'BSC'),
            UNIQUE INDEX idx_totals_name_network (name, network) USING BTREE

        );
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DROP TABLE totals;
    `);
  }
}
